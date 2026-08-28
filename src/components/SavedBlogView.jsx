import { useEffect, useState } from 'react'
import { fetchBlogContent } from '../lib/codeforces'
import { prepareBlogHtml } from '../lib/blogHtml'
import { useFriendLikes } from '../hooks/useFriends'
import CommentsPanel from './CommentsPanel'

function friendLikeText(likers) {
  const names = likers.map((f) => f.profile?.name || 'a friend')
  if (names.length === 1) return `Liked by ${names[0]}`
  if (names.length === 2) return `Liked by ${names[0]} and ${names[1]}`
  return `Liked by ${names[0]} and ${names.length - 1} other friends`
}

export default function SavedBlogView({
  blogId,
  item,
  friends,
  liked,
  onLike,
  onSignIn,
  onBack,
  backLabel = '← Saved blogs',
}) {
  const [content, setContent] = useState(null)
  const [error, setError] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const entry = { id: blogId, title: item.title, authorHandle: item.authorHandle, url: item.url }
  const friendLikers = useFriendLikes(blogId, friends, true)

  useEffect(() => {
    let cancelled = false
    fetchBlogContent(Number(blogId))
      .then((html) => {
        if (!cancelled) setContent(prepareBlogHtml(html))
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
    }
  }, [blogId])

  return (
    <div className="saved-view">
      <div className="saved-blog-bar">
        <button className="btn-ghost" onClick={onBack}>
          {backLabel}
        </button>
        <div className="saved-blog-actions">
          <button
            className={`btn-ghost ${liked ? 'rail-btn-active' : ''}`}
            onClick={() => onLike(entry)}
            aria-label="Like"
          >
            {liked ? '❤️ Liked' : '🤍 Like'}
          </button>
          <button className="btn-ghost" onClick={() => setShowComments(true)} aria-label="Comments">
            💬 Chat
          </button>
          <a className="btn-ghost" href={item.url} target="_blank" rel="noreferrer">
            Codeforces ↗
          </a>
        </div>
      </div>
      <h2 className="saved-title">{item.title}</h2>
      <span className="subtext">by {item.authorHandle}</span>
      {friendLikers.length > 0 && (
        <div className="friend-likes">
          <span className="friend-likes-text">❤️ {friendLikeText(friendLikers)}</span>
        </div>
      )}
      {content != null ? (
        <div className="blog-html" dangerouslySetInnerHTML={{ __html: content }} />
      ) : error ? (
        <p className="content-note">
          Couldn't load this blog.{' '}
          <a href={item.url} target="_blank" rel="noreferrer">
            Read it on Codeforces
          </a>
        </p>
      ) : (
        <p className="content-note">Loading blog…</p>
      )}
      {showComments && (
        <CommentsPanel entry={entry} onClose={() => setShowComments(false)} onSignIn={onSignIn} />
      )}
    </div>
  )
}
