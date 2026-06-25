// tests/grading.test.ts
import { describe, it, expect } from 'vitest'
import { norm, gradeSubmission, computeFinal } from '@/lib/grading'
import type {
  AnswerKeyItem,
  ComponentSubmission,
  ComponentWeights,
} from '@/lib/types'

const W: ComponentWeights = { activity: 10, quiz: 40, exam: 50 }
const round2 = (n: number) => Math.round(n * 100) / 100

describe('norm', () => {
  it('treats unicode minus, en dash, em dash as ASCII hyphen', () => {
    expect(norm('−3')).toBe(norm('-3')) // U+2212 minus
    expect(norm('–3')).toBe(norm('-3')) // U+2013 en dash
    expect(norm('—3')).toBe(norm('-3')) // U+2014 em dash
  })
  it('strips a trailing .0 run', () => {
    expect(norm('3.0')).toBe('3')
    expect(norm('3.000')).toBe('3')
  })
  it('trims and lowercases', () => {
    expect(norm('  A ')).toBe('a')
  })
  it('drops a leading plus sign', () => {
    expect(norm('+5')).toBe('5')
  })
  it('does NOT equate 3 and -3', () => {
    expect(norm('3') === norm('-3')).toBe(false)
  })
  it('maps null/undefined to empty string', () => {
    expect(norm(null)).toBe('')
    expect(norm(undefined)).toBe('')
  })
})

describe('gradeSubmission (inline representative fixture)', () => {
  // num q1, mcq q2 (keyed by option TEXT), bonus num q3
  const key: Record<string, AnswerKeyItem> = {
    q1: { value: '7', points: 2, is_bonus: false },
    q2: { value: 'x = 4', points: 3, is_bonus: false },
    q3: { value: '12', points: 5, is_bonus: true },
  }

  it('perfect non-bonus answers -> earned 5 / possible 5 = 100% (bonus excluded from possible)', () => {
    const { earned, possible } = gradeSubmission({ q1: '7', q2: 'x = 4' }, key)
    expect(earned).toBe(5)
    expect(possible).toBe(5)
    expect(round2((earned / possible) * 100)).toBe(100)
  })

  it('grades mcq by option VALUE not letter (selecting the correct TEXT scores)', () => {
    // the chosen value is the option TEXT, not "B"/"C"
    const right = gradeSubmission({ q1: '7', q2: 'x = 4' }, key)
    expect(right.earned).toBe(5)
    const wrong = gradeSubmission({ q1: '7', q2: 'B' }, key)
    expect(wrong.earned).toBe(2) // q2 not matched: only q1 scored
    expect(wrong.possible).toBe(5)
  })

  it('bonus adds to earned but NOT to possible (extra credit)', () => {
    const { earned, possible } = gradeSubmission(
      { q1: '7', q2: 'x = 4', q3: '12' },
      key,
    )
    expect(earned).toBe(10) // 2 + 3 + 5 bonus
    expect(possible).toBe(5) // bonus excluded
    expect(round2((earned / possible) * 100)).toBe(200)
  })

  it('applies norm() to answers (unicode minus, leading plus, trailing .0)', () => {
    const numKey: Record<string, AnswerKeyItem> = {
      a: { value: '-3', points: 1, is_bonus: false },
      b: { value: '5', points: 1, is_bonus: false },
      c: { value: '3', points: 1, is_bonus: false },
    }
    const { earned, possible } = gradeSubmission(
      { a: '−3', b: '+5', c: '3.0' },
      numKey,
    )
    expect(earned).toBe(3)
    expect(possible).toBe(3)
  })
})

describe('computeFinal parity (verbatim numbers from verify_assessments.py)', () => {
  it('Scenario A: varying totals -> final 79.5, complete=true', () => {
    const subs: ComponentSubmission[] = [
      { type: 'activity', earned: 80, possible: 100 },
      { type: 'activity', earned: 10, possible: 20 },
      { type: 'quiz', earned: 24, possible: 30 },
      { type: 'quiz', earned: 20, possible: 25 },
      { type: 'exam', earned: 40, possible: 50 },
    ]
    const r = computeFinal(subs, W)
    expect(round2(r.components.activity.pct as number)).toBe(75.0)
    expect(round2(r.components.quiz.pct as number)).toBe(80.0)
    expect(round2(r.components.exam.pct as number)).toBe(80.0)
    expect(round2(r.final)).toBe(79.5)
    expect(r.complete).toBe(true)
  })

  it('Scenario B: exam missing -> partial 39.5, provisional 79.0, complete=false', () => {
    const subs: ComponentSubmission[] = [
      { type: 'activity', earned: 80, possible: 100 },
      { type: 'activity', earned: 10, possible: 20 },
      { type: 'quiz', earned: 24, possible: 30 },
      { type: 'quiz', earned: 20, possible: 25 },
    ]
    const r = computeFinal(subs, W)
    expect(round2(r.final)).toBe(39.5)
    expect(round2(r.provisional)).toBe(79.0)
    expect(r.complete).toBe(false)
    expect(r.components.exam.pct).toBeNull()
  })

  it('Scenario C: pooling != averaging -> 75.0% (NOT the naive avg 50)', () => {
    const subs: ComponentSubmission[] = [
      { type: 'quiz', earned: 30, possible: 30 }, // 100%
      { type: 'quiz', earned: 0, possible: 10 }, //   0%
    ]
    const r = computeFinal(subs, W)
    const pooled = round2(r.components.quiz.pct as number)
    expect(pooled).toBe(75.0) // 30/40 pooled by points
    expect(pooled).not.toBe(50) // naive average of 100 and 0 would be 50
  })

  it('Scenario D: bonus = extra credit -> quiz 35/30 = 116.67% (round 2dp)', () => {
    const subs: ComponentSubmission[] = [
      { type: 'quiz', earned: 35, possible: 30 },
    ]
    const r = computeFinal(subs, W)
    expect(round2(r.components.quiz.pct as number)).toBe(116.67)
  })
})
