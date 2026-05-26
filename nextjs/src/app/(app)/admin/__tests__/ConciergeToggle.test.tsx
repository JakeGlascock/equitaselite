import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ConciergeToggle from '../ConciergeToggle'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

beforeEach(() => fetchMock.mockReset())

describe('<ConciergeToggle />', () => {
  it('renders as non-interactive "—" when disabled (demo / managed rows)', () => {
    const { container } = render(
      <ConciergeToggle userId="demo_alice" initial={false} disabled disabledReason="Demo profile" />
    )
    expect(container.textContent).toContain('—')
    expect(container.querySelector('button')).toBeNull()
  })

  it('grants concierge and updates UI on success', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true, json: async () => ({ is_concierge: true }),
    })
    render(<ConciergeToggle userId="u-1" initial={false} />)

    await userEvent.click(screen.getByRole('button', { name: /grant concierge access/i }))

    await waitFor(() => screen.getByRole('button', { name: /revoke concierge access/i }))
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ is_concierge: true })
  })

  it('reverts the toggle on server error', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false, json: async () => ({ error: 'Initialize the concierge columns first.' }),
    })
    render(<ConciergeToggle userId="u-1" initial={false} />)
    await userEvent.click(screen.getByRole('button', { name: /grant concierge access/i }))

    await waitFor(() => expect(screen.getByText(/Initialize the concierge columns/i)).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /grant concierge access/i })).toBeInTheDocument()
  })
})
