import { fetchIndexedOlderEntries, indexMaxId } from './blogIndex'

const API_BASE = 'https://codeforces.com/api'

// Codeforces limits anonymous API usage; keep calls sequential and spaced out.
let queue = Promise.resolve()
const CALL_GAP_MS = 250

async function fetchJson(url) {
  const res = await fetch(url)
  const json = await res.json()
  if (json.status !== 'OK') throw new Error(json.comment || 'Codeforces API error')
  return json.result
}

function throttledFetch(url) {
  const result = queue.then(() => fetchJson(url))
  queue = result
    .catch(() => {})
    .then(() => new Promise((r) => setTimeout(r, CALL_GAP_MS)))
  return result
}

// IDs that turned out to be deleted/inaccessible blogs are remembered across
// visits so the discovery crawl never wastes API calls re-checking them.
const DEAD_KEY = 'codetok-dead-ids'
const DEAD_LIMIT = 20000
let deadIdsSet = null

function deadIds() {
  if (!deadIdsSet) {
    try {
      const list = JSON.parse(localStorage.getItem(DEAD_KEY))
      deadIdsSet = new Set(Array.isArray(list) ? list : [])
    } catch {
      deadIdsSet = new Set()
    }
  }
  return deadIdsSet
}

function saveDeadIds() {
  try {
    localStorage.setItem(DEAD_KEY, JSON.stringify([...deadIds()].slice(-DEAD_LIMIT)))
  } catch {
    // localStorage full or unavailable; the cache is best-effort
  }
}

function stripTags(html) {
  const div = document.createElement('div')
  div.innerHTML = html
  return div.textContent || ''
}

const contentCache = new Map()

function mapEntry(entry) {
  return {
    id: entry.id,
    title: stripTags(entry.title).replace(/\${3}/g, '').trim(),
    authorHandle: entry.authorHandle,
    rating: entry.rating,
    creationTimeSeconds: entry.creationTimeSeconds,
    tags: entry.tags || [],
    url: `https://codeforces.com/blog/entry/${entry.id}`,
  }
}

export async function fetchRecentBlogEntries(maxCount = 100) {
  const actions = await throttledFetch(`${API_BASE}/recentActions?maxCount=${maxCount}`)
  const seen = new Set()
  const entries = []
  for (const action of actions) {
    const entry = action.blogEntry
    if (!entry || seen.has(entry.id)) continue
    seen.add(entry.id)
    entries.push(mapEntry(entry))
  }
  return entries
}

const DISCOVERY_BATCH = 5

async function tryFetchEntry(id) {
  try {
    return await fetchJson(`${API_BASE}/blogEntry.view?blogEntryId=${id}`)
  } catch (err) {
    if (/not found/i.test(err.message)) {
      // Deleted/draft blog — remember so it's never checked again.
      deadIds().add(id)
      return null
    }
    // Rate limit or network hiccup, not a missing blog — back off, retry once.
    await new Promise((r) => setTimeout(r, 1500))
    try {
      return await fetchJson(`${API_BASE}/blogEntry.view?blogEntryId=${id}`)
    } catch {
      return null
    }
  }
}

// Blog entry ids are roughly sequential, so older blogs can be discovered by
// walking ids downward. Missing ids (deleted/draft blogs) are skipped and
// remembered; candidates are fetched in small parallel batches.
async function crawlOlderBlogEntries(beforeId, count, shouldSkip, stopAt) {
  const dead = deadIds()
  const entries = []
  let id = beforeId - 1
  let attempts = 0
  const maxAttempts = count * 8
  while (entries.length < count && id >= stopAt && attempts < maxAttempts) {
    const batch = []
    while (batch.length < DISCOVERY_BATCH && id >= stopAt) {
      if (!dead.has(id) && !shouldSkip(id)) batch.push(id)
      id--
    }
    if (batch.length === 0) break
    attempts += batch.length
    const results = await Promise.all(batch.map(tryFetchEntry))
    saveDeadIds()
    for (const entry of results) {
      if (!entry) continue
      contentCache.set(entry.id, Promise.resolve(entry.content))
      entries.push(mapEntry(entry))
    }
    await new Promise((r) => setTimeout(r, CALL_GAP_MS))
  }
  return { entries, nextBeforeId: id + 1 }
}

// Older blogs come from the pre-crawled static index when available (instant,
// no API calls); the live API crawl only covers blogs newer than the index.
export async function fetchOlderBlogEntries(beforeId, count, shouldSkip) {
  const maxIndexed = await indexMaxId()
  if (maxIndexed != null && beforeId - 1 <= maxIndexed) {
    const indexed = await fetchIndexedOlderEntries(beforeId, count, shouldSkip)
    if (indexed) return indexed
  }
  const stopAt = maxIndexed != null ? maxIndexed + 1 : 1
  const live = await crawlOlderBlogEntries(beforeId, count, shouldSkip, stopAt)
  if (maxIndexed != null && live.entries.length < count && live.nextBeforeId <= maxIndexed + 1) {
    const indexed = await fetchIndexedOlderEntries(
      live.nextBeforeId,
      count - live.entries.length,
      shouldSkip
    )
    if (indexed) {
      return {
        entries: [...live.entries, ...indexed.entries],
        nextBeforeId: indexed.nextBeforeId,
      }
    }
  }
  return live
}

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

// Heuristic: contest announcements are usually tagged "announcement" or titled
// like "Codeforces Round 1118 (Div. 2)" — but editorials/tutorials are kept.
export function isAnnouncement(entry) {
  const title = entry.title.toLowerCase()
  if (title.includes('editorial') || title.includes('tutorial')) return false
  if (entry.tags.some((t) => t.toLowerCase().includes('announcement'))) return true
  return title.includes('announcement') || /\b(round|contest)\b[^a-z]*\d/.test(title)
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
