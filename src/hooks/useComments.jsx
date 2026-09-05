import { useEffect, useState } from 'react'
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from './useAuth'
import { ADMIN_EMAILS } from './useAdmin'
import { sanitizeName } from './useProfile'

// Comments live in Firestore under blogs/{blogId}/comments/{commentId}.
export function useComments(blogId) {
  const { user, configured } = useAuth()
  const [comments, setComments] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!configured) {
      setComments([])
      return
    }
    return onSnapshot(
      query(collection(db, 'blogs', String(blogId), 'comments'), orderBy('createdAt', 'asc')),
      (snap) => setComments(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => setError(`Couldn't load comments: ${err.message}`)
    )
  }, [configured, blogId])

  return {
    comments,
    error,
    canComment: configured && Boolean(user),
    addComment: async (text) => {
      await addDoc(collection(db, 'blogs', String(blogId), 'comments'), {
        uid: user.uid,
        name: sanitizeName(
          user.displayName || 'anonymous',
          ADMIN_EMAILS.includes((user.email || '').toLowerCase())
        ),
        text,
        createdAt: serverTimestamp(),
      })
    },
    deleteComment: (commentId) =>
      deleteDoc(doc(db, 'blogs', String(blogId), 'comments', commentId)),
  }
}
