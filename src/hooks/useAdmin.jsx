import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from './useAuth'

// The admin accounts. Enforcement lives in the Firestore rules (which check
// request.auth.token.email); this list only controls UI visibility.
export const ADMIN_EMAILS = ['rcodetok@greatcactus.org', 'justinzhu2011@gmail.com']

// Bans are docs at bans/{uid}, written by the admin. Banned users can still
// browse but every write (comments, chats, likes…) is rejected by the rules.
export function useAdmin() {
  const { user, configured } = useAuth()
  const [banned, setBanned] = useState(false)

  const isAdmin = Boolean(
    configured && user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase())
  )

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
