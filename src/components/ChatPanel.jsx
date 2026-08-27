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
import { chatPairId } from '../hooks/useFriends'
import { timeAgo } from '../lib/codeforces'

export default function ChatPanel({ friend, onBack, onClose }) {
  const { user } = useAuth()
  const [messages, setMessages] = useState(null)
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const bottomRef = useRef(null)

  const pairId = chatPairId(user.uid, friend.uid)

  useEffect(() => {
    return onSnapshot(
      query(collection(db, 'chats', pairId, 'messages'), orderBy('createdAt', 'asc')),
      (snap) => setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => setError(`Couldn't load messages: ${err.message}`)
    )
  }, [pairId])

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
      await addDoc(collection(db, 'chats', pairId, 'messages'), {
        from: user.uid,
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

  const name = friend.profile?.name || 'friend'

  return (
    <div className="comments-backdrop" onClick={onClose}>
      <aside className="comments-panel" onClick={(e) => e.stopPropagation()}>
        <header className="comments-header">
          <div className="chat-header-left">
            <button className="btn-link" onClick={onBack}>
              ← Friends
            </button>
            <h3 className="comments-title">{name}</h3>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close chat">
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
                <p className="chat-msg-text">{m.text}</p>
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
            placeholder={`Message ${name}…`}
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
