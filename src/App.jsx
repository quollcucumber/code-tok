import { useEffect, useState } from 'react'
import { AuthProvider } from './hooks/useAuth'
import { useReactions } from './hooks/useReactions'
import TopBar from './components/TopBar'
import Feed from './components/Feed'
import SavedList from './components/SavedList'
import AuthModal from './components/AuthModal'
import './App.css'

const FILTER_KEY = 'codetok-min-score'

function readMinScore() {
  const raw = localStorage.getItem(FILTER_KEY)
  if (raw == null || raw === '') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

function Main() {
  const [showAuth, setShowAuth] = useState(false)
  const [view, setView] = useState('feed')
  const [minScore, setMinScore] = useState(readMinScore)
  const reactions = useReactions()

  useEffect(() => {
    if (minScore == null) localStorage.removeItem(FILTER_KEY)
    else localStorage.setItem(FILTER_KEY, String(minScore))
  }, [minScore])

  return (
    <div className="app">
      <TopBar
        onSignInClick={() => setShowAuth(true)}
        view={view}
        onViewChange={setView}
        minScore={minScore}
        onMinScoreChange={setMinScore}
      />
      {view === 'feed' ? (
        <Feed reactions={reactions} minScore={minScore} onSignIn={() => setShowAuth(true)} />
      ) : (
        <SavedList
          saves={reactions.saves}
          toggleSave={reactions.toggleSave}
          onBrowse={() => setView('feed')}
        />
      )}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Main />
    </AuthProvider>
  )
}
