import { describe, it, expect } from 'vitest'
import { isValidNumericInput } from '@/lib/utils/numeric'
import { shouldRedirectToResult } from '@/lib/utils/submission'

describe('isValidNumericInput', () => {
  it.each([
    ['', true],
    ['-', true],
    ['3', true],
    ['-3', true],
    ['42', true],
    ['-42', true],
  ])('accepts valid mid-entry value %j', (s, expected) => {
    expect(isValidNumericInput(s)).toBe(expected)
  })

  it.each([
    ['3.5', false],
    ['3 ', false],
    ['--3', false],
    ['abc', false],
    [' 3', false],
  ])('rejects invalid value %j', (s, expected) => {
    expect(isValidNumericInput(s)).toBe(expected)
  })
})

describe('shouldRedirectToResult', () => {
  it('returns null for null', () => {
    expect(shouldRedirectToResult(null)).toBeNull()
  })

  it('returns the submission id for an existing submission', () => {
    expect(shouldRedirectToResult({ id: 'abc' })).toBe('abc')
  })
})
