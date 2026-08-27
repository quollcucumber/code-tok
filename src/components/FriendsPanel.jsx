import { useState } from 'react'

function Avatar({ profile }) {
  return profile?.photo ? (
    <img className="avatar avatar-sm" src={profile.photo} alt="" />
  ) : (
    <div className="avatar avatar-sm avatar-fallback">
      {(profile?.name || '?')[0].toUpperCase()}
    </div>
  )
}

export default function FriendsPanel({ friendsApi, unreadUids, onOpenChat, onClose }) {
  const { friends, incoming, outgoing, error, sendRequest, accept, remove } = friendsApi
  const [search, setSearch] = useState('')
  const [notice, setNotice] = useState('')
  const [searchError, setSearchError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submitSearch(e) {
    e.preventDefault()
    setBusy(true)
    setNotice('')
    setSearchError('')
    try {
      setNotice(await sendRequest(search))
      setSearch('')
    } catch (err) {
      setSearchError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="comments-backdrop" onClick={onClose}>
      <aside className="comments-panel" onClick={(e) => e.stopPropagation()}>
        <header className="comments-header">
          <h3 className="comments-title">Friends</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close friends">
            ✕
          </button>
        </header>
        <form className="comment-form friends-search" onSubmit={submitSearch}>
          <input
            placeholder="Add by email or display name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="btn-primary" type="submit" disabled={busy || !search.trim()}>
            Add
          </button>
        </form>
        {notice && <p className="friends-notice">{notice}</p>}
        {searchError && <p className="auth-error">{searchError}</p>}
        {error && <p className="auth-error">{error}</p>}
        <div className="comments-list friends-list">
          {incoming.length > 0 && (
            <section>
              <h4 className="friends-section-title">Requests</h4>
              {incoming.map((f) => (
                <div className="friend-row" key={f.uid}>
                  <Avatar profile={f.profile} />
                  <span className="friend-name">{f.profile?.name || '…'}</span>
                  <button className="btn-primary friend-action" onClick={() => accept(f.pairId)}>
                    Accept
                  </button>
                  <button className="btn-ghost friend-action" onClick={() => remove(f.pairId)}>
                    Decline
                  </button>
                </div>
              ))}
            </section>
          )}
          {outgoing.length > 0 && (
            <section>
              <h4 className="friends-section-title">Sent requests</h4>
              {outgoing.map((f) => (
                <div className="friend-row" key={f.uid}>
                  <Avatar profile={f.profile} />
                  <span className="friend-name">{f.profile?.name || '…'}</span>
                  <button className="btn-ghost friend-action" onClick={() => remove(f.pairId)}>
                    Cancel
                  </button>
                </div>
              ))}
            </section>
          )}
          <section>
            <h4 className="friends-section-title">Friends</h4>
            {friends.length === 0 ? (
              <p className="content-note">No friends yet — add someone above!</p>
            ) : (
              friends.map((f) => (
                <div className="friend-row" key={f.uid}>
                  <Avatar profile={f.profile} />
                  <span className="friend-name">
                    {f.profile?.name || '…'}
                    {unreadUids.has(f.uid) && <span className="unread-dot" />}
                  </span>
                  <button className="btn-primary friend-action" onClick={() => onOpenChat(f)}>
                    Message
                  </button>
                  <button className="btn-ghost friend-action" onClick={() => remove(f.pairId)}>
                    Remove
                  </button>
                </div>
              ))
            )}
          </section>
        </div>
      </aside>
    </div>
  )
}
