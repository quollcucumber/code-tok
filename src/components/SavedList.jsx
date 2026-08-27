import { useState } from 'react'
import SavedBlogView from './SavedBlogView'

export default function SavedList({ reactions, friends, onSignIn, onBrowse }) {
  const [openId, setOpenId] = useState(null)
  const { saves, likes, toggleSave, toggleLike } = reactions
  const items = Object.entries(saves)

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
    </div>
  )
}
