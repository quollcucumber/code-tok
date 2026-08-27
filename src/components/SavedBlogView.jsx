import { useEffect, useState } from 'react'
import { fetchBlogContent } from '../lib/codeforces'
import { prepareBlogHtml } from '../lib/blogHtml'

export default function SavedBlogView({ blogId, item, onBack }) {
  const [content, setContent] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchBlogContent(Number(blogId))
      .then((html) => {
        if (!cancelled) setContent(prepareBlogHtml(html))
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
    }
  }, [blogId])

  return (
    <div className="saved-view">
      <div className="saved-blog-bar">
        <button className="btn-ghost" onClick={onBack}>
          ← Saved blogs
        </button>
        <a className="btn-ghost" href={item.url} target="_blank" rel="noreferrer">
          Open on Codeforces ↗
        </a>
      </div>
      <h2 className="saved-title">{item.title}</h2>
      <span className="subtext">by {item.authorHandle}</span>
      {content != null ? (
        <div className="blog-html" dangerouslySetInnerHTML={{ __html: content }} />
      ) : error ? (
        <p className="content-note">
          Couldn't load this blog.{' '}
          <a href={item.url} target="_blank" rel="noreferrer">
            Read it on Codeforces
          </a>
        </p>
      ) : (
        <p className="content-note">Loading blog…</p>
      )}
    </div>
  )
}
