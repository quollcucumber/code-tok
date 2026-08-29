import { useEffect, useState } from 'react'
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../hooks/useAuth'

export default function AdminPanel({ onClose }) {
  const { user } = useAuth()
  const [users, setUsers] = useState(null)
  const [bans, setBans] = useState({})
  const [removed, setRemoved] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    Promise.all([
      getDocs(collection(db, 'profiles')),
      getDocs(collection(db, 'bans')),
      getDocs(collection(db, 'removedBlogs')),
    ])
      .then(([profileSnap, banSnap, removedSnap]) => {
        if (cancelled) return
        setUsers(
          profileSnap.docs
            .map((d) => ({ uid: d.id, ...d.data() }))
            .sort((a, b) => (b.seenCount || 0) - (a.seenCount || 0))
        )
        setBans(Object.fromEntries(banSnap.docs.map((d) => [d.id, true])))
        setRemoved(removedSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
      })
      .catch((err) => {
        if (!cancelled) setError(`Couldn't load admin data: ${err.message}`)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function ban(u) {
    setError('')
    try {
      await setDoc(doc(db, 'bans', u.uid), {
        name: u.name || null,
        email: u.email || null,
        createdAt: serverTimestamp(),
      })
      setBans((prev) => ({ ...prev, [u.uid]: true }))
    } catch (err) {
      setError(`Couldn't ban: ${err.message}`)
    }
  }

  async function unban(u) {
    setError('')
    try {
      await deleteDoc(doc(db, 'bans', u.uid))
      setBans((prev) => {
        const next = { ...prev }
        delete next[u.uid]
        return next
      })
    } catch (err) {
      setError(`Couldn't unban: ${err.message}`)
    }
  }

  async function restore(blogId) {
    setError('')
    try {
      await deleteDoc(doc(db, 'removedBlogs', blogId))
      setRemoved((prev) => prev.filter((b) => b.id !== blogId))
    } catch (err) {
      setError(`Couldn't restore: ${err.message}`)
    }
  }

  const bannedCount = Object.keys(bans).length
  const totalReels = (users || []).reduce((sum, u) => sum + (u.seenCount || 0), 0)

  return (
    <div className="comments-backdrop" onClick={onClose}>
      <aside className="comments-panel admin-panel" onClick={(e) => e.stopPropagation()}>
        <header className="comments-header">
          <h3 className="comments-title">🛡️ Admin</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close admin">
            ✕
          </button>
        </header>
        {error && <p className="auth-error">{error}</p>}
        {users == null ? (
          <p className="content-note">Loading users…</p>
        ) : (
          <>
            <div className="admin-stats">
              <span>{users.length} users</span>
              <span>{totalReels} reels read</span>
              <span>{bannedCount} banned</span>
              <span>{removed.length} blogs removed</span>
            </div>
            {removed.length > 0 && (
              <div className="comments-list friends-list admin-removed">
                {removed.map((b) => (
                  <div className="friend-row" key={b.id}>
                    <span className="friend-name admin-user">
                      {b.title || `Blog #${b.id}`}
                      <span className="subtext">by {b.authorHandle || 'unknown'} · removed</span>
                    </span>
                    <button className="btn-primary friend-action" onClick={() => restore(b.id)}>
                      Restore
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="comments-list friends-list">
              {users.map((u) => (
                <div className="friend-row" key={u.uid}>
                  {u.photo ? (
                    <img className="avatar avatar-sm" src={u.photo} alt="" />
                  ) : (
                    <div className="avatar avatar-sm avatar-fallback">
                      {(u.name || '?')[0].toUpperCase()}
                    </div>
                  )}
                  <span className="friend-name admin-user">
                    {u.name || 'anonymous'}
                    <span className="subtext">
                      {u.email || 'no email'} · {u.seenCount || 0} reels
                      {bans[u.uid] ? ' · BANNED' : ''}
                    </span>
                  </span>
                  {u.uid !== user.uid &&
                    (bans[u.uid] ? (
                      <button className="btn-primary friend-action" onClick={() => unban(u)}>
                        Unban
                      </button>
                    ) : (
                      <button className="btn-ghost friend-action" onClick={() => ban(u)}>
                        Ban
                      </button>
                    ))}
                </div>
              ))}
            </div>
          </>
        )}
      </aside>
    </div>
  )
}
