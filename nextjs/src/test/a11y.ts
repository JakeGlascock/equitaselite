import { axe, type AxeMatchers } from 'vitest-axe'
import { expect } from 'vitest'

// Thin a11y check helper. Runs axe-core against the rendered container
// and asserts no violations. Defaults focus to WCAG 2 A + AA — colour
// contrast is excluded because jsdom doesn't actually paint pixels so
// it can't measure contrast reliably.
//
// Usage:
//   const { container } = render(<MyComponent />)
//   await expectNoA11yViolations(container)
export async function expectNoA11yViolations(container: HTMLElement): Promise<void> {
  const results = await axe(container, {
    rules: {
      // jsdom doesn't render so colour-contrast and link-in-text-block
      // (which depend on real computed styles) always misfire. Excluded
      // here; Lighthouse covers them at the real-rendered level.
      'color-contrast':       { enabled: false },
      'link-in-text-block':   { enabled: false },
    },
  })
  expect(results).toHaveNoViolations()
}

// Re-export for tests that want richer assertions on individual violations.
export { axe }
export type { AxeMatchers }
