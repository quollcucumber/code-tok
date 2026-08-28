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

// Watches the latest message of every friend chat and group chat so the app
// can pop a toast, fire a browser notification when the tab is hidden, and
// show unread badges. Group entries use a `group:` key prefix in the read map.
export function useChatAlerts(friends, groups, activeChatUid, activeGroupId) {
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

  useEffect(() => {
    if (!configured || !uid || groups.length === 0) return
    const unsubs = groups.map((group) => {
      return onSnapshot(
        query(
          collection(db, 'groups', group.id, 'messages'),
          orderBy('createdAt', 'desc'),
          limit(1)
        ),
        (snap) => {
          const docSnap = snap.docs[0]
          if (!docSnap || !docSnap.data().createdAt) return
          setLatest((prev) => ({
            ...prev,
            [`group:${group.id}`]: { id: docSnap.id, group, ...docSnap.data() },
          }))
        },
        () => {}
      )
    })
    return () => unsubs.forEach((unsub) => unsub())
  }, [configured, uid, groups])

  const markRead = useCallback((key, seconds) => {
    setReadMap((prev) => {
      if ((prev[key] || 0) >= seconds) return prev
      const next = { ...prev, [key]: seconds }
      localStorage.setItem(READ_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  useEffect(() => {
    for (const [key, msg] of Object.entries(latest)) {
      const seconds = msg.createdAt.seconds
      const isActive = msg.group
        ? msg.group.id === activeGroupId
        : key === activeChatUid
      if (msg.from === uid || isActive) {
        markRead(key, seconds)
        continue
      }
      if (seconds <= (mountedAtRef.current ?? Infinity) || notifiedRef.current.has(msg.id))
        continue
      notifiedRef.current.add(msg.id)
      setToast(msg)
      if (document.hidden && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        const title = msg.group
          ? `${msg.fromName || 'Someone'} in ${msg.group.name}`
          : msg.friend.profile?.name || 'New message'
        new Notification(title, { body: msg.text })
      }
    }
  }, [latest, uid, activeChatUid, activeGroupId, markRead])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 6000)
    return () => clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (
      (friends.length > 0 || groups.length > 0) &&
      typeof Notification !== 'undefined' &&
      Notification.permission === 'default'
    ) {
      Notification.requestPermission().catch(() => {})
    }
  }, [friends.length, groups.length])

  const unreadUids = useMemo(() => {
    const set = new Set()
    for (const [key, msg] of Object.entries(latest)) {
      if (!msg.group && msg.from !== uid && msg.createdAt.seconds > (readMap[key] || 0)) {
        set.add(key)
      }
    }
    return set
  }, [latest, readMap, uid])

  const unreadGroupIds = useMemo(() => {
    const set = new Set()
    for (const [key, msg] of Object.entries(latest)) {
      if (
        msg.group &&
        msg.from !== uid &&
        msg.createdAt.seconds > (readMap[key] || 0) &&
        groups.some((g) => g.id === msg.group.id)
      ) {
        set.add(msg.group.id)
      }
    }
    return set
  }, [latest, readMap, uid, groups])

  return { toast, dismissToast: () => setToast(null), unreadUids, unreadGroupIds }
}
