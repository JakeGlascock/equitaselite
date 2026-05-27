import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MembersTable, { type MemberRow } from '../MembersTable'

// The table composes a lot of subcomponents (AdminToggle, ConciergeToggle,
// RoleFlagToggle, RowActionsMenu, ManagedAccountAssignment, TierAssignment,
// RmAssignment). Each is tested in isolation; here we stub them to focus
// on MembersTable's own filter / pagination logic.
vi.mock('../AdminToggle',                () => ({ default: () => <button>AdminToggle</button> }))
vi.mock('../ConciergeToggle',            () => ({ default: () => <button>ConciergeToggle</button> }))
vi.mock('../RoleFlagToggle',             () => ({ default: () => <button>RoleFlagToggle</button> }))
vi.mock('../RowActionsMenu',             () => ({ default: () => <button>RowActions</button> }))
vi.mock('../ManagedAccountAssignment',   () => ({ default: () => <button>ManagedAccount</button> }))
vi.mock('../TierAssignment',             () => ({ default: () => <button>Tier</button> }))
vi.mock('../RmAssignment',               () => ({ default: () => <button>Rm</button> }))

function buildRow(over: Partial<MemberRow> = {}): MemberRow {
  return {
    email: 'a@x.com', name: 'Alice', firm: 'Alpha LP',
    role: 'angel', status: 'Active', joined: '2026-01-01T00:00:00Z',
    userId: 'u-1', isAdmin: false, isConcierge: false,
    isAngel: true, isFamilyOffice: false,
    isNextGen: false, isFamilyFoundation: false, isDaf: false,
    managedBy: null, membership: 'access', relationshipManagerId: null,
    parentProfileId: null,
    isOffMarket: false, togglable: true, staffTogglable: true,
    cognitoStatus: 'CONFIRMED', deleteId: 'u-1', deletable: true, resendable: true,
    ...over,
  }
}

describe('<MembersTable /> — filtering', () => {
  it('shows all rows by default', () => {
    render(<MembersTable
      rows={[buildRow({ email: 'a@x.com' }), buildRow({ email: 'b@x.com' })]}
      selfUserId="admin"
      concierges={[]}
      wealthHolders={[]}
    />)
    expect(screen.getByText('2 total')).toBeInTheDocument()
    expect(screen.getByText('a@x.com')).toBeInTheDocument()
    expect(screen.getByText('b@x.com')).toBeInTheDocument()
  })

  it('filters by email substring (case-insensitive)', async () => {
    render(<MembersTable
      rows={[
        buildRow({ email: 'alice@x.com', name: 'Alice' }),
        buildRow({ email: 'bob@y.com',   name: 'Bob' }),
      ]}
      selfUserId="admin" concierges={[]} wealthHolders={[]}
    />)
    await userEvent.type(screen.getByPlaceholderText(/search/i), 'BOB')
    expect(screen.queryByText('alice@x.com')).not.toBeInTheDocument()
    expect(screen.getByText('bob@y.com')).toBeInTheDocument()
    expect(screen.getByText('1 of 2')).toBeInTheDocument()
  })

  it('filters by name', async () => {
    render(<MembersTable
      rows={[
        buildRow({ email: 'a@x.com', name: 'Alice Angel' }),
        buildRow({ email: 'b@x.com', name: 'Bob FO' }),
      ]}
      selfUserId="admin" concierges={[]} wealthHolders={[]}
    />)
    await userEvent.type(screen.getByPlaceholderText(/search/i), 'angel')
    expect(screen.getByText('a@x.com')).toBeInTheDocument()
    expect(screen.queryByText('b@x.com')).not.toBeInTheDocument()
  })

  it('filters by status', async () => {
    render(<MembersTable
      rows={[
        buildRow({ email: 'invited@x.com', status: 'Invited' }),
        buildRow({ email: 'active@x.com',  status: 'Active' }),
      ]}
      selfUserId="admin" concierges={[]} wealthHolders={[]}
    />)
    await userEvent.click(screen.getByRole('button', { name: 'Invited' }))
    expect(screen.getByText('invited@x.com')).toBeInTheDocument()
    expect(screen.queryByText('active@x.com')).not.toBeInTheDocument()
  })

  it('filters by tier', async () => {
    render(<MembersTable
      rows={[
        buildRow({ email: 'sov@x.com', membership: 'sovereign' }),
        buildRow({ email: 'acc@x.com', membership: 'access' }),
      ]}
      selfUserId="admin" concierges={[]} wealthHolders={[]}
    />)
    await userEvent.click(screen.getByRole('button', { name: 'Sovereign' }))
    expect(screen.getByText('sov@x.com')).toBeInTheDocument()
    expect(screen.queryByText('acc@x.com')).not.toBeInTheDocument()
  })

  it('filters tier=Unset (membership column null/absent)', async () => {
    render(<MembersTable
      rows={[
        buildRow({ email: 'unset@x.com', membership: null }),
        buildRow({ email: 'sov@x.com', membership: 'sovereign' }),
      ]}
      selfUserId="admin" concierges={[]} wealthHolders={[]}
    />)
    await userEvent.click(screen.getByRole('button', { name: 'Unset' }))
    expect(screen.getByText('unset@x.com')).toBeInTheDocument()
    expect(screen.queryByText('sov@x.com')).not.toBeInTheDocument()
  })

  it('shows empty-state when no rows match the filters', async () => {
    render(<MembersTable
      rows={[buildRow({ email: 'a@x.com' })]}
      selfUserId="admin" concierges={[]} wealthHolders={[]}
    />)
    await userEvent.type(screen.getByPlaceholderText(/search/i), 'nonexistent')
    expect(screen.getByText(/no members match/i)).toBeInTheDocument()
  })
})
