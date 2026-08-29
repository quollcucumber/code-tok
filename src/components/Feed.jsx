import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  fetchOlderBlogEntries,
  fetchRecentBlogEntries,
  fetchUsers,
  isAnnouncement,
  preloadProblems,
  takeRandomProblem,
} from '../lib/codeforces'
import { useSeen } from '../hooks/useSeen'
import { useAdmin } from '../hooks/useAdmin'
import { useRemovedBlogs } from '../hooks/useRemovedBlogs'
import BlogCard from './BlogCard'
import ProblemCard from './ProblemCard'
import CommentsPanel from './CommentsPanel'
import SharePanel from './SharePanel'

const LOAD_BATCH = 8
const LOAD_AHEAD = 10
const PROBLEM_EVERY = 10

export default function Feed({
  reactions,
  problemsApi,
  friends,
  groups,
  myName,
  minScore,
  hideAnnouncements,
  keyword,
  onSignIn,
}) {
  const [entries, setEntries] = useState([])
  const [authors, setAuthors] = useState({})
  const [activeIndex, setActiveIndex] = useState(0)
  const [status, setStatus] = useState('loading')
  const [loadingMore, setLoadingMore] = useState(false)
  const [commentsFor, setCommentsFor] = useState(null)
  const [shareFor, setShareFor] = useState(null)
  const containerRef = useRef(null)
  const knownIdsRef = useRef(new Set())
  const rewatchPoolRef = useRef([])
  const nextBeforeIdRef = useRef(null)
  const loadingMoreRef = useRef(false)
  const problemGapRef = useRef(0)
  const { isSeen, markSeen, loaded: seenLoaded } = useSeen()
  const { isAdmin } = useAdmin()
  const { removedIds, removeBlog } = useRemovedBlogs()
  const [removeError, setRemoveError] = useState('')
  const { likes, saves, error, clearError, toggleLike, toggleSave } = reactions
  const { problems, toggleProblemSave, toggleProblemSolved } = problemsApi

  const kw = (keyword || '').trim().toLowerCase()
  const visible = useMemo(
    () =>
      entries.filter(
        (e) =>
          e.kind === 'problem' ||
          (!removedIds.has(e.id) &&
          (minScore == null || e.rating >= minScore) &&
          (!hideAnnouncements || !isAnnouncement(e)) &&
          (kw === '' ||
            e.title.toLowerCase().includes(kw) ||
            (e.tags || []).some((t) => t.toLowerCase().includes(kw))))
      ),
    [entries, removedIds, minScore, hideAnnouncements, kw]
  )

  const addEntries = useCallback(async (list) => {
    const fresh = list.filter((e) => !knownIdsRef.current.has(e.id))
    if (fresh.length === 0) return
    for (const e of fresh) knownIdsRef.current.add(e.id)
    // Deal a random problem card into the feed every PROBLEM_EVERY blogs.
    const mixed = []
    for (const e of fresh) {
      mixed.push(e)
      problemGapRef.current += 1
      if (problemGapRef.current >= PROBLEM_EVERY) {
        const problem = takeRandomProblem()
        if (problem) {
          problemGapRef.current = 0
          knownIdsRef.current.add(problem.id)
          mixed.push(problem)
        }
      }
    }
    setEntries((prev) => [...prev, ...mixed])
    const users = await fetchUsers(fresh.map((e) => e.authorHandle))
    setAuthors((prev) => ({ ...prev, ...users }))
  }, [])

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || nextBeforeIdRef.current == null) return
    loadingMoreRef.current = true
    setLoadingMore(true)
    try {
      const { entries: older, nextBeforeId } = await fetchOlderBlogEntries(
        nextBeforeIdRef.current,
        LOAD_BATCH,
        (id) => knownIdsRef.current.has(id) || isSeen(id)
      )
      nextBeforeIdRef.current = nextBeforeId > 0 ? nextBeforeId : null
      await addEntries(older)
    } catch {
      // transient API failure; pause briefly so the retry loop doesn't spin
      await new Promise((r) => setTimeout(r, 2000))
    } finally {
      loadingMoreRef.current = false
      setLoadingMore(false)
    }
  }, [addEntries, isSeen])

  useEffect(() => {
    preloadProblems()
  }, [])

  useEffect(() => {
    if (!seenLoaded || knownIdsRef.current.size > 0) return
    let cancelled = false
    fetchRecentBlogEntries()
      .then(async (list) => {
        if (cancelled) return
        if (list.length === 0) {
          setStatus('empty')
          return
        }
        nextBeforeIdRef.current = Math.max(...list.map((e) => e.id)) + 1
        // Already-seen blogs are kept as a rewatch pool so the feed has
        // something to show while unseen blogs load slowly from the API.
        rewatchPoolRef.current = list
          .filter((e) => isSeen(e.id))
          .map((e) => ({ ...e, rewatch: true }))
        setStatus('ready')
        await addEntries(list.filter((e) => !isSeen(e.id)))
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [seenLoaded, addEntries, isSeen])

  useEffect(() => {
    if (status !== 'ready' || loadingMore) return
    if (visible.length - activeIndex <= LOAD_AHEAD) loadMore()
  }, [status, activeIndex, visible.length, loadingMore, loadMore])

  // Rewatch cards are a last resort: only shown once every unseen blog has
  // been exhausted (nothing left to load), never while more can be fetched.
  useEffect(() => {
    if (status !== 'ready' || loadingMore || nextBeforeIdRef.current != null) return
    if (visible.length - activeIndex <= 2 && rewatchPoolRef.current.length > 0) {
      addEntries(rewatchPoolRef.current.splice(0, 3))
    }
  }, [status, activeIndex, visible.length, loadingMore, addEntries])

  useEffect(() => {
    const entry = visible[activeIndex]
    if (entry && entry.kind !== 'problem') markSeen(entry.id)
  }, [visible, activeIndex, markSeen])

  useEffect(() => {
    const container = containerRef.current
    if (!container || visible.length === 0) return
    const observer = new IntersectionObserver(
      (obsEntries) => {
        for (const obs of obsEntries) {
          if (obs.isIntersecting) {
            setActiveIndex(Number(obs.target.dataset.index))
          }
        }
      },
      { root: container, threshold: 0.6 }
    )
    for (const el of container.querySelectorAll('.card')) observer.observe(el)
    return () => observer.disconnect()
  }, [visible])

  const hasVisible = visible.length > 0
  useEffect(() => {
    if (hasVisible) containerRef.current?.focus()
  }, [hasVisible])

  if (status === 'loading') {
    return <div className="feed-status">Loading fresh blogs from Codeforces…</div>
  }
  if (status === 'error') {
    return <div className="feed-status">Couldn't reach the Codeforces API. Try refreshing.</div>
  }
  if (status === 'empty') {
    return <div className="feed-status">No blogs found right now.</div>
  }
  if (visible.length === 0) {
    return (
      <div className="feed-status">
        {loadingMore
          ? kw !== ''
            ? `Searching for blogs matching \u201c${kw}\u201d\u2026`
            : 'Finding blogs you haven\u2019t seen yet\u2026'
          : minScore != null || kw !== ''
            ? 'Every blog was filtered out. Try loosening the filters.'
            : 'Looking for more blogs\u2026'}
      </div>
    )
  }

  return (
    <div className="feed" ref={containerRef} tabIndex={-1}>
      {(error || removeError) && (
        <div className="toast" role="alert">
          <span>{error || removeError}</span>
          <button
            className="toast-close"
            onClick={() => {
              clearError()
              setRemoveError('')
            }}
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}
      {visible.map((entry, i) => (
        <div className="card" key={entry.id} data-index={i}>
          {entry.kind === 'problem' ? (
            <ProblemCard
              entry={entry}
              saved={Boolean(problems[entry.id]?.saved)}
              solved={Boolean(problems[entry.id]?.solved)}
              onSave={() => toggleProblemSave(entry)}
              onSolved={() => toggleProblemSolved(entry)}
            />
          ) : (
          <BlogCard
            entry={entry}
            author={authors[entry.authorHandle]}
            friends={friends}
            active={Math.abs(i - activeIndex) <= 1}
            liked={Boolean(likes[entry.id])}
            saved={Boolean(saves[entry.id])}
            onLike={() => toggleLike(entry)}
            onSave={() => toggleSave(entry)}
            onComments={() => setCommentsFor(entry)}
            onShare={() => setShareFor(entry)}
            onRemove={
              isAdmin
                ? () =>
                    removeBlog(entry).catch((err) =>
                      setRemoveError(`Couldn't remove: ${err.message}`)
                    )
                : null
            }
          />
          )}
        </div>
      ))}
      {loadingMore && <div className="card feed-more">Loading older blogs…</div>}
      {commentsFor && (
        <CommentsPanel
          entry={commentsFor}
          onClose={() => setCommentsFor(null)}
          onSignIn={onSignIn}
        />
      )}
      {shareFor && (
        <SharePanel
          entry={shareFor}
          friends={friends}
          groups={groups}
          myName={myName}
          onClose={() => setShareFor(null)}
          onSignIn={onSignIn}
        />
      )}
    </div>
  )
}
