#!/usr/bin/env node
// Idempotent migration runner. Reads db/migrations/*.sql in lexical order,
// tracks applied versions in a schema_migrations table, applies pending ones
// in transactions. Designed to run as an ECS one-off task before each app
// rollout (see .github/workflows/deploy.yml).
//
// Existing migrations 001-008 use IF NOT EXISTS / ADD COLUMN IF NOT EXISTS,
// so the first run against a database that was bootstrapped manually via the
// old admin init buttons is safe — each file re-executes idempotently and
// gets marked as applied.

import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)

// Image bakes scripts/ and db/ side-by-side at /app, so this resolves to
// /app/db/migrations regardless of cwd.
const MIGRATIONS_DIR =
  process.env.MIGRATIONS_DIR ?? path.join(__dirname, '..', 'db', 'migrations')

// ─── Pure helpers (testable in isolation) ────────────────────────────────

export function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex')
}

// Given the lexical-sorted list of migration filenames in the repo and a
// map of { version → checksum } of already-applied migrations, return:
//   - pending: filenames not yet applied (in lexical order)
//   - mismatched: filenames that are already applied with a recorded
//     checksum that doesn't match an entry in `currentChecksums`
//
// Rows with checksum=NULL in the map predate the checksum column and are
// trusted as-is.
export function planMigrations(all, appliedMap, currentChecksums) {
  const mismatched = []
  for (const file of all) {
    if (!appliedMap.has(file)) continue
    const recorded = appliedMap.get(file)
    if (recorded == null) continue
    const current = currentChecksums.get(file)
    if (current && current !== recorded) {
      mismatched.push({ file, recorded, current })
    }
  }
  const pending = all.filter(f => !appliedMap.has(f))
  return { pending, mismatched }
}

export async function readMigrations(dir) {
  const names = (await fs.readdir(dir))
    .filter(f => f.endsWith('.sql'))
    .sort()
  const contents = new Map()
  const checksums = new Map()
  for (const name of names) {
    const buf = await fs.readFile(path.join(dir, name))
    contents.set(name, buf.toString('utf8'))
    checksums.set(name, sha256(buf))
  }
  return { names, contents, checksums }
}

// ─── Runner entry point ──────────────────────────────────────────────────

function required(name) {
  const v = process.env[name]
  if (!v) {
    console.error(`Missing required env var: ${name}`)
    process.exit(1)
  }
  return v
}

async function main() {
  const started = Date.now()
  console.log(`[migrate] target db ${process.env.DB_HOST}/${process.env.DB_NAME}`)
  console.log(`[migrate] migrations dir ${MIGRATIONS_DIR}`)

  // Lazy import of pg so the module can be imported by tests without pulling
  // in the native binding or trying to open a pool at import time.
  const { Pool } = await import('pg')
  const pool = new Pool({
    host:     required('DB_HOST'),
    port:     Number(process.env.DB_PORT ?? 5432),
    user:     required('DB_USER'),
    password: required('DB_PASSWORD'),
    database: required('DB_NAME'),
    // RDS enforces SSL via rds.force_ssl=1, so the migration task must
    // upgrade to TLS. rejectUnauthorized: false is fine here — connection
    // is inside the VPC private subnet.
    ssl: { rejectUnauthorized: false },
    max: 2,
    idleTimeoutMillis: 5000,
  })

  const client = await pool.connect()
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version    TEXT NOT NULL PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)
    await client.query(`
      ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS checksum TEXT
    `)

    const { names, contents, checksums } = await readMigrations(MIGRATIONS_DIR)
    const applied = (await client.query('SELECT version, checksum FROM schema_migrations')).rows
    const appliedMap = new Map(applied.map(r => [r.version, r.checksum]))

    const { pending, mismatched } = planMigrations(names, appliedMap, checksums)

    if (mismatched.length > 0) {
      for (const m of mismatched) {
        console.error(
          `[migrate] checksum mismatch for ${m.file}\n` +
          `  recorded: ${m.recorded}\n` +
          `  current:  ${m.current}\n` +
          `Migration files are immutable once applied. Revert your changes ` +
          `or write a new migration that fixes the schema forward.`
        )
      }
      throw new Error(`checksum mismatch for ${mismatched.length} migration(s)`)
    }

    console.log(`[migrate] ${names.length} total · ${appliedMap.size} already applied · ${pending.length} pending`)

    if (pending.length === 0) {
      console.log('[migrate] nothing to do')
      return
    }

    for (const file of pending) {
      const sql = contents.get(file)
      const checksum = checksums.get(file)
      process.stdout.write(`[migrate] applying ${file} ... `)
      const t0 = Date.now()
      try {
        await client.query('BEGIN')
        await client.query(sql)
        await client.query(
          'INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)',
          [file, checksum]
        )
        await client.query('COMMIT')
        console.log(`ok (${Date.now() - t0}ms)`)
      } catch (err) {
        await client.query('ROLLBACK').catch(() => { /* swallow */ })
        console.log('FAILED')
        console.error(`[migrate] ${file}: ${err instanceof Error ? err.message : String(err)}`)
        throw err
      }
    }

    console.log(`[migrate] applied ${pending.length} in ${Date.now() - started}ms`)
  } finally {
    client.release()
    await pool.end()
  }
}

// Only run main() when this file is the entry point. Importing the module
// (e.g. from a test file) does *not* trigger a DB connection.
const isEntryPoint = process.argv[1] && path.resolve(process.argv[1]) === __filename
if (isEntryPoint) {
  main().catch(err => {
    console.error('[migrate] fatal:', err instanceof Error ? err.stack : String(err))
    process.exit(1)
  })
}
