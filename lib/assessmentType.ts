// Single source of truth for assessment-type labels/tags so every surface agrees.
// Four TYPES (quiz · homework · activity · exam); homework + activity both grade in
// the Papers/HW weight bucket.
import type { AssessmentType } from './types'

export const ASSESSMENT_TYPES: AssessmentType[] = ['quiz', 'homework', 'activity', 'exam']

/** Full human label. */
export const TYPE_NAME: Record<string, string> = {
  quiz: 'Quiz',
  homework: 'Homework',
  activity: 'Activity',
  exam: 'Exam',
}

/** One-letter tag shown in tight spaces (grade sheet, badges). */
export const TYPE_TAG: Record<string, string> = {
  quiz: 'Q',
  homework: 'H',
  activity: 'P',
  exam: 'E',
}

export function typeName(t: string): string {
  return TYPE_NAME[t] ?? t
}
export function typeTag(t: string): string {
  return TYPE_TAG[t] ?? '?'
}

/** Column / list ordering within a period. */
export function assessmentOrder(t: string): number {
  return t === 'quiz' ? 0 : t === 'homework' ? 1 : t === 'activity' ? 2 : 3
}
