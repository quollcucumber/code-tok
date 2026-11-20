import { useCallback, useEffect, useState } from 'react'
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
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
// with messages in the groups/{groupId}/messages subcollection. Members can
// add their accepted friends or leave; only the creator can remove others.
export const MAX_GROUP_MEMBERS = 50

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
      if (memberUids.length >= MAX_GROUP_MEMBERS) {
        throw new Error(`Groups can have at most ${MAX_GROUP_MEMBERS} members`)
      }
      // The rules only let a group start with its creator; each friend is then
      // added individually so the rules can check the friendship.
      const ref = await addDoc(collection(db, 'groups'), {
        name: trimmed,
        createdBy: uid,
        members: [uid],
        createdAt: serverTimestamp(),
      })
      try {
        for (const otherUid of memberUids) {
          await updateDoc(ref, { members: arrayUnion(otherUid) })
        }
      } catch (err) {
        await deleteDoc(ref).catch(() => {})
        throw err
      }
    },
    [uid]
  )

  const addMember = useCallback(
    (groupId, otherUid) =>
      updateDoc(doc(db, 'groups', groupId), { members: arrayUnion(otherUid) }),
    []
  )

  const removeMember = useCallback(
    (groupId, otherUid) =>
      updateDoc(doc(db, 'groups', groupId), { members: arrayRemove(otherUid) }),
    []
  )

  const leaveGroup = useCallback(
    (groupId) => updateDoc(doc(db, 'groups', groupId), { members: arrayRemove(uid) }),
    [uid]
  )

  return { groups, error, createGroup, addMember, removeMember, leaveGroup }
}
