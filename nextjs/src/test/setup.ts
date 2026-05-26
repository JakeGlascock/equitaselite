import '@testing-library/jest-dom'
// Type-augmentation for Vi.Assertion adding toHaveNoViolations. The
// import doesn't perform runtime registration (vitest-axe ships an
// empty .js for this entry); we still need expect.extend below.
import 'vitest-axe/extend-expect'
import { expect } from 'vitest'
import * as axeMatchers from 'vitest-axe/matchers'

// Runtime registration. Without this, expect(...).toHaveNoViolations()
// throws "Invalid Chai property" even though the type augmentation
// makes the TypeScript layer happy.
expect.extend(axeMatchers)
