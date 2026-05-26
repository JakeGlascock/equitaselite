import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DealResponseControls from '../DealResponseControls'

const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}))

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

beforeEach(() => {
  fetchMock.mockReset()
  mockRefresh.mockReset()
})

describe('<DealResponseControls />', () => {
  it('posts {status: "interested"} on Express interest', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) })
    render(<DealResponseControls invitationId="inv-1" />)

    await userEvent.click(screen.getByRole('button', { name: /express interest/i }))

    expect(fetchMock).toHaveBeenCalledWith('/api/deals/inv-1/respond', expect.objectContaining({
      method: 'POST',
      body:   JSON.stringify({ status: 'interested' }),
    }))
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled())
  })

  it('posts {status: "declined"} on Pass', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) })
    render(<DealResponseControls invitationId="inv-1" />)

    await userEvent.click(screen.getByRole('button', { name: /^pass$/i }))

    expect(fetchMock.mock.calls[0][1].body).toBe(JSON.stringify({ status: 'declined' }))
  })

  it('shows the busy label while in flight and disables both buttons', async () => {
    let resolveRequest: (v: { ok: boolean; json: () => Promise<unknown> }) => void = () => {}
    fetchMock.mockReturnValueOnce(new Promise(r => { resolveRequest = r }))

    render(<DealResponseControls invitationId="inv-1" />)
    const interest = screen.getByRole('button', { name: /express interest/i })
    const pass     = screen.getByRole('button', { name: /^pass$/i })

    await userEvent.click(interest)

    expect(screen.getByRole('button', { name: /sending/i })).toBeDisabled()
    expect(pass).toBeDisabled()

    resolveRequest({ ok: true, json: async () => ({ ok: true }) })
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled())
  })

  it('surfaces the API error message and re-enables the buttons', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false, json: async () => ({ error: 'Already responded' }),
    })

    render(<DealResponseControls invitationId="inv-1" />)
    await userEvent.click(screen.getByRole('button', { name: /express interest/i }))

    await waitFor(() => expect(screen.getByText(/Already responded/i)).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /express interest/i })).not.toBeDisabled()
    expect(mockRefresh).not.toHaveBeenCalled()
  })

  it('shows a fallback error when the response is not JSON', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false, json: async () => { throw new Error('not json') },
    })

    render(<DealResponseControls invitationId="inv-1" />)
    await userEvent.click(screen.getByRole('button', { name: /^pass$/i }))

    await waitFor(() => expect(screen.getByText(/Failed/i)).toBeInTheDocument())
  })
})
