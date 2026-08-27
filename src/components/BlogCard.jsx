import { useEffect, useState } from 'react'
import { fetchBlogContent, ratingColor, timeAgo } from '../lib/codeforces'
import { prepareBlogHtml } from '../lib/blogHtml'
import { useFriendLikes } from '../hooks/useFriends'

function friendLikeText(likers) {
  const names = likers.map((f) => f.profile?.name || 'a friend')
  if (names.length === 1) return `Liked by ${names[0]}`
  if (names.length === 2) return `Liked by ${names[0]} and ${names[1]}`
  return `Liked by ${names[0]} and ${names.length - 1} other friends`
}

export default function BlogCard({
  entry,
  author,
  friends,
  active,
  liked,
  saved,
  onLike,
  onSave,
  onComments,
}) {
  const [content, setContent] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!active || content) return
    let cancelled = false
    fetchBlogContent(entry.id)
      .then((html) => {
        if (!cancelled) setContent(prepareBlogHtml(html))
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
    }
  }, [active, content, entry.id])

  const color = ratingColor(author?.rating)
  const friendLikers = useFriendLikes(entry.id, friends, active)

  return (
    <article className="card-layout">
      <div className="card-inner">
        <header className="card-header">
          <a
            className="author"
            href={`https://codeforces.com/profile/${entry.authorHandle}`}
            target="_blank"
            rel="noreferrer"
          >
            {author?.avatar ? (
              <img className="avatar" src={author.avatar} alt="" />
            ) : (
              <div className="avatar avatar-fallback">{entry.authorHandle[0].toUpperCase()}</div>
            )}
            <div className="author-meta">
              <span className="handle" style={{ color }}>
                {entry.authorHandle}
              </span>
              <span className="subtext">
                {author?.rank ? `${author.rank} · ` : ''}
                {timeAgo(entry.creationTimeSeconds)}
              </span>
            </div>
          </a>
        </header>
        <h2 className="card-title">
          {entry.title}
          {entry.rewatch && <span className="rewatch-badge">Seen before</span>}
        </h2>
        {friendLikers.length > 0 && (
          <div className="friend-likes">
            {friendLikers.slice(0, 3).map((f) =>
              f.profile?.photo ? (
                <img className="avatar avatar-xs" src={f.profile.photo} alt="" key={f.uid} />
              ) : (
                <div className="avatar avatar-xs avatar-fallback" key={f.uid}>
                  {(f.profile?.name || '?')[0].toUpperCase()}
                </div>
              )
            )}
            <span className="friend-likes-text">❤️ {friendLikeText(friendLikers)}</span>
          </div>
        )}
        <div className="card-content">
          {content != null ? (
            <div className="blog-html" dangerouslySetInnerHTML={{ __html: content }} />
          ) : error ? (
            <p className="content-note">
              Couldn't load this blog.{' '}
              <a href={entry.url} target="_blank" rel="noreferrer">
                Read it on Codeforces
              </a>
            </p>
          ) : (
            <p className="content-note">Loading blog…</p>
          )}
        </div>
      </div>
      <aside className="action-rail">
        <button
          className={`rail-btn ${liked ? 'rail-btn-active' : ''}`}
          onClick={onLike}
          aria-label="Like"
        >
          <span className="rail-icon">{liked ? '❤️' : '🤍'}</span>
          <span className="rail-label">{Math.max(entry.rating + (liked ? 1 : 0), 0)}</span>
        </button>
        <button
          className={`rail-btn ${saved ? 'rail-btn-active' : ''}`}
          onClick={onSave}
          aria-label="Save"
        >
          <span className="rail-icon">{saved ? '⭐' : '☆'}</span>
          <span className="rail-label">{saved ? 'Saved' : 'Save'}</span>
        </button>
        <button className="rail-btn" onClick={onComments} aria-label="Comments">
          <span className="rail-icon">💬</span>
          <span className="rail-label">Chat</span>
        </button>
        <a className="rail-btn" href={entry.url} target="_blank" rel="noreferrer" aria-label="Open on Codeforces">
          <span className="rail-icon">↗️</span>
          <span className="rail-label">Open</span>
        </a>
      </aside>
    </article>
  )
}
