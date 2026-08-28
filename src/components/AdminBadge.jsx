// A small shield shown next to the names of administrator accounts.
export default function AdminBadge({ show }) {
  if (!show) return null
  return (
    <span className="admin-badge" title="Administrator" aria-label="Administrator">
      🛡️
    </span>
  )
}
