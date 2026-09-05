import { createContext, useContext, useEffect, useState } from 'react'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth'
import { auth, firebaseConfigured, googleProvider } from '../lib/firebase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(firebaseConfigured)

  useEffect(() => {
    if (!firebaseConfigured) return
    return onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
    })
  }, [])

  const value = {
    user,
    loading,
    configured: firebaseConfigured,
    signUp: async (email, password, displayName) => {
      const cred = await createUserWithEmailAndPassword(auth, email, password)
      if (displayName) await updateProfile(cred.user, { displayName })
      return cred.user
    },
    signIn: (email, password) => signInWithEmailAndPassword(auth, email, password),
    sendVerification: () => sendEmailVerification(auth.currentUser),
    // Re-reads emailVerified from the server; returns the fresh value. A page
    // reload is still needed afterwards so Firestore gets a fresh ID token.
    refreshVerification: async () => {
      await auth.currentUser.reload()
      if (auth.currentUser.emailVerified) await auth.currentUser.getIdToken(true)
      return auth.currentUser.emailVerified
    },
    signInWithGoogle: () => signInWithPopup(auth, googleProvider),
    logOut: () => signOut(auth),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
