// lib/grading.ts
import type {
  AnswerKeyItem,
  GradedSubmission,
  ComponentSubmission,
  ComponentWeights,
  ComponentType,
  ComponentResult,
  FinalResult,
} from '@/lib/types'

export function norm(s: unknown): string {
  return String(s == null ? '' : s)
    .trim()
    .toLowerCase()
    .replace(/[−–—]/g, '-') // U+2212 minus, U+2013 en dash, U+2014 em dash -> ASCII hyphen
    .replace(/\s+/g, '')
    .replace(/^\+/, '')
    .replace(/^(-?\d+)\.0+$/, '$1') // 3.0 -> 3
}

export function gradeSubmission(
  answers: Record<string, string>,
  answerKey: Record<string, AnswerKeyItem>,
): GradedSubmission {
  let earned = 0
  let possible = 0
  for (const qid in answerKey) {
    const { value, points, is_bonus } = answerKey[qid]
    if (!is_bonus) possible += points
    const a = answers[qid]
    if (a != null && norm(a) === norm(value)) earned += points
  }
  return { earned, possible }
}

// computeFinal: pool BY POINTS within each component (sum earned / sum possible),
// weight, renormalize over PRESENT components.
export function computeFinal(
  subs: ComponentSubmission[],
  weights: ComponentWeights,
): FinalResult {
  const comp: Record<ComponentType, [number, number]> = {
    activity: [0, 0],
    quiz: [0, 0],
    exam: [0, 0],
  }
  for (const s of subs) {
    comp[s.type][0] += s.earned
    comp[s.type][1] += s.possible
  }
  const components = {} as Record<ComponentType, ComponentResult>
  let final = 0
  let wPresent = 0
  for (const t of ['activity', 'quiz', 'exam'] as ComponentType[]) {
    const e = comp[t][0]
    const p = comp[t][1]
    if (p > 0) {
      const pct = (e / p) * 100
      components[t] = { pct, earned: e, possible: p }
      final += (weights[t] * pct) / 100
      wPresent += weights[t]
    } else {
      components[t] = { pct: null, earned: e, possible: p }
    }
  }
  const totalW = weights.activity + weights.quiz + weights.exam
  const provisional = wPresent > 0 ? final / (wPresent / 100) : 0
  const complete = Math.abs(wPresent - totalW) < 1e-9
  return { components, final, provisional, complete }
}
