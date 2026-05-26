import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PasswordField from '../PasswordField'

describe('<PasswordField />', () => {
  it('renders as type=password by default', () => {
    render(<PasswordField defaultValue="secret" data-testid="pw" />)
    expect(screen.getByTestId('pw')).toHaveAttribute('type', 'password')
  })

  it('toggles to type=text when Show is clicked and back when Hide is clicked', async () => {
    render(<PasswordField defaultValue="secret" data-testid="pw" />)
    const input = screen.getByTestId('pw')
    const toggle = screen.getByRole('button', { name: /show password/i })

    await userEvent.click(toggle)
    expect(input).toHaveAttribute('type', 'text')
    // The accessible name flips to "Hide password" so screen readers
    // announce the new affordance.
    expect(screen.getByRole('button', { name: /hide password/i })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /hide password/i }))
    expect(input).toHaveAttribute('type', 'password')
  })

  it('exposes aria-pressed for assistive tech', async () => {
    render(<PasswordField defaultValue="x" />)
    const btn = screen.getByRole('button', { name: /show password/i })
    expect(btn).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(btn)
    expect(screen.getByRole('button', { name: /hide password/i }))
      .toHaveAttribute('aria-pressed', 'true')
  })

  it('forwards arbitrary input props (autoComplete, placeholder, required)', () => {
    render(<PasswordField
      autoComplete="new-password" placeholder="enter pw" required data-testid="pw"
    />)
    const input = screen.getByTestId('pw')
    expect(input).toHaveAttribute('autocomplete', 'new-password')
    expect(input).toHaveAttribute('placeholder', 'enter pw')
    expect(input).toBeRequired()
  })
})
