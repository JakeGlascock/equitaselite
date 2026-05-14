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
import { Pool } from 'pg'

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex')
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Image bakes scripts/ and db/ side-by-side at /app, so this resolves to
// /app/db/migrations regardless of cwd.
const MIGRATIONS_DIR =
  process.env.MIGRATIONS_DIR ?? path.join(__dirname, '..', 'db', 'migrations')

function required(name) {
  const v = process.env[name]
  if (!v) {
    console.error(`Missing required env var: ${name}`)
    process.exit(1)
  }
  return v
}

const pool = new Pool({
  host:     required('DB_HOST'),
  port:     Number(process.env.DB_PORT ?? 5432),
  user:     required('DB_USER'),
  password: required('DB_PASSWORD'),
  database: required('DB_NAME'),
  // RDS enforces SSL via rds.force_ssl=1, so the migration task must
  // upgrade to TLS. rejectUnauthorized: false is fine here — connection
  // is inside the VPC private subnet, and RDS's certificate chain
  // would need an explicit CA bundle to validate strictly.
  ssl: { rejectUnauthorized: false },
  // The migration task runs on its own; no need for a large pool.
  max:               2,
  idleTimeoutMillis: 5000,
})

async function main() {
  const started = Date.now()
  console.log(`[migrate] target db ${process.env.DB_HOST}/${process.env.DB_NAME}`)
  console.log(`[migrate] migrations dir ${MIGRATIONS_DIR}`)

  const client = await pool.connect()
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version    TEXT NOT NULL PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)
    // checksum was added later; backfill is opt-in. Rows that predate this
    // column have checksum=NULL and are trusted (the runner has no way to
    // know if the file is the same as when it was applied).
    await client.query(`
      ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS checksum TEXT
    `)

    const all = (await fs.readdir(MIGRATIONS_DIR))
      .filter(f => f.endsWith('.sql'))
      .sort()  // lexical order — leading zero-padded prefix keeps this correct

    const appliedRows = (await client.query(
      'SELECT version, checksum FROM schema_migrations'
    )).rows
    const appliedMap = new Map(appliedRows.map(r => [r.version, r.checksum]))

    // Safety check: if a migration has already been applied AND the table
    // has its checksum recorded, the file content must still match. If it
    // doesn't, someone edited an applied migration — aborting prevents
    // silent schema drift between environments.
    for (const file of all) {
      if (!appliedMap.has(file)) continue
      const recorded = appliedMap.get(file)
      if (recorded == null) continue  // pre-checksum row — trust it
      const current = sha256(await fs.readFile(path.join(MIGRATIONS_DIR, file)))
      if (current !== recorded) {
        console.error(
          `[migrate] checksum mismatch for ${file}\n` +
          `  recorded: ${recorded}\n` +
          `  current:  ${current}\n` +
          `Migration files are immutable once applied. Revert your changes ` +
          `or write a new migration that fixes the schema forward.`
        )
        throw new Error(`checksum mismatch for ${file}`)
      }
    }

    const pending = all.filter(f => !appliedMap.has(f))
    console.log(`[migrate] ${all.length} total · ${appliedMap.size} already applied · ${pending.length} pending`)

    if (pending.length === 0) {
      console.log('[migrate] nothing to do')
      return
    }

    for (const file of pending) {
      const buf = await fs.readFile(path.join(MIGRATIONS_DIR, file))
      const checksum = sha256(buf)
      const sql = buf.toString('utf8')
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

main().catch(err => {
  console.error('[migrate] fatal:', err instanceof Error ? err.stack : String(err))
  process.exit(1)
})
