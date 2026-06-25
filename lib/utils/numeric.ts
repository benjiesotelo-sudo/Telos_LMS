/**
 * Returns true for strings that are valid mid-entry numeric inputs:
 * empty string, optional leading minus, followed by one or more digits.
 * Disallows decimals, spaces, double-minus, alphabetic chars.
 */
export function isValidNumericInput(s: string): boolean {
  return /^-?\d*$/.test(s)
}
