import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockQueryOne = vi.fn()

vi.mock('@/lib/db', () => ({ queryOne: (...a: unknown[]) => mockQueryOne(...a) }))
vi.mock('@/lib/acting-as', () => ({
  ACTING_AS_COOKIE: 'ee_acting_as',
}))

import { POST } from '../route'

const TARGET    = 'target-1'
const CONCIERGE = 'concierge-1'

function postReq(opts: { userId?: string | null } = {}): NextRequest {
  const headers: Record<string, string> = {}
  if (opts.userId !== null) headers['x-user-id'] = opts.userId ?? CONCIERGE
  return new NextRequest(`http://localhost/api/concierge/act-as/${TARGET}`, {
    method: 'POST', headers,
  })
}
const params = () => Promise.resolve({ id: TARGET })

beforeEach(() => mockQueryOne.mockReset())

describe('POST /api/concierge/act-as/[id]', () => {
  it('requires authentication', async () => {
    const res = await POST(postReq({ userId: null }), { params: params() })
    expect(res.status).toBe(401)
    expect(mockQueryOne).not.toHaveBeenCalled()
  })

  it('refuses to impersonate a profile not managed by the caller (security boundary)', async () => {
    mockQueryOne.mockResolvedValueOnce(null)

    const res = await POST(postReq(), { params: params() })

    expect(res.status).toBe(403)
    // Critical: the SELECT must verify managed_by = caller, not just exists
    const [sql, args] = mockQueryOne.mock.calls[0]
    expect(sql).toMatch(/managed_by = \$2/)
    expect(args).toEqual([TARGET, CONCIERGE])
  })

  it('issues the acting-as cookie scoped to the target profile id', async () => {
    mockQueryOne.mockResolvedValueOnce({ id: TARGET, full_name: 'Test Member' })

    const res = await POST(postReq(), { params: params() })

    expect(res.status).toBe(200)
    const setCookies = res.headers.getSetCookie()
    const actCookie = setCookies.find(c => c.startsWith('ee_acting_as='))
    expect(actCookie).toBeDefined()
    expect(actCookie).toContain(`ee_acting_as=${TARGET}`)
    expect(actCookie!.toLowerCase()).toContain('httponly')
  })
})
