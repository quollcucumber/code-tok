import { useEffect, useState } from 'react'
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from './useAuth'

// Blogs removed by an admin live at removedBlogs/{blogId}. Everyone can read
// the list (the feed filters against it); only admins can write (enforced by
// the Firestore rules).
export function useRemovedBlogs() {
  const { user, configured } = useAuth()
  const [removedIds, setRemovedIds] = useState(() => new Set())

  useEffect(() => {
    if (!configured) return
    return onSnapshot(
      collection(db, 'removedBlogs'),
      (snap) => setRemovedIds(new Set(snap.docs.map((d) => Number(d.id)))),
      () => {}
    )
  }, [configured])

  async function removeBlog(entry) {
    await setDoc(doc(db, 'removedBlogs', String(entry.id)), {
      title: entry.title || null,
      authorHandle: entry.authorHandle || null,
      removedBy: user?.uid ?? null,
      createdAt: serverTimestamp(),
    })
  }

  async function restoreBlog(blogId) {
    await deleteDoc(doc(db, 'removedBlogs', String(blogId)))
  }

  return { removedIds, removeBlog, restoreBlog }
}
