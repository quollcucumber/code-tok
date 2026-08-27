import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'

export default function TopBar({ onSignInClick, view, onViewChange, minScore, onMinScoreChange }) {
  const { user, logOut } = useAuth()
  const [showFilter, setShowFilter] = useState(false)

  return (
    <header className="topbar">
      <div className="logo">
        code<span className="logo-accent">-tok</span>
      </div>
      <div className="topbar-actions">
        {view === 'feed' && (
          <div className="filter-wrap">
            <button
              className={`btn-ghost ${minScore != null ? 'btn-ghost-active' : ''}`}
              onClick={() => setShowFilter((v) => !v)}
            >
              Filter{minScore != null ? ` ≥ ${minScore}` : ''}
            </button>
            {showFilter && (
              <div className="filter-menu">
                <label className="filter-label" htmlFor="min-score">
                  Hide blogs with score below
                </label>
                <input
                  id="min-score"
                  type="number"
                  className="filter-input"
                  placeholder="e.g. 0"
                  value={minScore ?? ''}
                  onChange={(e) =>
                    onMinScoreChange(e.target.value === '' ? null : Number(e.target.value))
                  }
                />
                <p className="filter-hint">
                  Score is upvotes minus downvotes, so 0 hides blogs with more downvotes than
                  upvotes.
                </p>
                <button className="btn-link" onClick={() => onMinScoreChange(null)}>
                  Clear filter
                </button>
              </div>
            )}
          </div>
        )}
        <button
          className={`btn-ghost ${view === 'saved' ? 'btn-ghost-active' : ''}`}
          onClick={() => onViewChange(view === 'saved' ? 'feed' : 'saved')}
        >
          {view === 'saved' ? 'Feed' : '⭐ Saved'}
        </button>
        {user ? (
          <div className="topbar-user">
            <span className="topbar-name">{user.displayName || user.email}</span>
            <button className="btn-ghost" onClick={logOut}>
              Sign out
            </button>
          </div>
        ) : (
          <button className="btn-ghost" onClick={onSignInClick}>
            Sign in
          </button>
        )}
      </div>
    </header>
  )
}
