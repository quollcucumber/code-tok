import { useEffect, useRef, useState } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../hooks/useAuth'
import { useAdminUids } from '../hooks/useAdmin'
import AdminBadge from './AdminBadge'
import { chatPairId } from '../hooks/useFriends'
import { IMAGE_PLACEHOLDER, fileToChatImage } from '../hooks/useProfile'
import { timeAgo } from '../lib/codeforces'

export default function ChatPanel({ friend, onBack, onClose, onOpenBlog }) {
  const { user } = useAuth()
  const adminUids = useAdminUids()
  const [messages, setMessages] = useState(null)
  const [text, setText] = useState('')
  const [image, setImage] = useState(null)
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

  async function pickImage(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError('')
    try {
      setImage(await fileToChatImage(file))
    } catch (err) {
      setError(err.message)
    }
  }

  async function submit(e) {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed && !image) return
    setBusy(true)
    setError('')
    try {
      const msg = {
        from: user.uid,
        text: trimmed || IMAGE_PLACEHOLDER,
        createdAt: serverTimestamp(),
      }
      if (image) msg.image = image
      await addDoc(collection(db, 'chats', pairId, 'messages'), msg)
      setText('')
      setImage(null)
    } catch (err) {
      setError(`Couldn't send: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  async function deleteMessage(id) {
    setError('')
    try {
      await deleteDoc(doc(db, 'chats', pairId, 'messages', id))
    } catch (err) {
      setError(`Couldn't delete: ${err.message}`)
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
            <h3 className="comments-title">
              {name}
              <AdminBadge show={adminUids.has(friend.uid)} />
            </h3>
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
                {m.blog ? (
                  <button className="chat-share" onClick={() => onOpenBlog(m.blog)}>
                    <span className="chat-share-title">📄 {m.blog.title}</span>
                    <span className="subtext">by {m.blog.authorHandle} — tap to read</span>
                  </button>
                ) : (
                  <>
                    {m.image && <img className="chat-image" src={m.image} alt="" />}
                    {(!m.image || m.text !== IMAGE_PLACEHOLDER) && (
                      <p className="chat-msg-text">{m.text}</p>
                    )}
                  </>
                )}
                <span className="subtext">
                  {m.createdAt ? timeAgo(m.createdAt.seconds) : 'sending…'}
                  {m.from === user.uid && (
                    <button
                      className="comment-delete"
                      onClick={() => deleteMessage(m.id)}
                      aria-label="Delete message"
                    >
                      Delete
                    </button>
                  )}
                </span>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
        {image && (
          <div className="chat-image-preview">
            <img src={image} alt="" />
            <button className="btn-link" type="button" onClick={() => setImage(null)}>
              ✕ Remove
            </button>
          </div>
        )}
        <form className="comment-form" onSubmit={submit}>
          <label className="btn-ghost chat-image-btn" title="Send an image">
            📷
            <input type="file" accept="image/*" onChange={pickImage} hidden />
          </label>
          <input
            placeholder={`Message ${name}…`}
            value={text}
            maxLength={2000}
            onChange={(e) => setText(e.target.value)}
          />
          <button
            className="btn-primary"
            type="submit"
            disabled={busy || (!text.trim() && !image)}
          >
            Send
          </button>
        </form>
      </aside>
    </div>
  )
}
