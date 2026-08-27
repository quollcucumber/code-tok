import { useState } from 'react'
import { useComments } from '../hooks/useComments'
import { useAuth } from '../hooks/useAuth'
import { timeAgo } from '../lib/codeforces'

export default function CommentsPanel({ entry, onClose, onSignIn }) {
  const { user, configured } = useAuth()
  const { comments, error, canComment, addComment, deleteComment } = useComments(entry.id)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [sendError, setSendError] = useState('')

  async function submit(e) {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed) return
    setBusy(true)
    setSendError('')
    try {
      await addComment(trimmed)
      setText('')
    } catch (err) {
      setSendError(`Couldn't post: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="comments-backdrop" onClick={onClose}>
      <aside className="comments-panel" onClick={(e) => e.stopPropagation()}>
        <header className="comments-header">
          <h3 className="comments-title">Comments</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close comments">
            ✕
          </button>
        </header>
        <p className="comments-blog">{entry.title}</p>
        <div className="comments-list">
          {!configured ? (
            <p className="content-note">Comments need Firebase configured.</p>
          ) : error ? (
            <p className="auth-error">{error}</p>
          ) : comments == null ? (
            <p className="content-note">Loading comments…</p>
          ) : comments.length === 0 ? (
            <p className="content-note">No comments yet — be the first!</p>
          ) : (
            comments.map((c) => (
              <div className="comment" key={c.id}>
                <div className="comment-meta">
                  <span className="comment-name">{c.name}</span>
                  <span className="subtext">
                    {c.createdAt ? timeAgo(c.createdAt.seconds) : 'just now'}
                  </span>
                  {user && c.uid === user.uid && (
                    <button
                      className="comment-delete"
                      onClick={() => deleteComment(c.id)}
                      aria-label="Delete comment"
                    >
                      Delete
                    </button>
                  )}
                </div>
                <p className="comment-text">{c.text}</p>
              </div>
            ))
          )}
        </div>
        {canComment ? (
          <form className="comment-form" onSubmit={submit}>
            {sendError && <p className="auth-error">{sendError}</p>}
            <input
              placeholder="Add a comment…"
              value={text}
              maxLength={2000}
              onChange={(e) => setText(e.target.value)}
            />
            <button className="btn-primary" type="submit" disabled={busy || !text.trim()}>
              Post
            </button>
          </form>
        ) : configured ? (
          <button className="btn-ghost comments-signin" onClick={onSignIn}>
            Sign in to comment
          </button>
        ) : null}
      </aside>
    </div>
  )
}
