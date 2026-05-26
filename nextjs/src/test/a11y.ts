import { axe } from 'vitest-axe'
import { expect } from 'vitest'

// vitest-axe augments `Vi.Assertion<T = any>` with `toHaveNoViolations`,
// but the `axe()` return type narrows `T` to `AxeResults` and vitest's
// generic doesn't compose with the augmentation in that branch. We cast
// the assertion call site via `unknown` — the matcher IS registered at
// runtime by setup.ts; the cast is purely a TypeScript escape hatch.

// Thin a11y check helper. Runs axe-core against the rendered container
// and asserts no violations. Defaults focus to WCAG 2 A + AA — colour
// contrast is excluded because jsdom doesn't actually paint pixels so
// it can't measure contrast reliably.
//
// Usage:
//   const { container } = render(<MyComponent />)
//   await expectNoA11yViolations(container)
//
// The toHaveNoViolations matcher is registered globally + typed via the
// `vitest-axe/extend-expect` import in src/test/setup.ts.
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
  // Cast through `unknown` because vitest's generic `Assertion<AxeResults>`
  // doesn't compose with vitest-axe's `Vi.Assertion<T = any>` augmentation.
  // Runtime call resolves to the registered matcher just the same.
  ;(expect(results) as unknown as { toHaveNoViolations(): void }).toHaveNoViolations()
}

// Re-export for tests that want richer assertions on individual violations.
export { axe }
