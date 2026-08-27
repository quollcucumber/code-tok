import { useCallback, useEffect, useRef, useState } from 'react'
import { collection, doc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from './useAuth'

const SEEN_KEY = 'codetok-seen'
const LOCAL_LIMIT = 2000

function readLocalSeen() {
  try {
    const list = JSON.parse(localStorage.getItem(SEEN_KEY))
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

// Tracks which blogs the user has already viewed so the feed can skip them
// on the next visit. Stored in localStorage always, and mirrored to
// Firestore (users/{uid}/seen/{blogId}) when signed in so it follows the
// account across devices. Kept in a ref (not state) because it only affects
// which blogs get *loaded*, never what's already on screen.
export function useSeen() {
  const { user, configured, loading } = useAuth()
  const seenRef = useRef(new Set(readLocalSeen()))
  const [loaded, setLoaded] = useState(!configured)

  useEffect(() => {
    if (!configured || loading) return
    if (!user) {
      setLoaded(true)
      return
    }
    let cancelled = false
    getDocs(collection(db, 'users', user.uid, 'seen'))
      .then((snap) => {
        if (cancelled) return
        snap.forEach((d) => seenRef.current.add(d.id))
      })
      .catch(() => {
        // seen history is best-effort; the feed still works without it
      })
      .finally(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [configured, loading, user])

  const markSeen = useCallback(
    (blogId) => {
      const idStr = String(blogId)
      if (seenRef.current.has(idStr)) return
      seenRef.current.add(idStr)
      const list = readLocalSeen().filter((x) => x !== idStr)
      list.push(idStr)
      localStorage.setItem(SEEN_KEY, JSON.stringify(list.slice(-LOCAL_LIMIT)))
      if (configured && user) {
        setDoc(doc(db, 'users', user.uid, 'seen', idStr), { seenAt: serverTimestamp() }).catch(
          () => {}
        )
      }
    },
    [configured, user]
  )

  const isSeen = useCallback((blogId) => seenRef.current.has(String(blogId)), [])

  return { isSeen, markSeen, loaded }
}
