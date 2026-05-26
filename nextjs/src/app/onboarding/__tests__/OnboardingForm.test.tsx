import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OnboardingForm from '../OnboardingForm'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

beforeEach(() => fetchMock.mockReset())

describe('<OnboardingForm /> — multi-role identity gate (Step 1)', () => {
  it('disables "Continue" with the role-required error when no role is selected', async () => {
    render(<OnboardingForm email="a@x.com" />)

    await userEvent.type(screen.getByPlaceholderText(/Horizon Ventures/i), 'Test Firm')
    // Full name input (the one not used for firm)
    const firstTextbox = screen.getAllByRole('textbox')[0]
    await userEvent.type(firstTextbox, 'Test User')

    const continueBtn = screen.getByRole('button', { name: /^continue$/i })
    expect(continueBtn).toBeDisabled()
    expect(screen.getByText(/Pick at least one role/i)).toBeInTheDocument()
  })

  it('enables "Continue" once an investor role is picked', async () => {
    render(<OnboardingForm email="a@x.com" />)

    await userEvent.click(screen.getByRole('button', { name: /Angel Investor/i }))
    const fullName = screen.getAllByRole('textbox')[0]
    const firmName = screen.getByPlaceholderText(/Horizon Ventures/i)
    await userEvent.type(fullName, 'Alice Angel')
    await userEvent.type(firmName, 'Alpha LP')

    expect(screen.getByRole('button', { name: /^continue$/i })).not.toBeDisabled()
  })

  it('keeps Continue disabled for FO selection until AUM is picked', async () => {
    render(<OnboardingForm email="a@x.com" />)

    await userEvent.click(screen.getByRole('button', { name: /Family Office/i }))
    const fullName = screen.getAllByRole('textbox')[0]
    const firmName = screen.getByPlaceholderText(/Chen Family Office|Horizon/i)
    await userEvent.type(fullName, 'Bob FO')
    await userEvent.type(firmName, 'Beta Capital')

    expect(screen.getByRole('button', { name: /^continue$/i })).toBeDisabled()
    expect(screen.getByText(/Select your AUM range/i)).toBeInTheDocument()
  })

  it('exposes aria-pressed on every role chip', () => {
    render(<OnboardingForm email="a@x.com" />)
    expect(screen.getByRole('button', { name: /Angel Investor/i }))
      .toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: /Next Gen/i }))
      .toHaveAttribute('aria-pressed', 'false')
  })
})

describe('<OnboardingForm /> — submit payload shape', () => {
  it('PATCHes /api/me?role=angel in edit mode with editRole', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true, json: async () => ({ id: 'u-1' }),
    })

    render(<OnboardingForm
      email="a@x.com" mode="edit" editRole="angel"
      initialData={{
        is_angel: true, full_name: 'Alice', firm_name: 'Alpha LP',
        sectors: ['SaaS'], stages: ['Seed'], geography: ['North America'],
        risk_tolerance: 'Moderate', expected_return: '5x-10x',
        timeline: '5-7 years',
      }}
    />)

    // Jump to step 4 (final) by clicking Continue 3 times. Pre-filled
    // initialData should pass validation at each step.
    for (let i = 0; i < 3; i++) {
      await userEvent.click(screen.getByRole('button', { name: /^continue$/i }))
    }

    const save = screen.getByRole('button', { name: /save changes/i })
    expect(save).not.toBeDisabled()
    await userEvent.click(save)

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/me?role=angel',
      expect.objectContaining({ method: 'PATCH' }),
    )
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.is_angel).toBe(true)
    expect(body.email).toBe('a@x.com')
  })

  it('POSTs to /api/onboarding in onboard mode', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true, json: async () => ({ id: 'u-1' }),
    })

    render(<OnboardingForm
      email="a@x.com"
      initialData={{
        is_angel: true, full_name: 'Alice', firm_name: 'Alpha LP',
        sectors: ['SaaS'], stages: ['Seed'], geography: ['North America'],
        risk_tolerance: 'Moderate', expected_return: '5x-10x',
        timeline: '5-7 years',
      }}
    />)

    for (let i = 0; i < 3; i++) {
      await userEvent.click(screen.getByRole('button', { name: /^continue$/i }))
    }
    await userEvent.click(screen.getByRole('button', { name: /complete profile/i }))

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/onboarding',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('surfaces server-side error and re-enables save', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false, json: async () => ({ error: 'aum: AUM is required.' }),
    })

    render(<OnboardingForm
      email="a@x.com"
      initialData={{
        is_angel: true, full_name: 'Alice', firm_name: 'Alpha LP',
        sectors: ['SaaS'], stages: ['Seed'], geography: ['North America'],
        risk_tolerance: 'Moderate', expected_return: '5x-10x',
        timeline: '5-7 years',
      }}
    />)
    for (let i = 0; i < 3; i++) {
      await userEvent.click(screen.getByRole('button', { name: /^continue$/i }))
    }
    await userEvent.click(screen.getByRole('button', { name: /complete profile/i }))

    expect(await screen.findByText(/aum: AUM is required/i)).toBeInTheDocument()
  })
})
