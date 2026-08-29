import { fetchIndexedOlderEntries, indexRange } from './blogIndex'

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
// no API calls). The live API crawl covers blogs newer than the index and,
// for a partially-built index, blogs older than its lowest crawled id.
export async function fetchOlderBlogEntries(beforeId, count, shouldSkip) {
  const range = await indexRange()
  if (!range) return crawlOlderBlogEntries(beforeId, count, shouldSkip, 1)

  const entries = []
  let cursor = beforeId

  if (cursor - 1 > range.maxId) {
    const live = await crawlOlderBlogEntries(cursor, count, shouldSkip, range.maxId + 1)
    entries.push(...live.entries)
    cursor = live.nextBeforeId
    if (entries.length >= count || cursor - 1 > range.maxId) {
      return { entries, nextBeforeId: cursor }
    }
  }

  if (cursor - 1 >= range.minId) {
    const indexed = await fetchIndexedOlderEntries(cursor, count - entries.length, shouldSkip)
    if (indexed) {
      entries.push(...indexed.entries)
      cursor = indexed.nextBeforeId
    }
    if (entries.length >= count || cursor <= 0) {
      return { entries, nextBeforeId: cursor }
    }
  }

  const live = await crawlOlderBlogEntries(
    Math.min(cursor, range.minId),
    count - entries.length,
    shouldSkip,
    1
  )
  return { entries: [...entries, ...live.entries], nextBeforeId: live.nextBeforeId }
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

// Random problems (with full statements) for the every-few-reels problem
// cards. The Codeforces API has no statement endpoint and the site blocks
// cross-origin reads, so statements come from the open-r1/codeforces dataset
// (~9.5k problems, CORS-enabled). A small buffer of random problems is kept
// topped up in the background so cards can be dealt out synchronously.
const PROBLEMS_API =
  'https://datasets-server.huggingface.co/rows?dataset=open-r1%2Fcodeforces&config=default&split=train'
const PROBLEM_BUFFER_SIZE = 3
const problemBuffer = []
let problemTotal = null
let problemRefill = null

async function fetchRandomProblemRow() {
  if (problemTotal == null) {
    const res = await fetch(`${PROBLEMS_API}&offset=0&length=1`)
    const json = await res.json()
    if (!json.num_rows_total) throw new Error('problem dataset unavailable')
    problemTotal = json.num_rows_total
  }
  const offset = Math.floor(Math.random() * problemTotal)
  const res = await fetch(`${PROBLEMS_API}&offset=${offset}&length=1`)
  const json = await res.json()
  const r = json.rows?.[0]?.row
  if (!r || !r.contest_id || !r.index || !r.description) return null
  return {
    kind: 'problem',
    id: `problem-${r.contest_id}${r.index}`,
    contestId: r.contest_id,
    index: r.index,
    name: r.title,
    rating: r.rating ?? null,
    tags: r.tags || [],
    timeLimit: r.time_limit,
    memoryLimit: r.memory_limit,
    statement: {
      description: r.description,
      inputFormat: r.input_format,
      outputFormat: r.output_format,
      note: r.note,
      examples: (r.examples || []).slice(0, 2),
    },
    url: `https://codeforces.com/problemset/problem/${r.contest_id}/${r.index}`,
  }
}

function refillProblems() {
  if (problemRefill) return problemRefill
  problemRefill = (async () => {
    let attempts = 0
    while (problemBuffer.length < PROBLEM_BUFFER_SIZE && attempts < PROBLEM_BUFFER_SIZE * 3) {
      attempts += 1
      try {
        const p = await fetchRandomProblemRow()
        if (p) problemBuffer.push(p)
      } catch {
        break // network hiccup; the next take/preload retries
      }
    }
  })().finally(() => {
    problemRefill = null
  })
  return problemRefill
}

export function preloadProblems() {
  refillProblems()
}

// Pops a buffered random problem, or null if none has loaded yet.
export function takeRandomProblem() {
  const p = problemBuffer.shift() || null
  refillProblems()
  return p
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
