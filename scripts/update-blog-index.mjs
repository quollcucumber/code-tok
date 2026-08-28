// Extends data/blogs.jsonl with blogs newer than the highest id already
// recorded, by probing the Codeforces API up to the newest id seen in recent
// actions. Run daily (see .github/workflows/update-blog-index.yml) to keep
// the static blog index fresh.
import { appendFileSync, readFileSync } from 'node:fs'

const BATCH = 5
const BATCH_GAP_MS = 1000
const MARGIN = 50
const OUT = new URL('../data/blogs.jsonl', import.meta.url).pathname

let maxId = 0
for (const line of readFileSync(OUT, 'utf8').split('\n')) {
  if (!line) continue
  const { i } = JSON.parse(line)
  if (i > maxId) maxId = i
}

const recent = await fetch('https://codeforces.com/api/recentActions?maxCount=100').then((r) =>
  r.json()
)
if (recent.status !== 'OK') {
  console.error('recentActions failed:', recent.comment)
  process.exit(1)
}
let newest = maxId
for (const action of recent.result) {
  if (action.blogEntry && action.blogEntry.id > newest) newest = action.blogEntry.id
}
const target = newest + MARGIN

function stripTitle(html) {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/\$\$\$/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
}

async function fetchEntry(id, attempt = 0) {
  try {
    const res = await fetch(`https://codeforces.com/api/blogEntry.view?blogEntryId=${id}`)
    const json = await res.json()
    if (json.status === 'OK') return json.result
    if (/not found/i.test(json.comment || '')) return null
    throw new Error(json.comment || `HTTP ${res.status}`)
  } catch (err) {
    if (attempt >= 8) {
      console.error(`giving up on id ${id}: ${err.message}`)
      return null
    }
    await new Promise((r) => setTimeout(r, Math.min(30000, 1000 * 2 ** attempt)))
    return fetchEntry(id, attempt + 1)
  }
}

let found = 0
for (let id = maxId + 1; id <= target; id += BATCH) {
  const ids = []
  for (let j = id; j < id + BATCH && j <= target; j++) ids.push(j)
  const results = await Promise.all(ids.map((i) => fetchEntry(i)))
  const lines = []
  for (const e of results) {
    if (!e) continue
    found++
    lines.push(
      JSON.stringify({
        i: e.id,
        t: stripTitle(e.title),
        a: e.authorHandle,
        r: e.rating,
        c: e.creationTimeSeconds,
        g: e.tags || [],
      })
    )
  }
  if (lines.length > 0) appendFileSync(OUT, lines.join('\n') + '\n')
  await new Promise((r) => setTimeout(r, BATCH_GAP_MS))
}

console.log(`Probed ids ${maxId + 1}..${target}, found ${found} new blogs`)
