import { describe, it, expect } from 'vitest'
import fc from 'fast-check'

// Smoke test verifying the test runner and fast-check are wired up correctly.
describe('test tooling smoke test', () => {
  it('runs a basic vitest assertion', () => {
    expect(1 + 1).toBe(2)
  })

  it('runs a fast-check property', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (a, b) => {
        return a + b === b + a
      }),
    )
  })
})
