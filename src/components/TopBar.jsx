import { useAuth } from '../hooks/useAuth'

export default function TopBar({ onSignInClick }) {
  const { user, logOut } = useAuth()

  return (
    <header className="topbar">
      <div className="logo">
        code<span className="logo-accent">-tok</span>
      </div>
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
    </header>
  )
}
