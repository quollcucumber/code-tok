// Builds the static blog index served from /blog-index/ out of a JSONL crawl
// of the Codeforces API (one {i,t,a,r,c,g} object per line — id, title,
// authorHandle, rating, creationTimeSeconds, tags).
//
// Usage: node scripts/build-blog-index.mjs path/to/blogs.jsonl
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'

const CHUNK_SIZE = 2000

const src = process.argv[2]
if (!src) {
  console.error('Usage: node scripts/build-blog-index.mjs path/to/blogs.jsonl')
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

const maxId = all[0].i
const outDir = new URL('../public/blog-index/', import.meta.url).pathname
rmSync(outDir, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true })

const chunkCount = Math.floor(maxId / CHUNK_SIZE) + 1
const chunks = Array.from({ length: chunkCount }, () => [])
for (const e of all) chunks[Math.floor(e.i / CHUNK_SIZE)].push(e)
for (let n = 0; n < chunkCount; n++) {
  writeFileSync(`${outDir}chunk-${n}.json`, JSON.stringify(chunks[n]))
}
writeFileSync(
  `${outDir}manifest.json`,
  JSON.stringify({
    maxId,
    chunkSize: CHUNK_SIZE,
    count: all.length,
    version: Date.now(),
  })
)
console.log(`Wrote ${all.length} entries (max id ${maxId}) into ${chunkCount} chunks`)
