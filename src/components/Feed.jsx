import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchOlderBlogEntries, fetchRecentBlogEntries, fetchUsers, isAnnouncement } from '../lib/codeforces'
import { useSeen } from '../hooks/useSeen'
import BlogCard from './BlogCard'
import CommentsPanel from './CommentsPanel'

const LOAD_BATCH = 8
const LOAD_AHEAD = 10

export default function Feed({ reactions, friends, minScore, hideAnnouncements, onSignIn }) {
  const [entries, setEntries] = useState([])
  const [authors, setAuthors] = useState({})
  const [activeIndex, setActiveIndex] = useState(0)
  const [status, setStatus] = useState('loading')
  const [loadingMore, setLoadingMore] = useState(false)
  const [commentsFor, setCommentsFor] = useState(null)
  const containerRef = useRef(null)
  const knownIdsRef = useRef(new Set())
  const rewatchPoolRef = useRef([])
  const nextBeforeIdRef = useRef(null)
  const loadingMoreRef = useRef(false)
  const { isSeen, markSeen, loaded: seenLoaded } = useSeen()
  const { likes, saves, error, clearError, toggleLike, toggleSave } = reactions

  const visible = useMemo(
    () =>
      entries.filter(
        (e) =>
          (minScore == null || e.rating >= minScore) &&
          (!hideAnnouncements || !isAnnouncement(e))
      ),
    [entries, minScore, hideAnnouncements]
  )

  const addEntries = useCallback(async (list) => {
    const fresh = list.filter((e) => !knownIdsRef.current.has(e.id))
    if (fresh.length === 0) return
    for (const e of fresh) knownIdsRef.current.add(e.id)
    setEntries((prev) => [...prev, ...fresh])
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

  useEffect(() => {
    if (status !== 'ready') return
    if (visible.length - activeIndex <= 2 && rewatchPoolRef.current.length > 0) {
      addEntries(rewatchPoolRef.current.splice(0, 3))
    }
  }, [status, activeIndex, visible.length, addEntries])

  useEffect(() => {
    const entry = visible[activeIndex]
    if (entry) markSeen(entry.id)
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
          ? 'Finding blogs you haven\u2019t seen yet\u2026'
          : minScore != null
            ? `Every blog was filtered out (score \u2265 ${minScore}). Try lowering the filter.`
            : 'Looking for more blogs\u2026'}
      </div>
    )
  }

  return (
    <div className="feed" ref={containerRef} tabIndex={-1}>
      {error && (
        <div className="toast" role="alert">
          <span>{error}</span>
          <button className="toast-close" onClick={clearError} aria-label="Dismiss">
            ✕
          </button>
        </div>
      )}
      {visible.map((entry, i) => (
        <div className="card" key={entry.id} data-index={i}>
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
          />
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
    </div>
  )
}
