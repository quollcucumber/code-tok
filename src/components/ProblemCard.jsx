import { ratingColor } from '../lib/codeforces'

// A "try this problem" reel mixed into the feed every few blogs.
export default function ProblemCard({ entry }) {
  return (
    <article className="card-layout">
      <div className="card-inner problem-card">
        <span className="problem-kicker">💡 Try this problem</span>
        <h2 className="card-title problem-title">
          <a href={entry.url} target="_blank" rel="noreferrer">
            {entry.contestId}
            {entry.index}. {entry.name}
          </a>
        </h2>
        <div className="problem-meta">
          {entry.rating != null && (
            <span className="problem-rating" style={{ color: ratingColor(entry.rating) }}>
              ★ {entry.rating}
            </span>
          )}
          {entry.tags.map((t) => (
            <span className="problem-tag" key={t}>
              {t}
            </span>
          ))}
        </div>
        <a className="btn-primary problem-solve" href={entry.url} target="_blank" rel="noreferrer">
          Solve it on Codeforces ↗
        </a>
      </div>
      <aside className="action-rail">
        <a
          className="rail-btn"
          href={entry.url}
          target="_blank"
          rel="noreferrer"
          aria-label="Open on Codeforces"
        >
          <span className="rail-icon">↗️</span>
          <span className="rail-label">Open</span>
        </a>
      </aside>
    </article>
  )
}
