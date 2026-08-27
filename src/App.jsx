import { useEffect, useState } from 'react'
import { AuthProvider } from './hooks/useAuth'
import { useReactions } from './hooks/useReactions'
import { useFriends } from './hooks/useFriends'
import { useProfile } from './hooks/useProfile'
import TopBar from './components/TopBar'
import Feed from './components/Feed'
import SavedList from './components/SavedList'
import AuthModal from './components/AuthModal'
import FriendsPanel from './components/FriendsPanel'
import ChatPanel from './components/ChatPanel'
import ProfileModal from './components/ProfileModal'
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
  const [showProfile, setShowProfile] = useState(false)
  const [showFriends, setShowFriends] = useState(false)
  const [chatFriend, setChatFriend] = useState(null)
  const [view, setView] = useState('feed')
  const [minScore, setMinScore] = useState(readMinScore)
  const reactions = useReactions()
  const friendsApi = useFriends()
  const { profile, saveProfile } = useProfile()

  useEffect(() => {
    if (minScore == null) localStorage.removeItem(FILTER_KEY)
    else localStorage.setItem(FILTER_KEY, String(minScore))
  }, [minScore])

  return (
    <div className="app">
      <TopBar
        onSignInClick={() => setShowAuth(true)}
        onProfileClick={() => setShowProfile(true)}
        onFriendsClick={() => setShowFriends(true)}
        profile={profile}
        friendRequestCount={friendsApi.incoming.length}
        view={view}
        onViewChange={setView}
        minScore={minScore}
        onMinScoreChange={setMinScore}
      />
      {view === 'feed' ? (
        <Feed
          reactions={reactions}
          friends={friendsApi.friends}
          minScore={minScore}
          onSignIn={() => setShowAuth(true)}
        />
      ) : (
        <SavedList
          saves={reactions.saves}
          toggleSave={reactions.toggleSave}
          onBrowse={() => setView('feed')}
        />
      )}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      {showProfile && (
        <ProfileModal
          profile={profile}
          saveProfile={saveProfile}
          onClose={() => setShowProfile(false)}
        />
      )}
      {showFriends && !chatFriend && (
        <FriendsPanel
          friendsApi={friendsApi}
          onOpenChat={(f) => setChatFriend(f)}
          onClose={() => setShowFriends(false)}
        />
      )}
      {chatFriend && (
        <ChatPanel
          friend={chatFriend}
          onBack={() => setChatFriend(null)}
          onClose={() => {
            setChatFriend(null)
            setShowFriends(false)
          }}
        />
      )}
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
