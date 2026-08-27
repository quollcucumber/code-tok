import { useEffect, useState } from 'react'
import { AuthProvider } from './hooks/useAuth'
import { useReactions } from './hooks/useReactions'
import { useFriends } from './hooks/useFriends'
import { useProfile } from './hooks/useProfile'
import { useChatAlerts } from './hooks/useChatAlerts'
import TopBar from './components/TopBar'
import Feed from './components/Feed'
import SavedList from './components/SavedList'
import AuthModal from './components/AuthModal'
import FriendsPanel from './components/FriendsPanel'
import ChatPanel from './components/ChatPanel'
import ProfileModal from './components/ProfileModal'
import './App.css'

const FILTER_KEY = 'codetok-min-score'
const THEME_KEY = 'codetok-theme'
const ANNOUNCEMENTS_KEY = 'codetok-hide-announcements'

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
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || 'dark')
  const [hideAnnouncements, setHideAnnouncements] = useState(
    () => localStorage.getItem(ANNOUNCEMENTS_KEY) === '1'
  )
  const reactions = useReactions()
  const friendsApi = useFriends()
  const { profile, saveProfile } = useProfile()
  const { toast, dismissToast, unreadUids } = useChatAlerts(
    friendsApi.friends,
    chatFriend?.uid ?? null
  )

  useEffect(() => {
    if (minScore == null) localStorage.removeItem(FILTER_KEY)
    else localStorage.setItem(FILTER_KEY, String(minScore))
  }, [minScore])

  useEffect(() => {
    document.body.dataset.theme = theme
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  useEffect(() => {
    localStorage.setItem(ANNOUNCEMENTS_KEY, hideAnnouncements ? '1' : '0')
  }, [hideAnnouncements])

  return (
    <div className="app">
      <TopBar
        onSignInClick={() => setShowAuth(true)}
        onProfileClick={() => setShowProfile(true)}
        onFriendsClick={() => setShowFriends(true)}
        profile={profile}
        friendRequestCount={friendsApi.incoming.length + unreadUids.size}
        view={view}
        onViewChange={setView}
        minScore={minScore}
        onMinScoreChange={setMinScore}
        theme={theme}
        onThemeToggle={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        hideAnnouncements={hideAnnouncements}
        onHideAnnouncementsChange={setHideAnnouncements}
      />
      {view === 'feed' ? (
        <Feed
          reactions={reactions}
          friends={friendsApi.friends}
          minScore={minScore}
          hideAnnouncements={hideAnnouncements}
          onSignIn={() => setShowAuth(true)}
        />
      ) : (
        <SavedList
          reactions={reactions}
          friends={friendsApi.friends}
          onSignIn={() => setShowAuth(true)}
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
          unreadUids={unreadUids}
          onOpenChat={(f) => setChatFriend(f)}
          onClose={() => setShowFriends(false)}
        />
      )}
      {toast && (
        <button
          className="msg-toast"
          onClick={() => {
            setChatFriend(toast.friend)
            setShowFriends(true)
            dismissToast()
          }}
        >
          {toast.friend.profile?.photo ? (
            <img className="avatar avatar-sm" src={toast.friend.profile.photo} alt="" />
          ) : (
            <div className="avatar avatar-sm avatar-fallback">
              {(toast.friend.profile?.name || '?')[0].toUpperCase()}
            </div>
          )}
          <span className="msg-toast-body">
            <strong>{toast.friend.profile?.name || 'New message'}</strong>
            <span className="msg-toast-text">{toast.text}</span>
          </span>
        </button>
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
