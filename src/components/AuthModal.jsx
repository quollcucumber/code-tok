import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'

export default function AuthModal({ onClose }) {
  const { signIn, signUp, signInWithGoogle, configured } = useAuth()
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function run(fn) {
    setError('')
    setBusy(true)
    try {
      await fn()
      onClose()
    } catch (err) {
      setError(err.message.replace('Firebase: ', ''))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <h2 className="modal-title">
          {mode === 'signin' ? 'Sign in to code-tok' : 'Join code-tok'}
        </h2>
        {!configured ? (
          <p className="modal-note">
            Firebase isn't configured yet. Copy <code>.env.example</code> to <code>.env</code> and
            fill in your Firebase project keys to enable accounts. Likes and saves still work
            locally in the meantime.
          </p>
        ) : (
          <form
            className="auth-form"
            onSubmit={(e) => {
              e.preventDefault()
              run(() =>
                mode === 'signin' ? signIn(email, password) : signUp(email, password, displayName)
              )
            }}
          >
            {mode === 'signup' && (
              <input
                placeholder="Display name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            )}
            <input
              type="email"
              placeholder="Email"
              value={email}
              required
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              required
              minLength={6}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && <p className="auth-error">{error}</p>}
            <button className="btn-primary" type="submit" disabled={busy}>
              {mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
            <button
              className="btn-google"
              type="button"
              disabled={busy}
              onClick={() => run(signInWithGoogle)}
            >
              Continue with Google
            </button>
            <button
              className="btn-link"
              type="button"
              onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
            >
              {mode === 'signin' ? 'New here? Create an account' : 'Have an account? Sign in'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
