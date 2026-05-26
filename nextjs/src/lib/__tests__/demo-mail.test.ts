import { describe, it, expect, beforeEach, vi } from 'vitest'

const { mockSesSend } = vi.hoisted(() => ({ mockSesSend: vi.fn() }))

vi.mock('@aws-sdk/client-sesv2', () => ({
  SESv2Client:      vi.fn().mockImplementation(() => ({ send: mockSesSend })),
  SendEmailCommand: vi.fn().mockImplementation((input: unknown) => ({ input })),
}))
// Pass-through renderers so we can assert on the inner bodyText/bodyHtml
// the lib actually constructs.
vi.mock('@/lib/email-staff', () => ({
  renderStaffEmailHtml: (p: { bodyHtml: string }) => p.bodyHtml,
  renderStaffEmailText: (p: { bodyText: string }) => p.bodyText,
  escapeHtml:           (s: string) => s,
}))

import { sendDemoMagicLink, notifyStaffOfDemoSignup } from '../demo-mail'

beforeEach(() => {
  mockSesSend.mockReset()
  mockSesSend.mockResolvedValue({})
})

describe('sendDemoMagicLink', () => {
  it('sends a single email to the prospect with their magic URL embedded', async () => {
    await sendDemoMagicLink({
      toEmail:        'sara@example.com',
      fullName:       'Sara Test',
      magicUrl:       'https://equitaselite.com/try/start/abc123',
      expiresMinutes: 30,
    })
    expect(mockSesSend).toHaveBeenCalledOnce()
    const cmd = mockSesSend.mock.calls[0][0] as { input: { Destination: { ToAddresses: string[] }; Content: { Simple: { Subject: { Data: string }; Body: { Html: { Data: string }; Text: { Data: string } } } } } }
    expect(cmd.input.Destination.ToAddresses).toEqual(['sara@example.com'])
    expect(cmd.input.Content.Simple.Subject.Data).toMatch(/demo/i)
    expect(cmd.input.Content.Simple.Body.Html.Data).toContain('abc123')
    expect(cmd.input.Content.Simple.Body.Text.Data).toMatch(/30 minutes/)
  })

  it('uses "there" as fallback first name when full_name is empty', async () => {
    await sendDemoMagicLink({
      toEmail: 'x@x.com', fullName: '',
      magicUrl: 'http://x', expiresMinutes: 15,
    })
    const cmd = mockSesSend.mock.calls[0][0] as { input: { Content: { Simple: { Body: { Text: { Data: string } } } } } }
    expect(cmd.input.Content.Simple.Body.Text.Data).toMatch(/Welcome, there/)
  })
})

describe('notifyStaffOfDemoSignup', () => {
  it('sends to the staff inbox with the verified-prospect summary', async () => {
    await notifyStaffOfDemoSignup({
      fullName:        'Sara Test',
      email:           'sara@example.com',
      firmName:        'Test Capital',
      aumRange:        '$50M–$250M',
      intendedUse:     'Actively allocating',
      viewingAsRole:   'angel',
      ip:              '1.2.3.4',
      signupCreatedAt: new Date('2026-05-26T00:00:00Z'),
    })
    expect(mockSesSend).toHaveBeenCalledOnce()
    const cmd = mockSesSend.mock.calls[0][0] as { input: { Destination: { ToAddresses: string[] }; Content: { Simple: { Subject: { Data: string } } } } }
    expect(cmd.input.Destination.ToAddresses[0]).toMatch(/access@equitaselite\.com|@/)
    expect(cmd.input.Content.Simple.Subject.Data).toContain('Sara Test')
  })

  it('falls back to "unknown" when ip is null + raw role for unmapped value', async () => {
    await notifyStaffOfDemoSignup({
      fullName: 'X', email: 'x@x.com', firmName: 'F',
      aumRange: '$10M–$50M', intendedUse: 'Just curious',
      viewingAsRole: 'made_up_role',
      ip: null, signupCreatedAt: new Date(),
    })
    const cmd = mockSesSend.mock.calls[0][0] as { input: { Content: { Simple: { Body: { Text: { Data: string } } } } } }
    expect(cmd.input.Content.Simple.Body.Text.Data).toMatch(/Source IP: unknown/)
    expect(cmd.input.Content.Simple.Body.Text.Data).toMatch(/Viewing as: made_up_role/)
  })
})
