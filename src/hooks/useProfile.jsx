import { useCallback, useEffect, useState } from 'react'
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { sha256Hex } from '../lib/hash'
import { useAuth } from './useAuth'
import { ADMIN_EMAILS } from './useAdmin'

// The shield emoji marks administrators, so ordinary users can't put it in
// their display name (in any variation-selector form). Email addresses are
// rejected as names so nobody's email ends up in publicly readable docs.
const SHIELD_RE = /\u{1F6E1}\uFE0F?/gu
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Must match the photo check in the profiles Firestore rule. Only inline image
// data URLs are allowed, so a profile can't point viewers at a remote URL.
const AVATAR_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/

export function isAvatarDataUrl(photo) {
  return typeof photo === 'string' && photo.length <= 300000 && AVATAR_RE.test(photo)
}

export function avatarSrc(profile) {
  return isAvatarDataUrl(profile?.photo) ? profile.photo : null
}

export function sanitizeName(name, isAdmin) {
  const cleaned = isAdmin ? name : name.replace(SHIELD_RE, '')
  const result = cleaned.replace(/\s+/g, ' ').trim()
  return !result || EMAIL_RE.test(result) ? 'anonymous' : result
}

// Public profile docs live at profiles/{uid}: { name, nameLower, emailHash, photo }.
// Profiles are publicly readable, so only a SHA-256 hash of the email is stored
// (enough for exact-match friend lookup without exposing addresses).
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
    const isAdmin = ADMIN_EMAILS.includes((user.email || '').toLowerCase())
    // Repair/create writes are attempted once per listener: if the rules reject
    // one (e.g. the user is banned), Firestore rolls back the local write and
    // re-emits the old snapshot, which would otherwise retry forever.
    let wrote = false
    return onSnapshot(ref, (snap) => {
      if (wrote) {
        if (snap.exists()) setProfile(snap.data())
        return
      }
      if (snap.exists()) {
        const data = snap.data()
        const clean = sanitizeName(data.name || 'anonymous', isAdmin)
        const fix = {}
        if (clean !== data.name) {
          fix.name = clean
          fix.nameLower = clean.toLowerCase()
        }
        if (data.photo != null && !isAvatarDataUrl(data.photo)) fix.photo = null
        if (Object.keys(fix).length) {
          wrote = true
          setDoc(ref, fix, { merge: true }).catch(() => {})
        }
        if (!data.emailHash && user.email) {
          wrote = true
          sha256Hex(user.email.toLowerCase())
            .then((emailHash) => setDoc(ref, { emailHash }, { merge: true }))
            .catch(() => {})
        }
        setProfile(data)
      } else {
        const name = sanitizeName(user.displayName || 'anonymous', isAdmin)
        wrote = true
        sha256Hex((user.email || '').toLowerCase())
          .then((emailHash) =>
            setDoc(ref, {
              name,
              nameLower: name.toLowerCase(),
              emailHash,
              photo: null,
              createdAt: serverTimestamp(),
            })
          )
          .catch(() => {})
      }
    })
  }, [configured, user])

  const saveProfile = useCallback(
    async ({ name, photo }) => {
      const data = {}
      if (name != null) {
        const isAdmin = ADMIN_EMAILS.includes((user.email || '').toLowerCase())
        const clean = sanitizeName(name, isAdmin)
        data.name = clean
        data.nameLower = clean.toLowerCase()
      }
      if (photo !== undefined) {
        if (photo !== null && !isAvatarDataUrl(photo)) {
          throw new Error('Profile pictures must be an uploaded JPEG, PNG or WebP image')
        }
        data.photo = photo
      }
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
