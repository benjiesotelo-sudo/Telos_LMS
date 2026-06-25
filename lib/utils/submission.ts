/**
 * Returns the submission id if a graded submission exists, null otherwise.
 * Used to decide whether to redirect to results page.
 */
export function shouldRedirectToResult(
  submission: { id: string } | null
): string | null {
  return submission ? submission.id : null
}
