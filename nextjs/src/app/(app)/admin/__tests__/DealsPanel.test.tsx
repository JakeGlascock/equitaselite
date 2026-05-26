import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DealsPanel from '../DealsPanel'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

const sovereigns = [
  { id: 'sov-1', full_name: 'Alice Sovereign', firm_name: 'Alpha LP' },
  { id: 'sov-2', full_name: 'Bob Sovereign',   firm_name: 'Beta FO' },
]

beforeEach(() => {
  fetchMock.mockReset()
  // GET /api/admin/deals on mount
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ deals: [] }) })
})

describe('<DealsPanel /> — security: invite picker', () => {
  it('only renders the Sovereign profiles passed in (parent-side filter is authoritative)', async () => {
    const { container } = render(<DealsPanel sovereigns={sovereigns} />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())

    // Create a deal so the invite picker shows
    fetchMock.mockResolvedValueOnce({
      ok: true, json: async () => ({ deal: { id: 'd-1', title: 'X' } }),
    })
    await userEvent.type(container.querySelector('input[placeholder*="Series B"]')!, 'AI Deal')
    await userEvent.type(container.querySelector('textarea[placeholder*="Thesis"]')!,
      'Description that is definitely longer than twenty characters.')
    await userEvent.click(screen.getByRole('button', { name: /create deal/i }))

    await waitFor(() => screen.getByText(/Invite Sovereigns/i))

    // Both sovereigns visible; no Access/Select rendered.
    expect(screen.getByText('Alice Sovereign')).toBeInTheDocument()
    expect(screen.getByText('Bob Sovereign')).toBeInTheDocument()
  })

  it('renders an empty-state when no Sovereigns exist (no checkbox leak)', async () => {
    const { container } = render(<DealsPanel sovereigns={[]} />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())

    fetchMock.mockResolvedValueOnce({
      ok: true, json: async () => ({ deal: { id: 'd-1', title: 'X' } }),
    })
    await userEvent.type(container.querySelector('input[placeholder*="Series B"]')!, 'AI Deal')
    await userEvent.type(container.querySelector('textarea[placeholder*="Thesis"]')!,
      'Description long enough to pass schema validation.')
    await userEvent.click(screen.getByRole('button', { name: /create deal/i }))

    await waitFor(() => screen.getByText(/No Sovereign-tier members yet/i))
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('Select all / Clear toggles the entire sovereign list', async () => {
    const { container } = render(<DealsPanel sovereigns={sovereigns} />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())

    fetchMock.mockResolvedValueOnce({
      ok: true, json: async () => ({ deal: { id: 'd-1', title: 'X' } }),
    })
    await userEvent.type(container.querySelector('input[placeholder*="Series B"]')!, 'AI Deal')
    await userEvent.type(container.querySelector('textarea[placeholder*="Thesis"]')!,
      'Description that is longer than twenty chars to pass schema.')
    await userEvent.click(screen.getByRole('button', { name: /create deal/i }))

    await waitFor(() => screen.getByText(/Invite Sovereigns/i))

    await userEvent.click(screen.getByRole('button', { name: /select all/i }))
    expect(screen.getByText(/2 selected/i)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /^clear$/i }))
    expect(screen.getByText(/0 selected/i)).toBeInTheDocument()
  })
})
