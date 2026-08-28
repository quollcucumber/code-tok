import { useCallback, useEffect, useState } from 'react'
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from './useAuth'

// Public profile docs live at profiles/{uid}: { name, nameLower, email, photo }.
// photo is a small base64 data URL (avatars are compressed client-side so they
// fit comfortably in a Firestore doc — no Cloud Storage needed).
export function useProfile() {
  const { user, configured } = useAuth()
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    if (!configured || !user) {
      setProfile(null)
      return
    }
    const ref = doc(db, 'profiles', user.uid)
    return onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setProfile(snap.data())
      } else {
        const name = user.displayName || user.email || 'anonymous'
        setDoc(ref, {
          name,
          nameLower: name.toLowerCase(),
          email: (user.email || '').toLowerCase(),
          photo: user.photoURL || null,
          createdAt: serverTimestamp(),
        }).catch(() => {})
      }
    })
  }, [configured, user])

  const saveProfile = useCallback(
    async ({ name, photo }) => {
      const data = {}
      if (name != null) {
        data.name = name
        data.nameLower = name.toLowerCase()
      }
      if (photo !== undefined) data.photo = photo
      await setDoc(doc(db, 'profiles', user.uid), data, { merge: true })
    },
    [user]
  )

  return { profile, saveProfile }
}

// Downscales an image file to a small square JPEG data URL that fits in a
// Firestore document.
export function fileToAvatar(file, size = 96) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      const side = Math.min(img.width, img.height)
      ctx.drawImage(
        img,
        (img.width - side) / 2,
        (img.height - side) / 2,
        side,
        side,
        0,
        0,
        size,
        size
      )
      resolve(canvas.toDataURL('image/jpeg', 0.8))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read that image'))
    }
    img.src = url
  })
}

// Fallback text stored on image-only chat messages so notification previews
// and Firestore rules (which require non-empty text) keep working.
export const IMAGE_PLACEHOLDER = '\ud83d\udcf7 Photo'

// Downscales an image file to a JPEG data URL small enough to embed in a chat
// message document (Firestore docs max out at 1 MiB).
export function fileToChatImage(file, maxSide = 900, maxChars = 500000) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(img.width * scale))
      canvas.height = Math.max(1, Math.round(img.height * scale))
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      for (const quality of [0.8, 0.6, 0.45, 0.3]) {
        const dataUrl = canvas.toDataURL('image/jpeg', quality)
        if (dataUrl.length <= maxChars) return resolve(dataUrl)
      }
      reject(new Error('That image is too large to send'))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read that image'))
    }
    img.src = url
  })
}
