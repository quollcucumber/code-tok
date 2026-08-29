import { useState } from 'react'
import SavedBlogView from './SavedBlogView'
import { ratingColor } from '../lib/codeforces'

export default function SavedList({ reactions, problemsApi, friends, onSignIn, onBrowse }) {
  const [openId, setOpenId] = useState(null)
  const { saves, likes, toggleSave, toggleLike } = reactions
  const { problems, toggleProblemSave, toggleProblemSolved } = problemsApi
  const items = Object.entries(saves)
  const problemItems = Object.entries(problems).filter(([, p]) => p.saved)

  if (openId != null && saves[openId]) {
    return (
      <SavedBlogView
        blogId={openId}
        item={saves[openId]}
        friends={friends}
        liked={Boolean(likes[openId])}
        onLike={toggleLike}
        onSignIn={onSignIn}
        onBack={() => setOpenId(null)}
      />
    )
  }

  return (
    <div className="saved-view">
      <h2 className="saved-title">Saved blogs</h2>
      {items.length === 0 ? (
        <p className="content-note">
          Nothing saved yet — hit ☆ on a blog to bookmark it here.{' '}
          <button className="btn-link" onClick={onBrowse}>
            Browse the feed
          </button>
        </p>
      ) : (
        <ul className="saved-list">
          {items.map(([blogId, item]) => (
            <li className="saved-item" key={blogId}>
              <div className="saved-item-main">
                <button className="saved-item-title" onClick={() => setOpenId(blogId)}>
                  {item.title}
                </button>
                <span className="subtext">by {item.authorHandle}</span>
              </div>
              <button
                className="btn-ghost"
                onClick={() => toggleSave({ id: blogId, ...item })}
                aria-label="Remove from saved"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <h2 className="saved-title">Saved problems</h2>
      {problemItems.length === 0 ? (
        <p className="content-note">
          No problems saved yet — hit ☆ on a problem reel to bookmark it here.
        </p>
      ) : (
        <ul className="saved-list">
          {problemItems.map(([id, p]) => (
            <li className="saved-item" key={id}>
              <div className="saved-item-main">
                <a
                  className="saved-item-title"
                  href={p.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {p.contestId}
                  {p.index}. {p.name}
                </a>
                {p.rating != null && (
                  <span className="subtext" style={{ color: ratingColor(p.rating) }}>
                    ★ {p.rating}
                  </span>
                )}
              </div>
              <button
                className={`btn-ghost ${p.solved ? 'rail-btn-active' : ''}`}
                onClick={() => toggleProblemSolved({ id, ...p })}
                aria-pressed={Boolean(p.solved)}
              >
                {p.solved ? '✅ Solved' : 'Mark solved'}
              </button>
              <button
                className="btn-ghost"
                onClick={() => toggleProblemSave({ id, ...p })}
                aria-label="Remove from saved"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
