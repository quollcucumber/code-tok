import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'

export default function TopBar({
  onSignInClick,
  onProfileClick,
  onFriendsClick,
  profile,
  friendRequestCount,
  view,
  onViewChange,
  minScore,
  onMinScoreChange,
  theme,
  onThemeToggle,
  hideAnnouncements,
  onHideAnnouncementsChange,
  keyword,
  onKeywordChange,
  problemMinRating,
  onProblemMinRatingChange,
  problemMaxRating,
  onProblemMaxRatingChange,
  isAdmin,
  onAdminClick,
}) {
  const { user, logOut } = useAuth()
  const [showFilter, setShowFilter] = useState(false)
  const hasProblemRange = problemMinRating != null || problemMaxRating != null

  return (
    <header className="topbar">
      <div className="logo">
        code<span className="logo-accent">-tok</span>
      </div>
      <div className="topbar-actions">
        {view === 'feed' && (
          <div className="filter-wrap">
            <button
              className={`btn-ghost ${minScore != null || hideAnnouncements || keyword || hasProblemRange ? 'btn-ghost-active' : ''}`}
              onClick={() => setShowFilter((v) => !v)}
            >
              Filter{minScore != null ? ` ≥ ${minScore}` : ''}
              {keyword ? ` · “${keyword}”` : ''}
              {hasProblemRange
                ? ` · 💡 ${problemMinRating ?? ''}–${problemMaxRating ?? ''}`
                : ''}
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
                <label className="filter-label" htmlFor="keyword-filter">
                  Only show blogs matching
                </label>
                <input
                  id="keyword-filter"
                  type="text"
                  className="filter-input"
                  placeholder="keyword, e.g. dp"
                  value={keyword}
                  onChange={(e) => onKeywordChange(e.target.value)}
                />
                <label className="filter-label" htmlFor="problem-min-rating">
                  Problem rating range
                </label>
                <div className="filter-range">
                  <input
                    id="problem-min-rating"
                    type="number"
                    className="filter-input"
                    placeholder="min, e.g. 800"
                    step="100"
                    value={problemMinRating ?? ''}
                    onChange={(e) =>
                      onProblemMinRatingChange(
                        e.target.value === '' ? null : Number(e.target.value)
                      )
                    }
                  />
                  <span className="filter-range-sep">–</span>
                  <input
                    id="problem-max-rating"
                    type="number"
                    className="filter-input"
                    placeholder="max, e.g. 1600"
                    step="100"
                    value={problemMaxRating ?? ''}
                    onChange={(e) =>
                      onProblemMaxRatingChange(
                        e.target.value === '' ? null : Number(e.target.value)
                      )
                    }
                  />
                </div>
                <p className="filter-hint">
                  Problem reels only show problems with a difficulty rating in this range.
                </p>
                <label className="filter-check">
                  <input
                    type="checkbox"
                    checked={hideAnnouncements}
                    onChange={(e) => onHideAnnouncementsChange(e.target.checked)}
                  />
                  Hide announcement blogs
                </label>
                <button
                  className="btn-link"
                  onClick={() => {
                    onMinScoreChange(null)
                    onKeywordChange('')
                    onProblemMinRatingChange(null)
                    onProblemMaxRatingChange(null)
                  }}
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>
        )}
        <button
          className="btn-ghost"
          onClick={onThemeToggle}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
        <button
          className={`btn-ghost ${view === 'saved' ? 'btn-ghost-active' : ''}`}
          onClick={() => onViewChange(view === 'saved' ? 'feed' : 'saved')}
        >
          {view === 'saved' ? 'Feed' : (
            <>
              ⭐<span className="btn-label"> Saved</span>
            </>
          )}
        </button>
        <button
          className={`btn-ghost ${view === 'board' ? 'btn-ghost-active' : ''}`}
          onClick={() => onViewChange(view === 'board' ? 'feed' : 'board')}
          aria-label="Leaderboard"
        >
          {view === 'board' ? 'Feed' : '🏆'}
        </button>
        {isAdmin && (
          <button className="btn-ghost" onClick={onAdminClick} aria-label="Admin">
            🛡️
          </button>
        )}
        {user ? (
          <div className="topbar-user">
            <button className="btn-ghost topbar-friends" onClick={onFriendsClick}>
              👥<span className="btn-label"> Friends</span>
              {friendRequestCount > 0 && (
                <span className="badge">{friendRequestCount}</span>
              )}
            </button>
            <button className="topbar-profile" onClick={onProfileClick} aria-label="Edit profile">
              {profile?.photo ? (
                <img className="avatar avatar-sm" src={profile.photo} alt="" />
              ) : (
                <div className="avatar avatar-sm avatar-fallback">
                  {(profile?.name || user.displayName || user.email || '?')[0].toUpperCase()}
                </div>
              )}
              <span className="topbar-name">{profile?.name || user.displayName || user.email}</span>
            </button>
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
