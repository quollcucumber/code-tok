import { useEffect, useRef, useState } from 'react'
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../hooks/useAuth'
import { timeAgo } from '../lib/codeforces'

export default function GroupChatPanel({
  group,
  myName,
  friends,
  addMember,
  leaveGroup,
  onBack,
  onClose,
  onOpenBlog,
}) {
  const { user } = useAuth()
  const [messages, setMessages] = useState(null)
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [showMembers, setShowMembers] = useState(false)
  const [memberProfiles, setMemberProfiles] = useState({})
  const [memberError, setMemberError] = useState('')
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

  useEffect(() => {
    for (const uid of group.members) {
      if (memberProfiles[uid] !== undefined) continue
      setMemberProfiles((prev) => (prev[uid] !== undefined ? prev : { ...prev, [uid]: null }))
      getDoc(doc(db, 'profiles', uid))
        .then((snap) => {
          if (snap.exists()) setMemberProfiles((prev) => ({ ...prev, [uid]: snap.data() }))
        })
        .catch(() => {})
    }
  }, [group.members, memberProfiles])

  const addable = friends.filter((f) => !group.members.includes(f.uid))

  async function handleAdd(otherUid) {
    setMemberError('')
    try {
      await addMember(group.id, otherUid)
    } catch (err) {
      setMemberError(`Couldn't add: ${err.message}`)
    }
  }

  async function handleLeave() {
    setMemberError('')
    try {
      await leaveGroup(group.id)
      onBack()
    } catch (err) {
      setMemberError(`Couldn't leave: ${err.message}`)
    }
  }

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
            <h3 className="comments-title">{group.name}</h3>
            <button
              className="btn-link"
              onClick={() => setShowMembers((v) => !v)}
              aria-expanded={showMembers}
            >
              👥 {group.members.length}
            </button>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close group chat">
            ✕
          </button>
        </header>
        {showMembers && (
          <div className="group-members">
            <h4 className="friends-section-title">Members</h4>
            {group.members.map((uid) => {
              const p = memberProfiles[uid]
              return (
                <div className="friend-row" key={uid}>
                  {p?.photo ? (
                    <img className="avatar avatar-sm" src={p.photo} alt="" />
                  ) : (
                    <div className="avatar avatar-sm avatar-fallback">
                      {(p?.name || '?')[0].toUpperCase()}
                    </div>
                  )}
                  <span className="friend-name">
                    {uid === user.uid ? 'You' : p?.name || '…'}
                    {uid === group.createdBy && <span className="subtext"> · creator</span>}
                  </span>
                </div>
              )
            })}
            {addable.length > 0 && (
              <>
                <h4 className="friends-section-title">Add a friend</h4>
                {addable.map((f) => (
                  <div className="friend-row" key={f.uid}>
                    {f.profile?.photo ? (
                      <img className="avatar avatar-sm" src={f.profile.photo} alt="" />
                    ) : (
                      <div className="avatar avatar-sm avatar-fallback">
                        {(f.profile?.name || '?')[0].toUpperCase()}
                      </div>
                    )}
                    <span className="friend-name">{f.profile?.name || '…'}</span>
                    <button className="btn-primary friend-action" onClick={() => handleAdd(f.uid)}>
                      Add
                    </button>
                  </div>
                ))}
              </>
            )}
            {memberError && <p className="auth-error">{memberError}</p>}
            <button className="btn-ghost group-leave" onClick={handleLeave}>
              Leave group
            </button>
          </div>
        )}
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
