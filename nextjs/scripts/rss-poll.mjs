#!/usr/bin/env node
// RSS polling runner. Fetches every active feed in rss_feeds, parses
// RSS 2.0 + Atom XML, and inserts new headlines + snippets into
// rss_items with a (feed_id, guid) UNIQUE-conflict dedupe.
//
// Designed to run as an ECS one-off Fargate task every 6 hours (see
// infrastructure/rss.tf). Same lazy-import + isEntryPoint pattern as
// migrate.mjs and digest.mjs.
//
// We never store full article bodies — only title + summary + link.
// Publishers retain all rights; we re-broadcast headlines with
// attribution under the source_label.

import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)

const FETCH_TIMEOUT_MS = 15_000
const USER_AGENT       = process.env.RSS_USER_AGENT
  ?? 'EquitasEliteRSS/1.0 (+https://equitaselite.com)'

function required(name) {
  const v = process.env[name]
  if (!v) {
    console.error(`[rss] Missing required env var: ${name}`)
    process.exit(1)
  }
  return v
}

// ─── Pure parser (testable in isolation) ─────────────────────────────────

// Decode a tiny set of XML/HTML entities + strip CDATA wrappers.
function decode(s) {
  if (!s) return ''
  let t = String(s).trim()
  // CDATA wrapping is common in <description> blocks
  const cdataMatch = t.match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/)
  if (cdataMatch) t = cdataMatch[1]
  return t
    .replaceAll('&amp;',  '&')
    .replaceAll('&lt;',   '<')
    .replaceAll('&gt;',   '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&#39;',  "'")
    .trim()
}

// Pull the first <tag>…</tag> text inside a block. Case-insensitive,
// tolerant of attributes on the opening tag.
function pickTag(block, tag) {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i')
  const m = block.match(re)
  return m ? decode(m[1]) : ''
}

// Strip basic HTML to keep summaries readable in plain text.
function stripHtml(s) {
  return s
    .replace(/<\/?[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Returns { title, summary, link, guid, published_at }[] for any RSS
// 2.0 or Atom feed. Tolerates either; unknown formats yield an empty
// array.
export function parseFeed(xml) {
  const items = []

  // RSS 2.0 — <item>…</item> blocks
  for (const m of xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)) {
    const block = m[1]
    const title = pickTag(block, 'title')
    const link  = pickTag(block, 'link')
    if (!title || !link) continue
    const guid  = pickTag(block, 'guid') || link
    const pub   = pickTag(block, 'pubDate') || pickTag(block, 'dc:date')
    const desc  = pickTag(block, 'description') || pickTag(block, 'content:encoded')
    items.push({
      title:        title.slice(0, 500),
      summary:      stripHtml(desc).slice(0, 600) || null,
      link,
      guid:         guid.slice(0, 500),
      published_at: pub ? new Date(pub) : null,
    })
  }

  // Atom — <entry>…</entry> blocks. <link href="…"/> is an attribute.
  for (const m of xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi)) {
    const block    = m[1]
    const title    = pickTag(block, 'title')
    const linkAttr = block.match(/<link\b[^>]*href=["']([^"']+)["']/i)?.[1] ?? ''
    if (!title || !linkAttr) continue
    const guid    = pickTag(block, 'id') || linkAttr
    const pub     = pickTag(block, 'published') || pickTag(block, 'updated')
    const summary = pickTag(block, 'summary') || pickTag(block, 'content')
    items.push({
      title:        title.slice(0, 500),
      summary:      stripHtml(summary).slice(0, 600) || null,
      link:         linkAttr,
      guid:         guid.slice(0, 500),
      published_at: pub ? new Date(pub) : null,
    })
  }

  // Drop items whose published_at parsed to an invalid date
  return items.map(it => ({
    ...it,
    published_at: it.published_at && !isNaN(it.published_at.getTime()) ? it.published_at : null,
  }))
}

async function fetchWithTimeout(url) {
  const ctl = new AbortController()
  const t   = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, {
      signal:  ctl.signal,
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5' },
    })
  } finally {
    clearTimeout(t)
  }
}

// ─── Runner ──────────────────────────────────────────────────────────────

async function main() {
  const started = Date.now()
  console.log('[rss] starting')

  const { Pool } = await import('pg')
  const pool = new Pool({
    host:     required('DB_HOST'),
    port:     Number(process.env.DB_PORT ?? 5432),
    user:     required('DB_USER'),
    password: required('DB_PASSWORD'),
    database: required('DB_NAME'),
    ssl: { rejectUnauthorized: false },
    max: 2,
    idleTimeoutMillis: 5000,
  })

  const client = await pool.connect()
  let totalNew = 0
  let totalFeeds = 0
  let failedFeeds = 0
  try {
    const feeds = (await client.query(
      `SELECT id, url, name FROM rss_feeds WHERE active = TRUE ORDER BY name`
    )).rows

    for (const feed of feeds) {
      totalFeeds++
      try {
        const res = await fetchWithTimeout(feed.url)
        if (!res.ok) {
          console.warn(`[rss] ${feed.name}: HTTP ${res.status}`)
          failedFeeds++
          continue
        }
        const xml   = await res.text()
        const items = parseFeed(xml)
        if (items.length === 0) {
          console.warn(`[rss] ${feed.name}: parsed 0 items (feed empty or unparseable)`)
          continue
        }

        let inserted = 0
        for (const it of items) {
          const r = await client.query(
            `INSERT INTO rss_items (feed_id, guid, title, summary, link, published_at)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (feed_id, guid) DO NOTHING
             RETURNING id`,
            [feed.id, it.guid, it.title, it.summary, it.link, it.published_at]
          )
          if (r.rowCount && r.rowCount > 0) inserted++
        }
        totalNew += inserted
        console.log(`[rss] ${feed.name}: ${items.length} fetched, ${inserted} new`)
      } catch (err) {
        failedFeeds++
        console.warn(`[rss] ${feed.name}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    console.log(
      `[rss] complete · feeds=${totalFeeds} new_items=${totalNew} failed=${failedFeeds} ` +
      `· ${Date.now() - started}ms`
    )
  } finally {
    client.release()
    await pool.end()
  }
}

const isEntryPoint = process.argv[1] && path.resolve(process.argv[1]) === __filename
if (isEntryPoint) {
  main().catch(err => {
    console.error('[rss] fatal:', err instanceof Error ? err.stack : String(err))
    process.exit(1)
  })
}
