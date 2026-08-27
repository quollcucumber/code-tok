import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from './useAuth'
import { chatPairId } from './useFriends'

const READ_KEY = 'codetok-chat-read'

function readReadMap() {
  try {
    const map = JSON.parse(localStorage.getItem(READ_KEY))
    return map && typeof map === 'object' ? map : {}
  } catch {
    return {}
  }
}

// Watches the latest message of every friend chat so the app can pop a toast,
// fire a browser notification when the tab is hidden, and show unread badges.
export function useChatAlerts(friends, activeChatUid) {
  const { user, configured } = useAuth()
  const [latest, setLatest] = useState({})
  const [toast, setToast] = useState(null)
  const [readMap, setReadMap] = useState(readReadMap)
  const notifiedRef = useRef(new Set())
  const mountedAtRef = useRef(null)

  const uid = user?.uid

  useEffect(() => {
    if (mountedAtRef.current == null) mountedAtRef.current = Date.now() / 1000
  }, [])

  useEffect(() => {
    if (!configured || !uid || friends.length === 0) return
    const unsubs = friends.map((friend) => {
      const pairId = chatPairId(uid, friend.uid)
      return onSnapshot(
        query(
          collection(db, 'chats', pairId, 'messages'),
          orderBy('createdAt', 'desc'),
          limit(1)
        ),
        (snap) => {
          const docSnap = snap.docs[0]
          if (!docSnap || !docSnap.data().createdAt) return
          setLatest((prev) => ({
            ...prev,
            [friend.uid]: { id: docSnap.id, friend, ...docSnap.data() },
          }))
        },
        () => {}
      )
    })
    return () => unsubs.forEach((unsub) => unsub())
  }, [configured, uid, friends])

  const markRead = useCallback((friendUid, seconds) => {
    setReadMap((prev) => {
      if ((prev[friendUid] || 0) >= seconds) return prev
      const next = { ...prev, [friendUid]: seconds }
      localStorage.setItem(READ_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  useEffect(() => {
    for (const [friendUid, msg] of Object.entries(latest)) {
      const seconds = msg.createdAt.seconds
      if (msg.from === uid || friendUid === activeChatUid) {
        markRead(friendUid, seconds)
        continue
      }
      if (seconds <= (mountedAtRef.current ?? Infinity) || notifiedRef.current.has(msg.id))
        continue
      notifiedRef.current.add(msg.id)
      setToast(msg)
      if (document.hidden && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification(msg.friend.profile?.name || 'New message', { body: msg.text })
      }
    }
  }, [latest, uid, activeChatUid, markRead])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 6000)
    return () => clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (
      friends.length > 0 &&
      typeof Notification !== 'undefined' &&
      Notification.permission === 'default'
    ) {
      Notification.requestPermission().catch(() => {})
    }
  }, [friends.length])

  const unreadUids = useMemo(() => {
    const set = new Set()
    for (const [friendUid, msg] of Object.entries(latest)) {
      if (msg.from !== uid && msg.createdAt.seconds > (readMap[friendUid] || 0)) {
        set.add(friendUid)
      }
    }
    return set
  }, [latest, readMap, uid])

  return { toast, dismissToast: () => setToast(null), unreadUids }
}
