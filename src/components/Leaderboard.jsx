import { useEffect, useState } from 'react'
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../hooks/useAuth'
import { useAdminUids } from '../hooks/useAdmin'
import AdminBadge from './AdminBadge'

const MEDALS = ['🥇', '🥈', '🥉']

const BOARDS = {
  seen: { field: 'seenCount', label: 'Reels read', empty: 'No reels read yet — start scrolling!' },
  solved: {
    field: 'solvedCount',
    label: 'Problems solved',
    empty: 'No problems solved yet — mark one solved on a problem reel!',
  },
}

export default function Leaderboard({ onSignIn }) {
  const { user, configured } = useAuth()
  const [board, setBoard] = useState('seen')
  const [rows, setRows] = useState(null)
  const adminUids = useAdminUids()
  const [error, setError] = useState(false)
  const { field, empty } = BOARDS[board]

  useEffect(() => {
    if (!configured) return
    let cancelled = false
    setRows(null)
    setError(false)
    Promise.all([
      getDocs(query(collection(db, 'profiles'), orderBy(field, 'desc'), limit(25))),
      getDocs(collection(db, 'bans')).catch(() => null),
    ])
      .then(([snap, banSnap]) => {
        if (cancelled) return
        const bannedUids = new Set((banSnap?.docs || []).map((d) => d.id))
        setRows(
          snap.docs
            .map((d) => ({ uid: d.id, ...d.data() }))
            .filter((p) => (p[field] || 0) > 0 && !bannedUids.has(p.uid))
        )
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
    }
  }, [configured, field])

  return (
    <div className="saved-view">
      <h2 className="saved-title">🏆 Leaderboard</h2>
      <div className="board-tabs">
        {Object.entries(BOARDS).map(([key, b]) => (
          <button
            key={key}
            className={`btn-ghost ${board === key ? 'board-tab-active' : ''}`}
            onClick={() => setBoard(key)}
            aria-pressed={board === key}
          >
            {b.label}
          </button>
        ))}
      </div>
      <p className="subtext">Ranked by {BOARDS[board].label.toLowerCase()}</p>
      {!configured ? (
        <p className="content-note">The leaderboard needs Firebase configured.</p>
      ) : error ? (
        <p className="content-note">Couldn't load the leaderboard. Try refreshing.</p>
      ) : rows == null ? (
        <p className="content-note">Loading leaderboard…</p>
      ) : rows.length === 0 ? (
        <p className="content-note">{empty}</p>
      ) : (
        <ol className="board-list">
          {rows.map((p, i) => (
            <li
              className={`board-row ${user && p.uid === user.uid ? 'board-row-me' : ''}`}
              key={p.uid}
            >
              <span className="board-rank">{MEDALS[i] || i + 1}</span>
              {p.photo ? (
                <img className="avatar avatar-sm" src={p.photo} alt="" />
              ) : (
                <div className="avatar avatar-sm avatar-fallback">
                  {(p.name || '?')[0].toUpperCase()}
                </div>
              )}
              <span className="board-name">
                {p.name || 'anonymous'}
                <AdminBadge show={adminUids.has(p.uid)} />
                {user && p.uid === user.uid ? ' (you)' : ''}
              </span>
              <span className="board-count">{p[field]}</span>
            </li>
          ))}
        </ol>
      )}
      {configured && !user && (
        <p className="content-note">
          <button className="btn-link" onClick={onSignIn}>
            Sign in
          </button>{' '}
          to appear on the leaderboard — activity while signed out only counts locally.
        </p>
      )}
    </div>
  )
}
