import { useCallback, useEffect, useState } from 'react'
import {
  collection,
  deleteDoc,
  doc,
  increment,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from './useAuth'

const LOCAL_KEY = 'codetok-problems'

function readLocal() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY)) || {}
  } catch {
    return {}
  }
}

function problemMeta(entry) {
  return {
    contestId: entry.contestId,
    index: entry.index,
    name: entry.name,
    rating: entry.rating ?? null,
    url: entry.url,
  }
}

// Saved/solved problems live in Firestore under users/{uid}/problems/{problemId}
// when signed in ({ ...meta, saved, solved }), and in localStorage otherwise.
// The solved count is mirrored to profiles/{uid}.solvedCount for the leaderboard.
export function useProblems() {
  const { user, configured } = useAuth()
  const [problems, setProblems] = useState({})
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!configured || !user) {
      setProblems(readLocal())
      return
    }
    return onSnapshot(
      collection(db, 'users', user.uid, 'problems'),
      (snap) => {
        const next = {}
        snap.forEach((d) => {
          next[d.id] = d.data()
        })
        setProblems(next)
      },
      (err) => setError(`Couldn't sync your problems: ${err.message}`)
    )
  }, [configured, user])

  const toggle = useCallback(
    async (field, entry) => {
      const id = String(entry.id)
      const current = problems[id] || {}
      const next = { ...problemMeta(entry), ...current, [field]: !current[field] }
      const keep = next.saved || next.solved
      if (configured && user) {
        const ref = doc(db, 'users', user.uid, 'problems', id)
        try {
          if (keep) await setDoc(ref, { ...next, updatedAt: serverTimestamp() })
          else await deleteDoc(ref)
        } catch (err) {
          setError(`Couldn't save that: ${err.message}`)
          return
        }
        if (field === 'solved') {
          setDoc(
            doc(db, 'profiles', user.uid),
            { solvedCount: increment(next.solved ? 1 : -1) },
            { merge: true }
          ).catch(() => {})
        }
      } else {
        const local = readLocal()
        if (keep) local[id] = next
        else delete local[id]
        localStorage.setItem(LOCAL_KEY, JSON.stringify(local))
        setProblems({ ...local })
      }
    },
    [configured, user, problems]
  )

  return {
    problems,
    error,
    clearError: () => setError(null),
    toggleProblemSave: (entry) => toggle('saved', entry),
    toggleProblemSolved: (entry) => toggle('solved', entry),
  }
}
