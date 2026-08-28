import { useState } from 'react'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../hooks/useAuth'
import { chatPairId } from '../hooks/useFriends'

export default function SharePanel({ entry, friends, groups, myName, onClose, onSignIn }) {
  const { user, configured } = useAuth()
  const [sent, setSent] = useState({})
  const [error, setError] = useState('')

  const blog = {
    id: entry.id,
    title: entry.title,
    authorHandle: entry.authorHandle,
    url: entry.url,
  }

  async function send(key, ref, extra) {
    setError('')
    try {
      await addDoc(ref, {
        from: user.uid,
        text: `📤 Shared a blog: ${entry.title}`,
        blog,
        createdAt: serverTimestamp(),
        ...extra,
      })
      setSent((prev) => ({ ...prev, [key]: true }))
    } catch (err) {
      setError(`Couldn't share: ${err.message}`)
    }
  }

  return (
    <div className="comments-backdrop" onClick={onClose}>
      <aside className="comments-panel" onClick={(e) => e.stopPropagation()}>
        <header className="comments-header">
          <h3 className="comments-title">Share</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close share">
            ✕
          </button>
        </header>
        <p className="comments-blog">{entry.title}</p>
        {error && <p className="auth-error">{error}</p>}
        <div className="comments-list friends-list">
          {!configured || !user ? (
            <p className="content-note">
              <button className="btn-link" onClick={onSignIn}>
                Sign in
              </button>{' '}
              to share blogs with friends.
            </p>
          ) : friends.length === 0 && groups.length === 0 ? (
            <p className="content-note">Add some friends first to share blogs with them!</p>
          ) : (
            <>
              {friends.map((f) => (
                <div className="friend-row" key={f.uid}>
                  <span className="friend-name">{f.profile?.name || '…'}</span>
                  <button
                    className="btn-primary friend-action"
                    disabled={Boolean(sent[f.uid])}
                    onClick={() =>
                      send(
                        f.uid,
                        collection(db, 'chats', chatPairId(user.uid, f.uid), 'messages')
                      )
                    }
                  >
                    {sent[f.uid] ? 'Sent ✓' : 'Send'}
                  </button>
                </div>
              ))}
              {groups.map((g) => (
                <div className="friend-row" key={g.id}>
                  <span className="friend-name">
                    {g.name} <span className="subtext">(group)</span>
                  </span>
                  <button
                    className="btn-primary friend-action"
                    disabled={Boolean(sent[g.id])}
                    onClick={() =>
                      send(g.id, collection(db, 'groups', g.id, 'messages'), {
                        fromName: myName || 'anonymous',
                      })
                    }
                  >
                    {sent[g.id] ? 'Sent ✓' : 'Send'}
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      </aside>
    </div>
  )
}
