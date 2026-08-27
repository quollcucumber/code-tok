import { useEffect, useRef, useState } from 'react'
import { fetchRecentBlogEntries, fetchUsers } from '../lib/codeforces'
import { useReactions } from '../hooks/useReactions'
import BlogCard from './BlogCard'

export default function Feed() {
  const [entries, setEntries] = useState([])
  const [authors, setAuthors] = useState({})
  const [activeIndex, setActiveIndex] = useState(0)
  const [status, setStatus] = useState('loading')
  const containerRef = useRef(null)
  const { likes, saves, toggleLike, toggleSave } = useReactions()

  useEffect(() => {
    let cancelled = false
    fetchRecentBlogEntries()
      .then(async (list) => {
        if (cancelled) return
        setEntries(list)
        setStatus(list.length ? 'ready' : 'empty')
        const users = await fetchUsers(list.map((e) => e.authorHandle))
        if (!cancelled) setAuthors(users)
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container || entries.length === 0) return
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
  }, [entries])

  if (status === 'loading') {
    return <div className="feed-status">Loading fresh blogs from Codeforces…</div>
  }
  if (status === 'error') {
    return <div className="feed-status">Couldn't reach the Codeforces API. Try refreshing.</div>
  }
  if (status === 'empty') {
    return <div className="feed-status">No blogs found right now.</div>
  }

  return (
    <div className="feed" ref={containerRef}>
      {entries.map((entry, i) => (
        <div className="card" key={entry.id} data-index={i}>
          <BlogCard
            entry={entry}
            author={authors[entry.authorHandle]}
            active={Math.abs(i - activeIndex) <= 1}
            liked={Boolean(likes[entry.id])}
            saved={Boolean(saves[entry.id])}
            onLike={() => toggleLike(entry)}
            onSave={() => toggleSave(entry)}
          />
        </div>
      ))}
    </div>
  )
}
