import fc from 'fast-check'

// Property-based tests must run a minimum of 100 iterations per property.
// (Testing Strategy: Property-Based Tests — library + 100 iterations)
fc.configureGlobal({ numRuns: 100 })
