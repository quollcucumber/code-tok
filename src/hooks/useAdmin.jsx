import { useEffect, useState } from 'react'
import { collection, doc, getDocs, onSnapshot } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from './useAuth'

// The admin accounts. Used only for cosmetic decisions (e.g. who may keep a
// shield emoji in their display name). Actual admin status comes from the
// admins/{uid} collection, which only the Admin SDK can write, and is
// enforced server-side by the Firestore rules.
export const ADMIN_EMAILS = [
  'rcodetok@greatcactus.org',
  'justinzhu2011@gmail.com',
  'teamcuddlepie@gmail.com',
]

// Bans are docs at bans/{uid}, written by the admin. Banned users can still
// browse but every write (comments, chats, likes…) is rejected by the rules.
export function useAdmin() {
  const { user, configured } = useAuth()
  const [banned, setBanned] = useState(false)
  const adminUids = useAdminUids()

  const isAdmin = Boolean(configured && user && adminUids.has(user.uid))

  useEffect(() => {
    if (!configured || !user) {
      setBanned(false)
      return
    }
    return onSnapshot(
      doc(db, 'bans', user.uid),
      (snap) => setBanned(snap.exists()),
      () => {}
    )
  }, [configured, user])

  return { isAdmin, banned }
}

// The admin uids, used to show a 🛡️ badge next to admin names. Read from the
// admins collection, which only the Admin SDK can write (never clients), so
// the badge can't be forged by editing one's own profile.
// Fetched once per page load and shared across components.
let adminUidsPromise = null

export function useAdminUids() {
  const { configured } = useAuth()
  const [uids, setUids] = useState(() => new Set())

  useEffect(() => {
    if (!configured) return
    if (!adminUidsPromise) {
      adminUidsPromise = getDocs(collection(db, 'admins')).then(
        (snap) => new Set(snap.docs.map((d) => d.id))
      )
    }
    let cancelled = false
    adminUidsPromise
      .then((s) => {
        if (!cancelled) setUids(s)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [configured])

  return uids
}
