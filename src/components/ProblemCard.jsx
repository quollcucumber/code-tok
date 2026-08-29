import { useMemo } from 'react'
import { ratingColor } from '../lib/codeforces'
import { prepareBlogHtml } from '../lib/blogHtml'

function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

function paragraphs(text) {
  return text
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br/>')}</p>`)
    .join('')
}

// Builds sanitized, KaTeX-rendered HTML for a problem statement in the same
// Input/Output/Example/Note layout Codeforces uses.
function statementHtml(entry) {
  const s = entry.statement
  let html = paragraphs(s.description)
  if (s.inputFormat) html += `<h3 class="problem-section">Input</h3>${paragraphs(s.inputFormat)}`
  if (s.outputFormat) html += `<h3 class="problem-section">Output</h3>${paragraphs(s.outputFormat)}`
  if (s.examples?.length) {
    html += '<h3 class="problem-section">Example</h3>'
    for (const ex of s.examples) {
      html += `<div class="problem-example"><pre><b>Input</b>\n${escapeHtml(
        ex.input || ''
      )}\n<b>Output</b>\n${escapeHtml(ex.output || '')}</pre></div>`
    }
  }
  if (s.note) html += `<h3 class="problem-section">Note</h3>${paragraphs(s.note)}`
  return prepareBlogHtml(html)
}

// A "try this problem" reel mixed into the feed every few blogs.
export default function ProblemCard({ entry, saved, solved, onSave, onSolved }) {
  const content = useMemo(() => statementHtml(entry), [entry])
  return (
    <article className="card-layout">
      <div className="card-inner">
        <header className="card-header">
          <span className="problem-kicker">💡 Try this problem</span>
        </header>
        <h2 className="card-title">
          <a className="problem-title-link" href={entry.url} target="_blank" rel="noreferrer">
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
          {entry.timeLimit != null && <span className="problem-tag">⏱ {entry.timeLimit}s</span>}
          {entry.memoryLimit != null && (
            <span className="problem-tag">💾 {entry.memoryLimit}MB</span>
          )}
          {entry.tags.map((t) => (
            <span className="problem-tag" key={t}>
              {t}
            </span>
          ))}
        </div>
        <div className="card-content">
          <div className="blog-html" dangerouslySetInnerHTML={{ __html: content }} />
        </div>
      </div>
      <aside className="action-rail">
        <button
          className={`rail-btn ${solved ? 'rail-btn-active' : ''}`}
          onClick={onSolved}
          aria-label={solved ? 'Mark as unsolved' : 'Mark as solved'}
          aria-pressed={solved}
        >
          <span className="rail-icon">{solved ? '✅' : '☑️'}</span>
          <span className="rail-label">{solved ? 'Solved' : 'Solve it'}</span>
        </button>
        <button
          className={`rail-btn ${saved ? 'rail-btn-active' : ''}`}
          onClick={onSave}
          aria-label={saved ? 'Remove from saved' : 'Save problem'}
          aria-pressed={saved}
        >
          <span className="rail-icon">{saved ? '⭐' : '☆'}</span>
          <span className="rail-label">{saved ? 'Saved' : 'Save'}</span>
        </button>
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
