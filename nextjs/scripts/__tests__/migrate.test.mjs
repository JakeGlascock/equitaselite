import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { sha256, planMigrations, readMigrations } from '../migrate.mjs'

describe('sha256', () => {
  it('produces the canonical hex digest', () => {
    expect(sha256(Buffer.from(''))).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
    expect(sha256(Buffer.from('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })

  it('is stable across calls (deterministic)', () => {
    const a = sha256(Buffer.from('CREATE TABLE foo (id TEXT);\n'))
    const b = sha256(Buffer.from('CREATE TABLE foo (id TEXT);\n'))
    expect(a).toBe(b)
  })

  it('changes when input changes', () => {
    expect(sha256(Buffer.from('a'))).not.toBe(sha256(Buffer.from('b')))
  })
})

describe('planMigrations', () => {
  it('treats unknown files as pending in lexical order', () => {
    const all      = ['001_a.sql', '002_b.sql', '003_c.sql']
    const applied  = new Map()
    const current  = new Map([['001_a.sql', 'x'], ['002_b.sql', 'y'], ['003_c.sql', 'z']])
    const { pending, mismatched } = planMigrations(all, applied, current)
    expect(pending).toEqual(['001_a.sql', '002_b.sql', '003_c.sql'])
    expect(mismatched).toEqual([])
  })

  it('omits already-applied files from pending', () => {
    const all     = ['001_a.sql', '002_b.sql', '003_c.sql']
    const applied = new Map([['001_a.sql', 'x'], ['002_b.sql', 'y']])
    const current = new Map([['001_a.sql', 'x'], ['002_b.sql', 'y'], ['003_c.sql', 'z']])
    const { pending } = planMigrations(all, applied, current)
    expect(pending).toEqual(['003_c.sql'])
  })

  it('reports mismatch when an applied file\'s checksum has changed', () => {
    const all     = ['001_a.sql']
    const applied = new Map([['001_a.sql', 'OLD']])
    const current = new Map([['001_a.sql', 'NEW']])
    const { pending, mismatched } = planMigrations(all, applied, current)
    expect(pending).toEqual([])
    expect(mismatched).toEqual([{ file: '001_a.sql', recorded: 'OLD', current: 'NEW' }])
  })

  it('reports multiple mismatches at once', () => {
    const all     = ['001_a.sql', '002_b.sql', '003_c.sql']
    const applied = new Map([['001_a.sql', 'a1'], ['002_b.sql', 'b1'], ['003_c.sql', 'c1']])
    const current = new Map([['001_a.sql', 'a1'], ['002_b.sql', 'EDITED'], ['003_c.sql', 'ALSO_EDITED']])
    const { mismatched } = planMigrations(all, applied, current)
    expect(mismatched.map(m => m.file)).toEqual(['002_b.sql', '003_c.sql'])
  })

  it('trusts rows with null checksum (pre-checksum-column rows)', () => {
    const all     = ['001_a.sql']
    const applied = new Map([['001_a.sql', null]])
    const current = new Map([['001_a.sql', 'whatever']])
    const { pending, mismatched } = planMigrations(all, applied, current)
    expect(pending).toEqual([])
    expect(mismatched).toEqual([])
  })

  it('does not flag mismatch when a checksum is recorded but the file has been deleted', () => {
    // file is recorded as applied, but the SQL no longer exists in the repo
    const all     = []
    const applied = new Map([['001_a.sql', 'x']])
    const current = new Map()
    const { pending, mismatched } = planMigrations(all, applied, current)
    expect(pending).toEqual([])
    expect(mismatched).toEqual([])
  })
})

describe('readMigrations', () => {
  let dir

  beforeAll(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'migrate-test-'))
    await fs.writeFile(path.join(dir, '002_b.sql'), 'CREATE TABLE b ();\n')
    await fs.writeFile(path.join(dir, '001_a.sql'), 'CREATE TABLE a ();\n')
    await fs.writeFile(path.join(dir, 'README.md'), '# not a migration\n')
    await fs.writeFile(path.join(dir, '003_c.txt'), 'also not a migration\n')
  })

  afterAll(async () => {
    if (dir) await fs.rm(dir, { recursive: true, force: true })
  })

  it('returns only *.sql files in lexical order', async () => {
    const { names } = await readMigrations(dir)
    expect(names).toEqual(['001_a.sql', '002_b.sql'])
  })

  it('returns file contents keyed by name', async () => {
    const { contents } = await readMigrations(dir)
    expect(contents.get('001_a.sql')).toBe('CREATE TABLE a ();\n')
    expect(contents.get('002_b.sql')).toBe('CREATE TABLE b ();\n')
  })

  it('hashes each file deterministically', async () => {
    const a = await readMigrations(dir)
    const b = await readMigrations(dir)
    expect(a.checksums.get('001_a.sql')).toBe(b.checksums.get('001_a.sql'))
    // sanity check: the expected hash for "CREATE TABLE a ();\n"
    expect(a.checksums.get('001_a.sql')).toBe(sha256(Buffer.from('CREATE TABLE a ();\n')))
  })
})
