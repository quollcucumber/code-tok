export default function SavedList({ saves, toggleSave, onBrowse }) {
  const items = Object.entries(saves)

  return (
    <div className="saved-view">
      <h2 className="saved-title">Saved blogs</h2>
      {items.length === 0 ? (
        <p className="content-note">
          Nothing saved yet — hit ☆ on a blog to bookmark it here.{' '}
          <button className="btn-link" onClick={onBrowse}>
            Browse the feed
          </button>
        </p>
      ) : (
        <ul className="saved-list">
          {items.map(([blogId, item]) => (
            <li className="saved-item" key={blogId}>
              <div className="saved-item-main">
                <a href={item.url} target="_blank" rel="noreferrer" className="saved-item-title">
                  {item.title}
                </a>
                <span className="subtext">by {item.authorHandle}</span>
              </div>
              <button
                className="btn-ghost"
                onClick={() => toggleSave({ id: blogId, ...item })}
                aria-label="Remove from saved"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
