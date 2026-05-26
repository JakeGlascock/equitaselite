import { describe, it, expect, beforeEach, vi } from 'vitest'

const { mockSesSend, mockQueryOne } = vi.hoisted(() => ({
  mockSesSend: vi.fn(),
  mockQueryOne: vi.fn(),
}))

vi.mock('@aws-sdk/client-sesv2', () => ({
  SESv2Client:      vi.fn().mockImplementation(() => ({ send: mockSesSend })),
  SendEmailCommand: vi.fn().mockImplementation((input: unknown) => ({ input })),
}))
vi.mock('@/lib/db', () => ({ queryOne: (...a: unknown[]) => mockQueryOne(...a) }))

import {
  emailIntroRequested, emailIntroAccepted, emailIntroDeclined, emailDealInvitation,
} from '../email'

// Helper: return what SendEmailCommand was called with (input shape).
function lastSendInput() {
  const cmd = mockSesSend.mock.calls[0]?.[0] as {
    input: {
      FromEmailAddress: string
      Destination: { ToAddresses: string[] }
      Content: { Simple: {
        Subject: { Data: string }
        Body: { Html: { Data: string }; Text: { Data: string } }
        Headers?: { Name: string; Value: string }[]
      } }
    }
  } | undefined
  return cmd?.input
}

beforeEach(() => {
  mockSesSend.mockReset(); mockQueryOne.mockReset()
  mockSesSend.mockResolvedValue({})
})

describe('emailIntroRequested', () => {
  it('skips send when recipient is null or has opted out', async () => {
    mockQueryOne.mockResolvedValueOnce(null)
    await emailIntroRequested('u-1', 'Alice', 'Alpha', null)
    expect(mockSesSend).not.toHaveBeenCalled()

    mockQueryOne.mockResolvedValueOnce({
      email: 'b@b.com', full_name: 'B', email_notifications_enabled: false,
      unsubscribe_token: 'tok',
    })
    await emailIntroRequested('u-1', 'Alice', 'Alpha', null)
    expect(mockSesSend).not.toHaveBeenCalled()
  })

  it('sends with first-name greeting + adds List-Unsubscribe header when token present', async () => {
    mockQueryOne.mockResolvedValueOnce({
      email: 'b@b.com', full_name: 'Bob Family',
      email_notifications_enabled: true, unsubscribe_token: 'abcd',
    })
    await emailIntroRequested('u-1', 'Alice Angel', 'Alpha LP', 'Excited to chat')
    const inp = lastSendInput()!
    expect(inp.Destination.ToAddresses).toEqual(['b@b.com'])
    expect(inp.Content.Simple.Subject.Data).toContain('Alice Angel')
    expect(inp.Content.Simple.Body.Text.Data).toMatch(/Hi Bob,/)
    expect(inp.Content.Simple.Body.Html.Data).toContain('Excited to chat')
    const headers = inp.Content.Simple.Headers ?? []
    expect(headers.find(h => h.Name === 'List-Unsubscribe')?.Value).toContain('abcd')
    expect(headers.find(h => h.Name === 'List-Unsubscribe-Post')?.Value).toBe('List-Unsubscribe=One-Click')
  })

  it('falls back gracefully when unsubscribe_token column is missing (pre-012)', async () => {
    mockQueryOne
      .mockRejectedValueOnce(new Error('column "unsubscribe_token" does not exist'))
      .mockResolvedValueOnce({
        email: 'b@b.com', full_name: 'Bob', email_notifications_enabled: true,
      })
    await emailIntroRequested('u-1', 'Alice', 'Alpha', null)
    expect(mockSesSend).toHaveBeenCalled()
    const inp = lastSendInput()!
    // No List-Unsubscribe header when no token
    expect(inp.Content.Simple.Headers).toBeUndefined()
  })

  it('omits the blockquote when message is empty', async () => {
    mockQueryOne.mockResolvedValueOnce({
      email: 'b@b.com', full_name: 'B', email_notifications_enabled: true, unsubscribe_token: null,
    })
    await emailIntroRequested('u-1', 'Alice', 'Alpha', null)
    expect(lastSendInput()!.Content.Simple.Body.Html.Data).not.toContain('<blockquote')
  })
})

describe('emailIntroAccepted', () => {
  it('skips send when opted out', async () => {
    mockQueryOne.mockResolvedValueOnce({
      email: 'b@b.com', full_name: 'B', email_notifications_enabled: false, unsubscribe_token: null,
    })
    await emailIntroAccepted('u-1', 'Bob', 'Beta', 'bob@beta.com')
    expect(mockSesSend).not.toHaveBeenCalled()
  })

  it('embeds the recipient\'s email as a mailto: link', async () => {
    mockQueryOne.mockResolvedValueOnce({
      email: 'a@a.com', full_name: 'Alice', email_notifications_enabled: true, unsubscribe_token: 't',
    })
    await emailIntroAccepted('u-1', 'Bob', 'Beta', 'bob@beta.com')
    const inp = lastSendInput()!
    expect(inp.Content.Simple.Body.Html.Data).toContain('mailto:bob@beta.com')
  })
})

describe('emailIntroDeclined', () => {
  it('sends a passing-on notice', async () => {
    mockQueryOne.mockResolvedValueOnce({
      email: 'a@a.com', full_name: 'A', email_notifications_enabled: true, unsubscribe_token: null,
    })
    await emailIntroDeclined('u-1', 'Bob', 'Beta')
    const inp = lastSendInput()!
    expect(inp.Content.Simple.Subject.Data).toContain('declined')
  })
})

describe('emailDealInvitation', () => {
  it('strips markdown to a preview-length string in the body', async () => {
    mockQueryOne.mockResolvedValueOnce({
      email: 'a@a.com', full_name: 'A', email_notifications_enabled: true, unsubscribe_token: 't',
    })
    const longMd = '## Heading\n\n' + '*Bold* '.repeat(80)
    await emailDealInvitation('u-1', 'AI Co Series B', longMd)
    const inp = lastSendInput()!
    expect(inp.Content.Simple.Body.Text.Data).not.toContain('##')
    expect(inp.Content.Simple.Body.Text.Data).not.toContain('*')
    expect(inp.Content.Simple.Subject.Data).toContain('AI Co Series B')
  })

  it('uses a generic preview when description is empty after stripping', async () => {
    mockQueryOne.mockResolvedValueOnce({
      email: 'a@a.com', full_name: 'A', email_notifications_enabled: true, unsubscribe_token: null,
    })
    await emailDealInvitation('u-1', 'Deal X', '###')   // all-markdown content
    const inp = lastSendInput()!
    // preview is the email-meta preview; not necessarily in body. Just verify
    // the email was sent without crashing.
    expect(mockSesSend).toHaveBeenCalled()
    expect(inp.Content.Simple.Subject.Data).toContain('Deal X')
  })

  it('does not send when opted out', async () => {
    mockQueryOne.mockResolvedValueOnce({
      email: 'a@a.com', full_name: 'A', email_notifications_enabled: false, unsubscribe_token: null,
    })
    await emailDealInvitation('u-1', 'X', 'd')
    expect(mockSesSend).not.toHaveBeenCalled()
  })
})
