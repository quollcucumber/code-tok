import { useState } from 'react'
import { AuthProvider } from './hooks/useAuth'
import TopBar from './components/TopBar'
import Feed from './components/Feed'
import AuthModal from './components/AuthModal'
import './App.css'

export default function App() {
  const [showAuth, setShowAuth] = useState(false)

  return (
    <AuthProvider>
      <div className="app">
        <TopBar onSignInClick={() => setShowAuth(true)} />
        <Feed />
        {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      </div>
    </AuthProvider>
  )
}
