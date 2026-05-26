import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'

const { mockSnsSend, mockQuery } = vi.hoisted(() => ({
  mockSnsSend: vi.fn(),
  mockQuery:   vi.fn(),
}))

vi.mock('@aws-sdk/client-sns', () => ({
  SNSClient:                    vi.fn().mockImplementation(() => ({ send: mockSnsSend })),
  CreatePlatformEndpointCommand: vi.fn().mockImplementation((input: unknown) => ({ ...{ commandName: 'create' }, input })),
  PublishCommand:                vi.fn().mockImplementation((input: unknown) => ({ ...{ commandName: 'publish' }, input })),
  SetEndpointAttributesCommand:  vi.fn().mockImplementation((input: unknown) => ({ ...{ commandName: 'setAttr' }, input })),
}))
vi.mock('@/lib/db', () => ({ query: (...a: unknown[]) => mockQuery(...a) }))

const origProvider = process.env.PUSH_PROVIDER
const origAppArn   = process.env.SNS_APNS_PLATFORM_APP_ARN

// lib/push.ts captures SNS_APNS_PLATFORM_APP_ARN at module load — set it
// via vi.hoisted (runs before ESM imports) so the inner guard
// `if (!APNS_PLATFORM_APP_ARN) return null` passes when we drive the
// createPlatformEndpoint path.
vi.hoisted(() => {
  process.env.SNS_APNS_PLATFORM_APP_ARN = 'arn:platform-app'
})

import { ensureSnsEndpoint, sendPushToUser } from '../push'

beforeEach(() => {
  mockSnsSend.mockReset(); mockQuery.mockReset()
  // PUSH_PROVIDER is re-read on every call — default to unset so we get
  // the 'stub' default; individual tests opt into 'sns' as needed.
  delete process.env.PUSH_PROVIDER
})

describe('ensureSnsEndpoint — gating', () => {
  it('returns null for non-iOS platforms', async () => {
    process.env.PUSH_PROVIDER = 'sns'
    expect(await ensureSnsEndpoint('android', 'token')).toBeNull()
    expect(await ensureSnsEndpoint('web', 'token')).toBeNull()
    expect(mockSnsSend).not.toHaveBeenCalled()
  })

  it('returns null when PUSH_PROVIDER != "sns" (stub mode)', async () => {
    // PUSH_PROVIDER unset by beforeEach
    expect(await ensureSnsEndpoint('ios', 'token')).toBeNull()
  })
  // Note: "returns null when platform ARN is missing" can't be tested
  // here because the module captures APNS_PLATFORM_APP_ARN at load.
  // It's covered by code-review of the early-return guard.
})

describe('ensureSnsEndpoint — creates endpoint', () => {
  beforeEach(() => {
    process.env.PUSH_PROVIDER = 'sns'
  })

  it('returns the EndpointArn from CreatePlatformEndpoint + re-enables it', async () => {
    mockSnsSend
      .mockResolvedValueOnce({ EndpointArn: 'arn:endpoint/abc' })   // CreatePlatformEndpoint
      .mockResolvedValueOnce({})                                     // SetEndpointAttributes
    expect(await ensureSnsEndpoint('ios', 'token-1')).toBe('arn:endpoint/abc')
    expect(mockSnsSend).toHaveBeenCalledTimes(2)
  })

  it('returns null when CreatePlatformEndpoint returns no EndpointArn', async () => {
    mockSnsSend.mockResolvedValueOnce({})
    expect(await ensureSnsEndpoint('ios', 'token-1')).toBeNull()
  })

  it('returns null when SNS throws', async () => {
    mockSnsSend.mockRejectedValueOnce(new Error('throttled'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await ensureSnsEndpoint('ios', 'token-1')).toBeNull()
    errSpy.mockRestore()
  })
})

describe('sendPushToUser', () => {
  const payload = { title: 'hi', body: 'there', url: '/x', category: 'intro' as const }

  it('returns 0 when the user has no active tokens', async () => {
    mockQuery.mockResolvedValueOnce([])
    expect(await sendPushToUser('u-1', payload)).toBe(0)
  })

  it('stub mode logs intent without calling SNS', async () => {
    mockQuery
      .mockResolvedValueOnce([{ id: 'tok-1', platform: 'ios', token: 't', sns_endpoint_arn: 'arn:e' }])
      .mockResolvedValueOnce(undefined)        // last_seen_at bump
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    expect(await sendPushToUser('u-1', payload)).toBe(1)

    expect(mockSnsSend).not.toHaveBeenCalled()
    expect(log).toHaveBeenCalled()
    log.mockRestore()
  })

  it('sns mode calls PublishCommand per active token', async () => {
    process.env.PUSH_PROVIDER = 'sns'
    mockQuery
      .mockResolvedValueOnce([
        { id: 't-1', platform: 'ios', token: 'tok1', sns_endpoint_arn: 'arn:1' },
        { id: 't-2', platform: 'ios', token: 'tok2', sns_endpoint_arn: 'arn:2' },
      ])
      .mockResolvedValueOnce(undefined)
    mockSnsSend.mockResolvedValue({})

    expect(await sendPushToUser('u-1', payload)).toBe(2)
    expect(mockSnsSend).toHaveBeenCalledTimes(2)
  })

  it('revokes the device row on EndpointDisabledException', async () => {
    process.env.PUSH_PROVIDER = 'sns'
    mockQuery
      .mockResolvedValueOnce([{ id: 't-1', platform: 'ios', token: 'tok1', sns_endpoint_arn: 'arn:e' }])
      .mockResolvedValueOnce(undefined)     // revoke
      .mockResolvedValueOnce(undefined)     // last_seen_at bump
    const disabled = new Error('endpoint disabled')
    ;(disabled as { name?: string }).name = 'EndpointDisabledException'
    mockSnsSend.mockRejectedValueOnce(disabled)

    await sendPushToUser('u-1', payload)

    const revokeCall = mockQuery.mock.calls.find(
      ([sql]) => typeof sql === 'string' && /SET revoked_at = NOW\(\)/.test(sql),
    )
    expect(revokeCall).toBeDefined()
  })

  it('skips a row without sns_endpoint_arn in sns mode', async () => {
    process.env.PUSH_PROVIDER = 'sns'
    mockQuery
      .mockResolvedValueOnce([{ id: 't-1', platform: 'ios', token: 'tok1', sns_endpoint_arn: null }])
      .mockResolvedValueOnce(undefined)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await sendPushToUser('u-1', payload)
    expect(mockSnsSend).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('returns 0 when the row lookup throws', async () => {
    mockQuery.mockRejectedValueOnce(new Error('connection refused'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await sendPushToUser('u-1', payload)).toBe(0)
    errSpy.mockRestore()
  })

  it('warns on unknown PUSH_PROVIDER value', async () => {
    process.env.PUSH_PROVIDER = 'firebase'
    mockQuery
      .mockResolvedValueOnce([{ id: 't-1', platform: 'ios', token: 't', sns_endpoint_arn: 'arn' }])
      .mockResolvedValueOnce(undefined)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await sendPushToUser('u-1', payload)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})

afterAll(() => {
  if (origProvider === undefined) delete process.env.PUSH_PROVIDER
  else process.env.PUSH_PROVIDER = origProvider
  if (origAppArn === undefined) delete process.env.SNS_APNS_PLATFORM_APP_ARN
  else process.env.SNS_APNS_PLATFORM_APP_ARN = origAppArn
})
