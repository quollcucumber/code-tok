import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { sha256Hex } from '../lib/hash'
import { useAuth } from './useAuth'

// Friendships are single docs at friendships/{fromUid_toUid}:
// { from, to, members: [from, to], status: 'pending' | 'accepted' }.
// A request is created by `from`; only `to` can flip it to accepted.
export function useFriends() {
  const { user, configured } = useAuth()
  const [links, setLinks] = useState([])
  const [profiles, setProfiles] = useState({})
  const [error, setError] = useState(null)

  const uid = user?.uid

  useEffect(() => {
    if (!configured || !uid) {
      setLinks([])
      return
    }
    return onSnapshot(
      query(collection(db, 'friendships'), where('members', 'array-contains', uid)),
      (snap) => setLinks(snap.docs.map((d) => ({ pairId: d.id, ...d.data() }))),
      (err) => setError(`Couldn't load friends: ${err.message}`)
    )
  }, [configured, uid])

  useEffect(() => {
    if (!uid) return
    const wanted = new Set()
    for (const link of links) {
      wanted.add(link.from === uid ? link.to : link.from)
    }
    for (const other of wanted) {
      if (profiles[other] !== undefined) continue
      setProfiles((prev) => (prev[other] !== undefined ? prev : { ...prev, [other]: null }))
      getDoc(doc(db, 'profiles', other))
        .then((snap) => {
          if (snap.exists()) setProfiles((prev) => ({ ...prev, [other]: snap.data() }))
        })
        .catch(() => {})
    }
  }, [uid, links, profiles])

  const { friends, incoming, outgoing } = useMemo(() => {
    const friends = []
    const incoming = []
    const outgoing = []
    for (const link of links) {
      const other = link.from === uid ? link.to : link.from
      const item = { uid: other, profile: profiles[other], pairId: link.pairId }
      if (link.status === 'accepted') friends.push(item)
      else if (link.to === uid) incoming.push(item)
      else outgoing.push(item)
    }
    return { friends, incoming, outgoing }
  }, [links, profiles, uid])

  const sendRequest = useCallback(
    async (search) => {
      const q = search.trim().toLowerCase()
      if (!q) throw new Error('Type an email or display name')
      const [byHash, byEmail, byName] = await Promise.all([
        sha256Hex(q).then((hash) =>
          getDocs(query(collection(db, 'profiles'), where('emailHash', '==', hash)))
        ),
        getDocs(query(collection(db, 'profiles'), where('email', '==', q))),
        getDocs(query(collection(db, 'profiles'), where('nameLower', '==', q))),
      ])
      const found = [...byHash.docs, ...byEmail.docs, ...byName.docs].find((d) => d.id !== uid)
      if (!found) throw new Error('No account found with that email or name')
      const other = found.id
      const existing = links.find((l) => l.from === other || l.to === other)
      if (existing) {
        if (existing.status === 'accepted') throw new Error('Already friends!')
        if (existing.to === uid) {
          await updateDoc(doc(db, 'friendships', existing.pairId), { status: 'accepted' })
          return `You and ${found.data().name} are now friends!`
        }
        throw new Error('Request already sent')
      }
      await setDoc(doc(db, 'friendships', `${uid}_${other}`), {
        from: uid,
        to: other,
        members: [uid, other],
        status: 'pending',
        createdAt: serverTimestamp(),
      })
      return `Request sent to ${found.data().name}`
    },
    [uid, links]
  )

  const accept = useCallback(
    (pairId) => updateDoc(doc(db, 'friendships', pairId), { status: 'accepted' }),
    []
  )

  const remove = useCallback((pairId) => deleteDoc(doc(db, 'friendships', pairId)), [])

  return {
    available: configured && Boolean(uid),
    friends,
    incoming,
    outgoing,
    error,
    sendRequest,
    accept,
    remove,
  }
}

export function chatPairId(uidA, uidB) {
  return [uidA, uidB].sort().join('_')
}

// Which of my friends liked this blog? Likes are mirrored publicly to
// blogLikes/{blogId}/likers/{uid} so this is a single collection read.
export function useFriendLikes(blogId, friends, active) {
  const [likers, setLikers] = useState([])

  useEffect(() => {
    if (!active || friends.length === 0) return
    let cancelled = false
    getDocs(collection(db, 'blogLikes', String(blogId), 'likers'))
      .then((snap) => {
        if (cancelled) return
        const ids = new Set(snap.docs.map((d) => d.id))
        setLikers(friends.filter((f) => ids.has(f.uid)))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [blogId, friends, active])

  return likers
}
