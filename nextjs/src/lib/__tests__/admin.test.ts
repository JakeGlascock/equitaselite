import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'

const mockQueryOne = vi.fn()

vi.mock('@/lib/db', () => ({
  queryOne: (...a: unknown[]) => mockQueryOne(...a),
}))

// Reset env between tests — ADMIN_EMAILS is the break-glass fallback.
const originalAdminEmails = process.env.ADMIN_EMAILS

import { isUserAdmin } from '../admin'

beforeEach(() => {
  mockQueryOne.mockReset()
  process.env.ADMIN_EMAILS = ''
})

describe('isUserAdmin — DB column is primary', () => {
  it('returns true when profiles.is_admin is TRUE', async () => {
    mockQueryOne.mockResolvedValueOnce({ is_admin: true })
    expect(await isUserAdmin('user-1', 'a@x.com')).toBe(true)
  })

  it('falls through to env fallback when profiles.is_admin is FALSE', async () => {
    process.env.ADMIN_EMAILS = 'a@x.com'
    mockQueryOne.mockResolvedValueOnce({ is_admin: false })
    expect(await isUserAdmin('user-1', 'a@x.com')).toBe(true)
  })

  it('returns false when DB says no and email is not in ADMIN_EMAILS', async () => {
    process.env.ADMIN_EMAILS = 'someone-else@x.com'
    mockQueryOne.mockResolvedValueOnce({ is_admin: false })
    expect(await isUserAdmin('user-1', 'a@x.com')).toBe(false)
  })

  it('tolerates a missing is_admin column (pre-init env) and uses fallback', async () => {
    process.env.ADMIN_EMAILS = 'a@x.com'
    mockQueryOne.mockRejectedValueOnce(new Error('column "is_admin" does not exist'))
    expect(await isUserAdmin('user-1', 'a@x.com')).toBe(true)
  })
})

describe('isUserAdmin — env fallback edge cases', () => {
  it('is case-insensitive on the email comparison', async () => {
    process.env.ADMIN_EMAILS = 'A@X.com'
    expect(await isUserAdmin(null, 'a@x.com')).toBe(true)
  })

  it('trims whitespace inside the CSV list', async () => {
    process.env.ADMIN_EMAILS = '  one@x.com , two@x.com '
    expect(await isUserAdmin(null, 'two@x.com')).toBe(true)
  })

  it('returns false when ADMIN_EMAILS is unset and DB has no row', async () => {
    delete process.env.ADMIN_EMAILS
    mockQueryOne.mockResolvedValueOnce(null)
    expect(await isUserAdmin('user-1', 'a@x.com')).toBe(false)
  })

  it('returns false when userEmail is null and no userId', async () => {
    process.env.ADMIN_EMAILS = 'a@x.com'
    expect(await isUserAdmin(null, null)).toBe(false)
  })

  it('skips the DB lookup entirely when userId is null', async () => {
    process.env.ADMIN_EMAILS = 'a@x.com'
    expect(await isUserAdmin(null, 'a@x.com')).toBe(true)
    expect(mockQueryOne).not.toHaveBeenCalled()
  })
})

// Restore env on suite exit so other tests aren't affected.
afterAll(() => {
  if (originalAdminEmails === undefined) delete process.env.ADMIN_EMAILS
  else process.env.ADMIN_EMAILS = originalAdminEmails
})
