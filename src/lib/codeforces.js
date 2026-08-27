const API_BASE = 'https://codeforces.com/api'

// Codeforces limits anonymous API usage; keep calls sequential and spaced out.
let queue = Promise.resolve()
const CALL_GAP_MS = 400

function throttledFetch(url) {
  const result = queue.then(async () => {
    const res = await fetch(url)
    const json = await res.json()
    if (json.status !== 'OK') throw new Error(json.comment || 'Codeforces API error')
    return json.result
  })
  queue = result
    .catch(() => {})
    .then(() => new Promise((r) => setTimeout(r, CALL_GAP_MS)))
  return result
}

function stripTags(html) {
  const div = document.createElement('div')
  div.innerHTML = html
  return div.textContent || ''
}

export async function fetchRecentBlogEntries(maxCount = 100) {
  const actions = await throttledFetch(`${API_BASE}/recentActions?maxCount=${maxCount}`)
  const seen = new Set()
  const entries = []
  for (const action of actions) {
    const entry = action.blogEntry
    if (!entry || seen.has(entry.id)) continue
    seen.add(entry.id)
    entries.push({
      id: entry.id,
      title: stripTags(entry.title).trim(),
      authorHandle: entry.authorHandle,
      rating: entry.rating,
      creationTimeSeconds: entry.creationTimeSeconds,
      tags: entry.tags || [],
      url: `https://codeforces.com/blog/entry/${entry.id}`,
    })
  }
  return entries
}

const contentCache = new Map()

export function fetchBlogContent(blogEntryId) {
  if (!contentCache.has(blogEntryId)) {
    const promise = throttledFetch(`${API_BASE}/blogEntry.view?blogEntryId=${blogEntryId}`)
      .then((entry) => entry.content)
      .catch((err) => {
        contentCache.delete(blogEntryId)
        throw err
      })
    contentCache.set(blogEntryId, promise)
  }
  return contentCache.get(blogEntryId)
}

const userCache = new Map()

export async function fetchUsers(handles) {
  const missing = [...new Set(handles)].filter((h) => !userCache.has(h))
  if (missing.length > 0) {
    try {
      const users = await throttledFetch(
        `${API_BASE}/user.info?handles=${missing.map(encodeURIComponent).join(';')}`
      )
      for (const user of users) userCache.set(user.handle, user)
    } catch {
      // user.info fails if any handle is unknown; fall back to no metadata
    }
  }
  const result = {}
  for (const h of handles) {
    const user = userCache.get(h)
    if (user) result[h] = user
  }
  return result
}

export function ratingColor(rating) {
  if (rating == null) return '#888888'
  if (rating >= 3000) return '#ff0000'
  if (rating >= 2400) return '#ff0000'
  if (rating >= 2100) return '#ff8c00'
  if (rating >= 1900) return '#aa00aa'
  if (rating >= 1600) return '#0000ff'
  if (rating >= 1400) return '#03a89e'
  if (rating >= 1200) return '#008000'
  return '#808080'
}

export function timeAgo(seconds) {
  const diff = Math.floor(Date.now() / 1000) - seconds
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`
  return `${Math.floor(diff / 2592000)}mo ago`
}
