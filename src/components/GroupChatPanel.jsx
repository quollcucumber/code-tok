import { useEffect, useRef, useState } from 'react'
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../hooks/useAuth'
import { timeAgo } from '../lib/codeforces'

export default function GroupChatPanel({ group, myName, onBack, onClose, onOpenBlog }) {
  const { user } = useAuth()
  const [messages, setMessages] = useState(null)
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    return onSnapshot(
      query(collection(db, 'groups', group.id, 'messages'), orderBy('createdAt', 'asc')),
      (snap) => setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => setError(`Couldn't load messages: ${err.message}`)
    )
  }, [group.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages])

  async function submit(e) {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed) return
    setBusy(true)
    setError('')
    try {
      await addDoc(collection(db, 'groups', group.id, 'messages'), {
        from: user.uid,
        fromName: myName || 'anonymous',
        text: trimmed,
        createdAt: serverTimestamp(),
      })
      setText('')
    } catch (err) {
      setError(`Couldn't send: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="comments-backdrop" onClick={onClose}>
      <aside className="comments-panel" onClick={(e) => e.stopPropagation()}>
        <header className="comments-header">
          <div className="chat-header-left">
            <button className="btn-link" onClick={onBack}>
              ← Friends
            </button>
            <h3 className="comments-title">
              {group.name} <span className="subtext">({group.members.length})</span>
            </h3>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close group chat">
            ✕
          </button>
        </header>
        <div className="comments-list chat-list">
          {error ? (
            <p className="auth-error">{error}</p>
          ) : messages == null ? (
            <p className="content-note">Loading messages…</p>
          ) : messages.length === 0 ? (
            <p className="content-note">No messages yet — say hi!</p>
          ) : (
            messages.map((m) => (
              <div
                className={`chat-msg ${m.from === user.uid ? 'chat-msg-mine' : ''}`}
                key={m.id}
              >
                {m.from !== user.uid && <span className="chat-msg-name">{m.fromName}</span>}
                {m.blog ? (
                  <button className="chat-share" onClick={() => onOpenBlog(m.blog)}>
                    <span className="chat-share-title">📄 {m.blog.title}</span>
                    <span className="subtext">by {m.blog.authorHandle} — tap to read</span>
                  </button>
                ) : (
                  <p className="chat-msg-text">{m.text}</p>
                )}
                <span className="subtext">
                  {m.createdAt ? timeAgo(m.createdAt.seconds) : 'sending…'}
                </span>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
        <form className="comment-form" onSubmit={submit}>
          <input
            placeholder={`Message ${group.name}…`}
            value={text}
            maxLength={2000}
            onChange={(e) => setText(e.target.value)}
          />
          <button className="btn-primary" type="submit" disabled={busy || !text.trim()}>
            Send
          </button>
        </form>
      </aside>
    </div>
  )
}
