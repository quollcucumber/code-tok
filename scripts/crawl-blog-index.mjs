// Crawl all Codeforces blog entry IDs from START down to 1, recording metadata
// for every blog that exists. Appends JSONL to blogs.jsonl and tracks progress
// in progress.json so it can be resumed.
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'

const START = 156400
const BATCH = 5
const BATCH_GAP_MS = 1000
const OUT = new URL('./blogs.jsonl', import.meta.url).pathname
const PROGRESS = new URL('./progress.json', import.meta.url).pathname

let nextId = START
if (existsSync(PROGRESS)) {
  nextId = JSON.parse(readFileSync(PROGRESS, 'utf8')).nextId
  console.log(`Resuming from id ${nextId}`)
}

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
    await new Promise((r) => setTimeout(r, Math.min(60000, 2000 * 2 ** attempt)))
    return fetchEntry(id, attempt + 1)
  }
}

let found = 0
let checked = 0
const startTime = Date.now()

while (nextId > 0) {
  const ids = []
  for (let i = 0; i < BATCH && nextId > 0; i++) ids.push(nextId--)
  const results = await Promise.all(ids.map((id) => fetchEntry(id)))
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
  writeFileSync(PROGRESS, JSON.stringify({ nextId }))
  checked += ids.length
  if (checked % 1000 < BATCH) {
    const rate = checked / ((Date.now() - startTime) / 1000)
    const etaH = nextId / rate / 3600
    console.log(
      `checked ${checked}, found ${found}, at id ${nextId}, ${rate.toFixed(1)}/s, ~${etaH.toFixed(1)}h left`
    )
  }
  await new Promise((r) => setTimeout(r, BATCH_GAP_MS))
}
console.log(`DONE. checked ${checked}, found ${found}`)
