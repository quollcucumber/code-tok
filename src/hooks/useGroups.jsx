import { useCallback, useEffect, useState } from 'react'
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from './useAuth'

// Group chats live at groups/{groupId}: { name, createdBy, members: [uid…] }
// with messages in the groups/{groupId}/messages subcollection.
export function useGroups() {
  const { user, configured } = useAuth()
  const [groups, setGroups] = useState([])
  const [error, setError] = useState(null)

  const uid = user?.uid

  useEffect(() => {
    if (!configured || !uid) {
      setGroups([])
      return
    }
    return onSnapshot(
      query(collection(db, 'groups'), where('members', 'array-contains', uid)),
      (snap) => setGroups(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => setError(`Couldn't load groups: ${err.message}`)
    )
  }, [configured, uid])

  const createGroup = useCallback(
    async (name, memberUids) => {
      const trimmed = name.trim()
      if (!trimmed) throw new Error('Give the group a name')
      if (memberUids.length === 0) throw new Error('Pick at least one friend')
      await addDoc(collection(db, 'groups'), {
        name: trimmed,
        createdBy: uid,
        members: [uid, ...memberUids],
        createdAt: serverTimestamp(),
      })
    },
    [uid]
  )

  const addMember = useCallback(
    (groupId, otherUid) =>
      updateDoc(doc(db, 'groups', groupId), { members: arrayUnion(otherUid) }),
    []
  )

  const leaveGroup = useCallback(
    (groupId) => updateDoc(doc(db, 'groups', groupId), { members: arrayRemove(uid) }),
    [uid]
  )

  return { groups, error, createGroup, addMember, leaveGroup }
}
