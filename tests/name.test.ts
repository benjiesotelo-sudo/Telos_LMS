import { describe, it, expect } from 'vitest'
import { composeFullName } from '@/lib/name'
describe('composeFullName', () => {
  it('composes first MI last', () => {
    expect(composeFullName({ firstName: 'Benjamin', middleInitial: 'C.', lastName: 'Sotelo' })).toBe('Benjamin C. Sotelo')
  })
  it('includes suffix with a comma', () => {
    expect(composeFullName({ firstName: 'John', lastName: 'Doe', suffix: 'Jr.' })).toBe('John Doe, Jr.')
  })
  it('includes prefix when present', () => {
    expect(composeFullName({ prefix: 'Dr.', firstName: 'Jane', lastName: 'Roe' })).toBe('Dr. Jane Roe')
  })
  it('skips empty middle/suffix cleanly', () => {
    expect(composeFullName({ firstName: 'Mamoun', middleInitial: 'F R', lastName: 'Bani' })).toBe('Mamoun F R Bani')
  })
})
