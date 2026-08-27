import { useEffect, useState } from 'react'
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../hooks/useAuth'

const MEDALS = ['🥇', '🥈', '🥉']

export default function Leaderboard({ onSignIn }) {
  const { user, configured } = useAuth()
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!configured) return
    let cancelled = false
    getDocs(query(collection(db, 'profiles'), orderBy('seenCount', 'desc'), limit(25)))
      .then((snap) => {
        if (cancelled) return
        setRows(
          snap.docs
            .map((d) => ({ uid: d.id, ...d.data() }))
            .filter((p) => (p.seenCount || 0) > 0)
        )
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
    }
  }, [configured])

  return (
    <div className="saved-view">
      <h2 className="saved-title">🏆 Leaderboard</h2>
      <p className="subtext">Ranked by reels read</p>
      {!configured ? (
        <p className="content-note">The leaderboard needs Firebase configured.</p>
      ) : error ? (
        <p className="content-note">Couldn't load the leaderboard. Try refreshing.</p>
      ) : rows == null ? (
        <p className="content-note">Loading leaderboard…</p>
      ) : rows.length === 0 ? (
        <p className="content-note">No reels read yet — start scrolling!</p>
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
                {user && p.uid === user.uid ? ' (you)' : ''}
              </span>
              <span className="board-count">{p.seenCount}</span>
            </li>
          ))}
        </ol>
      )}
      {configured && !user && (
        <p className="content-note">
          <button className="btn-link" onClick={onSignIn}>
            Sign in
          </button>{' '}
          to appear on the leaderboard — reels you read while signed out only count locally.
        </p>
      )}
    </div>
  )
}
