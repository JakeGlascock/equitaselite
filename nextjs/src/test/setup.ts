import '@testing-library/jest-dom'
import { expect } from 'vitest'
import * as axeMatchers from 'vitest-axe/matchers'

// Adds expect(...).toHaveNoViolations() — the axe-core assertion used by
// the a11y checks added in Phase T5. Each component test that calls
// `await axe(container)` then asserts toHaveNoViolations on the result.
expect.extend(axeMatchers)
