'use server'

export async function submitAssessment(
  _input: { assignmentId: string; answers: Record<string, string> },
): Promise<{ submissionId: string; earned: number; possible: number }> {
  throw new Error('not implemented')
}
