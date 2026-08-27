import { useEffect, useState } from 'react'
import { fileToAvatar } from '../hooks/useProfile'

export default function ProfileModal({ profile, saveProfile, onClose }) {
  const [name, setName] = useState('')
  const [photo, setPhoto] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (profile) {
      setName(profile.name || '')
      setPhoto(profile.photo || null)
    }
  }, [profile])

  async function pickPhoto(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    try {
      setPhoto(await fileToAvatar(file))
    } catch (err) {
      setError(err.message)
    }
  }

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await saveProfile({ name: name.trim() || 'anonymous', photo })
      onClose()
    } catch (err) {
      setError(`Couldn't save profile: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <h2 className="modal-title">Your profile</h2>
        <form className="auth-form" onSubmit={submit}>
          <div className="profile-photo-row">
            {photo ? (
              <img className="avatar avatar-lg" src={photo} alt="" />
            ) : (
              <div className="avatar avatar-lg avatar-fallback">
                {(name || '?')[0].toUpperCase()}
              </div>
            )}
            <div className="profile-photo-actions">
              <label className="btn-ghost profile-upload">
                Upload picture
                <input type="file" accept="image/*" onChange={pickPhoto} hidden />
              </label>
              {photo && (
                <button className="btn-link" type="button" onClick={() => setPhoto(null)}>
                  Remove picture
                </button>
              )}
            </div>
          </div>
          <input
            placeholder="Display name"
            value={name}
            maxLength={50}
            onChange={(e) => setName(e.target.value)}
          />
          {error && <p className="auth-error">{error}</p>}
          <button className="btn-primary" type="submit" disabled={busy}>
            Save
          </button>
        </form>
      </div>
    </div>
  )
}
