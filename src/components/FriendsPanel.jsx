import { useState } from 'react'
import { useAdminUids } from '../hooks/useAdmin'
import AdminBadge from './AdminBadge'

function Avatar({ profile }) {
  return profile?.photo ? (
    <img className="avatar avatar-sm" src={profile.photo} alt="" />
  ) : (
    <div className="avatar avatar-sm avatar-fallback">
      {(profile?.name || '?')[0].toUpperCase()}
    </div>
  )
}

function GroupCreateForm({ friends, createGroup }) {
  const [name, setName] = useState('')
  const [picked, setPicked] = useState({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await createGroup(
        name,
        Object.keys(picked).filter((uid) => picked[uid])
      )
      setName('')
      setPicked({})
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="group-create" onSubmit={submit}>
      <input
        placeholder="New group name…"
        value={name}
        maxLength={50}
        onChange={(e) => setName(e.target.value)}
      />
      {name.trim() && (
        <div className="group-picks">
          {friends.map((f) => (
            <label className="filter-check" key={f.uid}>
              <input
                type="checkbox"
                checked={Boolean(picked[f.uid])}
                onChange={(e) => setPicked((prev) => ({ ...prev, [f.uid]: e.target.checked }))}
              />
              {f.profile?.name || '…'}
            </label>
          ))}
        </div>
      )}
      {error && <p className="auth-error">{error}</p>}
      <button
        className="btn-primary"
        type="submit"
        disabled={busy || !name.trim() || !Object.values(picked).some(Boolean)}
      >
        Create group
      </button>
    </form>
  )
}

export default function FriendsPanel({
  friendsApi,
  groupsApi,
  unreadUids,
  unreadGroupIds,
  onOpenChat,
  onOpenGroup,
  onClose,
}) {
  const { friends, incoming, outgoing, error, sendRequest, accept, remove } = friendsApi
  const { groups, error: groupsError, createGroup, leaveGroup } = groupsApi
  const adminUids = useAdminUids()
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
                  <span className="friend-name">
                    {f.profile?.name || '…'}
                    <AdminBadge show={adminUids.has(f.uid)} />
                  </span>
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
                  <span className="friend-name">
                    {f.profile?.name || '…'}
                    <AdminBadge show={adminUids.has(f.uid)} />
                  </span>
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
                    <AdminBadge show={adminUids.has(f.uid)} />
                  </span>
                  {unreadUids.has(f.uid) && <span className="unread-dot" />}
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
          <section>
            <h4 className="friends-section-title">Group chats</h4>
            {groupsError && <p className="auth-error">{groupsError}</p>}
            {groups.map((g) => (
              <div className="friend-row" key={g.id}>
                <span className="friend-name">
                  {g.name} <span className="subtext">({g.members.length})</span>
                </span>
                {unreadGroupIds.has(g.id) && <span className="unread-dot" />}
                <button className="btn-primary friend-action" onClick={() => onOpenGroup(g)}>
                  Open
                </button>
                <button className="btn-ghost friend-action" onClick={() => leaveGroup(g.id)}>
                  Leave
                </button>
              </div>
            ))}
            {friends.length === 0 ? (
              <p className="content-note">Add friends to start a group chat.</p>
            ) : (
              <GroupCreateForm friends={friends} createGroup={createGroup} />
            )}
          </section>
        </div>
      </aside>
    </div>
  )
}
