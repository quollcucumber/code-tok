import { useCallback, useEffect, useState } from 'react'
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from './useAuth'

const LOCAL_KEY = 'codetok-reactions'

function readLocal() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY)) || { likes: {}, saves: {} }
  } catch {
    return { likes: {}, saves: {} }
  }
}

// Likes/saves live in Firestore under users/{uid}/likes|saves/{blogId} when
// signed in, and in localStorage otherwise.
export function useReactions() {
  const { user, configured } = useAuth()
  const [likes, setLikes] = useState({})
  const [saves, setSaves] = useState({})

  useEffect(() => {
    if (!configured || !user) {
      const local = readLocal()
      setLikes(local.likes)
      setSaves(local.saves)
      return
    }
    const unsubs = [
      ['likes', setLikes],
      ['saves', setSaves],
    ].map(([name, setter]) =>
      onSnapshot(collection(db, 'users', user.uid, name), (snap) => {
        const next = {}
        snap.forEach((d) => {
          next[d.id] = d.data()
        })
        setter(next)
      })
    )
    return () => unsubs.forEach((u) => u())
  }, [configured, user])

  const toggle = useCallback(
    async (name, entry, current, setter) => {
      const blogId = String(entry.id)
      const has = Boolean(current[blogId])
      if (configured && user) {
        const ref = doc(db, 'users', user.uid, name, blogId)
        if (has) await deleteDoc(ref)
        else await setDoc(ref, { title: entry.title, authorHandle: entry.authorHandle, url: entry.url, createdAt: serverTimestamp() })
      } else {
        const local = readLocal()
        if (has) delete local[name][blogId]
        else local[name][blogId] = { title: entry.title, authorHandle: entry.authorHandle, url: entry.url }
        localStorage.setItem(LOCAL_KEY, JSON.stringify(local))
        setter({ ...local[name] })
      }
    },
    [configured, user]
  )

  return {
    likes,
    saves,
    toggleLike: (entry) => toggle('likes', entry, likes, setLikes),
    toggleSave: (entry) => toggle('saves', entry, saves, setSaves),
  }
}
