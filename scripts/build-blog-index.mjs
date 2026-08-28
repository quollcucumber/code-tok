// Builds the static blog index served from /blog-index/ out of a JSONL crawl
// of the Codeforces API (one {i,t,a,r,c,g} object per line — id, title,
// authorHandle, rating, creationTimeSeconds, tags).
//
// Usage: node scripts/build-blog-index.mjs [path/to/blogs.jsonl] [minCrawledId]
// Defaults: data/blogs.jsonl, and the crawl frontier from data/index-meta.json
// (minCrawledId is the lowest id already checked — blogs below it exist but
// weren't crawled, so the app falls back to the live API there; it is 1 once
// the crawl is complete).
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'

const CHUNK_SIZE = 2000

const src = process.argv[2] || new URL('../data/blogs.jsonl', import.meta.url).pathname
if (!existsSync(src)) {
  console.error(`No blog data at ${src}`)
  process.exit(1)
}

const byId = new Map()
for (const line of readFileSync(src, 'utf8').split('\n')) {
  if (!line) continue
  const e = JSON.parse(line)
  byId.set(e.i, e)
}
const all = [...byId.values()].sort((a, b) => b.i - a.i)
if (all.length === 0) {
  console.error('No entries found in input')
  process.exit(1)
}

const metaPath = new URL('../data/index-meta.json', import.meta.url).pathname
const maxId = all[0].i
const minId = process.argv[3]
  ? Number(process.argv[3])
  : existsSync(metaPath)
    ? JSON.parse(readFileSync(metaPath, 'utf8')).minCrawledId
    : all[all.length - 1].i
const outDir = new URL('../public/blog-index/', import.meta.url).pathname
rmSync(outDir, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true })

const firstChunk = Math.floor(minId / CHUNK_SIZE)
const chunkCount = Math.floor(maxId / CHUNK_SIZE) + 1
const chunks = Array.from({ length: chunkCount }, () => [])
for (const e of all) chunks[Math.floor(e.i / CHUNK_SIZE)].push(e)
for (let n = firstChunk; n < chunkCount; n++) {
  writeFileSync(`${outDir}chunk-${n}.json`, JSON.stringify(chunks[n]))
}
writeFileSync(
  `${outDir}manifest.json`,
  JSON.stringify({
    maxId,
    // Lowest crawled id: for a partial crawl, older blogs below this still
    // exist and are discovered live. Set to 1 once the crawl is complete.
    minId,
    chunkSize: CHUNK_SIZE,
    count: all.length,
    version: Date.now(),
  })
)
console.log(`Wrote ${all.length} entries (ids ${minId}..${maxId}) into ${chunkCount} chunks`)
