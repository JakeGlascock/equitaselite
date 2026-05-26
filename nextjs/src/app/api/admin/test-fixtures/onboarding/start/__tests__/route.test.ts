import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockQuery       = vi.fn()
const mockIsUserAdmin = vi.fn()

vi.mock('@/lib/db',    () => ({ query: (...a: unknown[]) => mockQuery(...a) }))
vi.mock('@/lib/admin', () => ({ isUserAdmin: (...a: unknown[]) => mockIsUserAdmin(...a) }))
vi.mock('@/lib/acting-as', () => ({ ACTING_AS_COOKIE: 'ee_acting_as' }))

import { POST } from '../route'

function postReq(opts: { userId?: string | null; admin?: boolean } = {}): NextRequest {
  const headers: Record<string, string> = {}
  if (opts.userId !== null) headers['x-user-id']    = opts.userId ?? 'admin-1'
  if (opts.admin !== false) headers['x-user-email'] = 'a@x.com'
  return new NextRequest('http://localhost/api/admin/test-fixtures/onboarding/start', {
    method: 'POST', headers,
  })
}

beforeEach(() => {
  mockQuery.mockReset(); mockIsUserAdmin.mockReset()
  mockIsUserAdmin.mockResolvedValue(true)
})

describe('POST /api/admin/test-fixtures/onboarding/start', () => {
  it('requires authentication', async () => {
    expect((await POST(postReq({ userId: null }))).status).toBe(401)
  })

  it('forbids non-admins', async () => {
    mockIsUserAdmin.mockReset(); mockIsUserAdmin.mockResolvedValueOnce(false)
    expect((await POST(postReq())).status).toBe(403)
  })

  it('resets fixture and issues acting-as cookie scoped to is_test = TRUE', async () => {
    mockQuery.mockResolvedValueOnce(undefined)

    const res = await POST(postReq())

    expect(res.status).toBe(200)
    const [sql] = mockQuery.mock.calls[0]
    // SQL must contain "is_test = TRUE" guard so admin error can never
    // clobber a real profile via wrong fixture id.
    expect(sql).toMatch(/is_test = TRUE/)

    const setCookies = res.headers.getSetCookie().join('\n')
    expect(setCookies).toMatch(/ee_acting_as=test_onboarding_fixture/)
    expect(setCookies.toLowerCase()).toContain('httponly')
  })
})
