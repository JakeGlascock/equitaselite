import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { POST, DELETE } from '../session/route'
import type { AuthTokens } from '@/lib/auth'

const MOCK_TOKENS: AuthTokens = {
  accessToken:  'access-abc',
  idToken:      'id-xyz',
  refreshToken: 'refresh-def',
  expiresIn:    3600,
}

function makePostRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/auth/session', () => {
  it('responds 200 with { ok: true }', async () => {
    const res = await POST(makePostRequest(MOCK_TOKENS))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('sets ee_access cookie with correct value', async () => {
    const res = await POST(makePostRequest(MOCK_TOKENS))
    const cookies = res.cookies.getAll()
    const access = cookies.find(c => c.name === 'ee_access')
    expect(access).toBeDefined()
    expect(access?.value).toBe('access-abc')
  })

  it('sets ee_id cookie with correct value', async () => {
    const res = await POST(makePostRequest(MOCK_TOKENS))
    const id = res.cookies.getAll().find(c => c.name === 'ee_id')
    expect(id?.value).toBe('id-xyz')
  })

  it('sets ee_refresh cookie with 30-day maxAge', async () => {
    const res = await POST(makePostRequest(MOCK_TOKENS))
    const refresh = res.cookies.getAll().find(c => c.name === 'ee_refresh')
    expect(refresh?.value).toBe('refresh-def')
    expect(refresh?.maxAge).toBe(30 * 24 * 3600)
  })

  it('sets all three cookies as httpOnly', async () => {
    const res = await POST(makePostRequest(MOCK_TOKENS))
    for (const cookie of res.cookies.getAll()) {
      expect(cookie.httpOnly).toBe(true)
    }
  })

  it('sets sameSite=lax on all cookies', async () => {
    const res = await POST(makePostRequest(MOCK_TOKENS))
    for (const cookie of res.cookies.getAll()) {
      expect(cookie.sameSite).toBe('lax')
    }
  })
})

describe('DELETE /api/auth/session', () => {
  it('responds 200 with { ok: true }', async () => {
    const req = new NextRequest('http://localhost/api/auth/session', { method: 'DELETE' })
    const res = await DELETE()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('clears ee_access, ee_id, and ee_refresh cookies', async () => {
    // First set cookies, then delete
    const postRes = await POST(makePostRequest(MOCK_TOKENS))
    expect(postRes.cookies.getAll()).toHaveLength(3)

    const deleteRes = await DELETE()
    // After DELETE, all three should have empty values (cleared)
    const names = deleteRes.cookies.getAll().map(c => c.name)
    expect(names).toContain('ee_access')
    expect(names).toContain('ee_id')
    expect(names).toContain('ee_refresh')
    // Cleared cookies have empty value
    for (const cookie of deleteRes.cookies.getAll()) {
      expect(cookie.value).toBe('')
    }
  })
})
