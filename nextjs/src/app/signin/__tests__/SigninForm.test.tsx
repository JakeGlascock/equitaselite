import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SigninForm from '../SigninForm'
import { expectNoA11yViolations } from '@/test/a11y'

// cognito-srp-helper does real SRP math; stub for component-level tests
// so we can drive the path deterministically without modular-exponent
// math eating the runtime.
vi.mock('cognito-srp-helper', () => ({
  createSrpSession: () => ({ largeA: 'SRP_A_LOCAL' }),
  signSrpSession:   () => ({
    largeA: 'SRP_A_SIGNED', smallA: 'srp_a_local',
    passwordSignature: 'sig', secret: 'sb', timestamp: 'ts',
  }),
}))

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

beforeEach(() => fetchMock.mockReset())

describe('<SigninForm /> credentials step', () => {
  it('renders the forgot-password link', () => {
    render(<SigninForm poolId="us-east-1_pool" />)
    expect(screen.getByRole('link', { name: /forgot password/i })).toHaveAttribute('href', '/forgot-password')
  })

  it('renders the passkey alternative + the waitlist + pricing links', () => {
    render(<SigninForm poolId="us-east-1_pool" />)
    expect(screen.getByRole('button', { name: /passkey/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /join the waitlist/i })).toBeInTheDocument()
  })

  it('disables the passkey button until an email is entered (anti-fat-finger)', async () => {
    render(<SigninForm poolId="us-east-1_pool" />)
    const passkeyBtn = screen.getByRole('button', { name: /passkey/i })
    expect(passkeyBtn).toBeDisabled()

    await userEvent.type(screen.getByPlaceholderText(/you@firm\.com/i), 'a@x.com')
    expect(passkeyBtn).not.toBeDisabled()
  })

  it('exposes the Show/Hide password toggle from PasswordField', async () => {
    render(<SigninForm poolId="us-east-1_pool" />)
    expect(screen.getByRole('button', { name: /show password/i })).toBeInTheDocument()
  })

  it('has no a11y violations on the credentials step', async () => {
    const { container } = render(<SigninForm poolId="us-east-1_pool" />)
    await expectNoA11yViolations(container)
  })
})

describe('<SigninForm /> — SRP path (Phase D)', () => {
  it('sends srp_init + srp_verify and never sends the password in any payload', async () => {
    fetchMock
      .mockResolvedValueOnce({   // srp_init
        ok: true, json: async () => ({
          session: 'srp-sess',
          challengeParameters: { SALT: 's', SECRET_BLOCK: 'sb', SRP_B: 'B', USER_ID_FOR_SRP: 'a@x.com' },
        }),
      })
      .mockResolvedValueOnce({   // srp_verify
        ok: true, json: async () => ({ ok: true }),   // tokens accepted, no challenge
      })

    render(<SigninForm poolId="us-east-1_AbC" />)
    await userEvent.type(screen.getByPlaceholderText(/you@firm\.com/i), 'a@x.com')
    await userEvent.type(document.querySelector('input[type="password"]')!, 'hunter2-very-secret')
    await userEvent.click(screen.getByRole('button', { name: /^sign in$/i }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))

    // Critical: every body sent to the server must NOT contain the
    // password string. SRP is the whole point of Phase D.
    for (const [, init] of fetchMock.mock.calls) {
      expect((init as { body: string }).body).not.toContain('hunter2-very-secret')
    }

    // Step 1 body
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      step: 'srp_init', email: 'a@x.com',
    })
    // Step 2 body
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({
      step: 'srp_verify', email: 'a@x.com', session: 'srp-sess',
    })
  })

  it('falls back to legacy password POST when poolId is empty (misdeploy resilience)', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true, json: async () => ({ ok: true }),
    })

    render(<SigninForm poolId="" />)
    await userEvent.type(screen.getByPlaceholderText(/you@firm\.com/i), 'a@x.com')
    await userEvent.type(document.querySelector('input[type="password"]')!, 'pw')
    await userEvent.click(screen.getByRole('button', { name: /^sign in$/i }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ email: 'a@x.com', password: 'pw' })
  })

  it('surfaces server-side error messages', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false, json: async () => ({ error: 'Incorrect email or password.' }),
    })
    render(<SigninForm poolId="us-east-1_x" />)
    await userEvent.type(screen.getByPlaceholderText(/you@firm\.com/i), 'a@x.com')
    await userEvent.type(document.querySelector('input[type="password"]')!, 'wrong')
    await userEvent.click(screen.getByRole('button', { name: /^sign in$/i }))

    await waitFor(() => expect(screen.getByText(/Incorrect email or password/i)).toBeInTheDocument())
  })
})

describe('<SigninForm /> — MFA step', () => {
  async function arriveAtMfa() {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ session: 's', challengeParameters: { SALT: 's', SECRET_BLOCK: 'sb', SRP_B: 'B', USER_ID_FOR_SRP: 'a@x.com' } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ challenge: 'mfa', session: 'mfa-sess' }) })

    render(<SigninForm poolId="us-east-1_x" />)
    await userEvent.type(screen.getByPlaceholderText(/you@firm\.com/i), 'a@x.com')
    await userEvent.type(document.querySelector('input[type="password"]')!, 'pw')
    await userEvent.click(screen.getByRole('button', { name: /^sign in$/i }))
    await waitFor(() => screen.getByPlaceholderText(/000000/))
  }

  it('reaches the MFA step on a mfa challenge', async () => {
    await arriveAtMfa()
    expect(screen.getByText(/two-factor verification/i)).toBeInTheDocument()
  })

  it('sends trustDevice: true by default', async () => {
    await arriveAtMfa()
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) })

    await userEvent.type(screen.getByPlaceholderText(/000000/), '123456')
    await userEvent.click(screen.getByRole('button', { name: /^verify$/i }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
    const mfaBody = JSON.parse(fetchMock.mock.calls[2][1].body)
    expect(mfaBody).toMatchObject({
      email: 'a@x.com', code: '123456', session: 'mfa-sess', trustDevice: true,
    })
  })

  it('respects unchecking the trust-device box', async () => {
    await arriveAtMfa()
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) })

    await userEvent.click(screen.getByRole('checkbox'))   // uncheck
    await userEvent.type(screen.getByPlaceholderText(/000000/), '654321')
    await userEvent.click(screen.getByRole('button', { name: /^verify$/i }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
    expect(JSON.parse(fetchMock.mock.calls[2][1].body).trustDevice).toBe(false)
  })

  it('strips non-digits from the MFA code as the user types', async () => {
    await arriveAtMfa()
    const input = screen.getByPlaceholderText(/000000/) as HTMLInputElement
    await userEvent.type(input, 'a1b2c3d4e5f6')
    expect(input.value).toBe('123456')
  })
})
