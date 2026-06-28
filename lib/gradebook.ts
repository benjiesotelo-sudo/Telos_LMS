/**
 * lib/gradebook.ts — pure FEU grade computation
 *
 * This module is intentionally free of I/O, database calls, and Next.js APIs.
 * All functions are pure and fully unit-testable.
 *
 * Model source: docs/superpowers/specs/2026-06-26-feu-gradebook-model.md
 */

// ---------------------------------------------------------------------------
// Transmutation table (FEU official, from ECL1103_Grade_Sheet.xlsx)
// ---------------------------------------------------------------------------

export interface TransmuteResult {
  letter: string
  qp: number
}

/**
 * Converts a percentage mark to a letter grade and quality points.
 *
 * The table is inclusive on both ends of each range. Percentages above 100
 * (bonus points) are treated as A/4.0.
 *
 * | %        | Letter | QP  |
 * |----------|--------|-----|
 * | 92–∞     | A      | 4.0 |
 * | 85–91    | B+     | 3.5 |
 * | 78–84    | B      | 3.0 |
 * | 71–77    | C+     | 2.5 |
 * | 64–70    | C      | 2.0 |
 * | 57–63    | D+     | 1.5 |
 * | 50–56    | D      | 1.0 |
 * | 0–49     | F      | 0.0 |
 */
export function transmute(pct: number): TransmuteResult {
  if (pct >= 92) return { letter: 'A',  qp: 4.0 }
  if (pct >= 85) return { letter: 'B+', qp: 3.5 }
  if (pct >= 78) return { letter: 'B',  qp: 3.0 }
  if (pct >= 71) return { letter: 'C+', qp: 2.5 }
  if (pct >= 64) return { letter: 'C',  qp: 2.0 }
  if (pct >= 57) return { letter: 'D+', qp: 1.5 }
  if (pct >= 50) return { letter: 'D',  qp: 1.0 }
  return              { letter: 'F',  qp: 0.0 }
}

// ---------------------------------------------------------------------------
// Category average — adaptive to however many items have scores
// ---------------------------------------------------------------------------

/**
 * Arithmetic mean of the provided item percentages.
 *
 * Caller passes ONLY the items that have a score (unfilled items are excluded
 * by the caller before calling this function). Returns null for an empty array,
 * which signals "no data for this category" to periodMark.
 */
export function categoryAverage(itemPercents: number[]): number | null {
  if (itemPercents.length === 0) return null
  const sum = itemPercents.reduce((acc, v) => acc + v, 0)
  return sum / itemPercents.length
}

// ---------------------------------------------------------------------------
// Period mark — weighted average of quizzes / papers / exam
// ---------------------------------------------------------------------------

export interface PeriodCategories {
  quizzes: number | null
  papers:  number | null
  exam:    number | null
}

export interface PeriodWeights {
  wtQuiz:  number
  wtPaper: number
  wtExam:  number
}

const DEFAULT_WEIGHTS: PeriodWeights = {
  wtQuiz:  0.30,
  wtPaper: 0.20,
  wtExam:  0.50,
}

/**
 * Computes the weighted period mark (Midterm or Final) from category averages.
 *
 * Default weights are 30 / 20 / 50 (Quizzes / Papers-HW-SW / Term Exam) —
 * the "professional/major course" split at FEU Manila.
 *
 * **Missing-category rules** (spec §"Per period mark"):
 *
 * 1. All categories null → null (no data for the period).
 *
 * 2. `papers` is null (no Papers/HW/SW column deployed this period):
 *    → Use the spec's EXPLICIT fallback: quizzes × 0.50 + exam × 0.50.
 *    Note: proportional renormalization of the default weights would give
 *    quiz 0.375 / exam 0.625, NOT 50/50. The spec overrides this with an
 *    explicit 50/50 split ("The no-papers fallback redistributes the 20% so
 *    quizzes+exam = 50/50" — see spec §"Per period mark"). This choice is
 *    intentional and is documented here.
 *    If only one of quizzes/exam is also null, that present value is returned
 *    as-is (i.e. the entire period mark equals the single present category).
 *
 * 3. Any OTHER single missing category (quizzes or exam null, but papers
 *    present): proportional renormalization — drop the missing weight and
 *    rescale the remaining weights to sum to 1. This is the general rule; the
 *    no-papers case above is a spec-specified exception to it.
 */
export function periodMark(
  c: PeriodCategories,
  weights: PeriodWeights = DEFAULT_WEIGHTS
): number | null {
  const { quizzes, papers, exam } = c
  const { wtQuiz, wtPaper, wtExam } = weights

  // Rule 2 — spec explicit: no Papers column → 50/50 quizzes / exam
  if (papers === null) {
    if (quizzes === null && exam === null) return null
    if (quizzes === null) return exam
    if (exam === null)    return quizzes
    return quizzes * 0.5 + exam * 0.5
  }

  // Papers is present — Rule 3: proportional renormalization for any other
  // missing categories (also handles the all-present path when totalW = 1).
  const items: Array<{ value: number; weight: number }> = []
  if (quizzes !== null) items.push({ value: quizzes, weight: wtQuiz  })
  if (papers  !== null) items.push({ value: papers,  weight: wtPaper })
  if (exam    !== null) items.push({ value: exam,    weight: wtExam  })

  if (items.length === 0) return null // shouldn't happen (papers was checked), but guard

  const totalWeight = items.reduce((acc, item) => acc + item.weight, 0)
  return items.reduce((acc, item) => acc + item.value * (item.weight / totalWeight), 0)
}

// ---------------------------------------------------------------------------
// Course mark — average of Midterm and Final period marks
// ---------------------------------------------------------------------------

/**
 * Computes the course mark from Midterm and Final period marks.
 *
 * Spec: "ROUND((MidtermMark + FinalMark) / 2, 2)"
 *   - Both null → null
 *   - One null  → the other (whichever exists)
 *   - Both present → round((midterm + final) / 2, 2 decimal places)
 */
export function courseMark(
  midterm: number | null,
  finalP:  number | null
): number | null {
  if (midterm === null && finalP === null) return null
  if (midterm === null) return finalP
  if (finalP  === null) return midterm
  return Math.round(((midterm + finalP) / 2) * 100) / 100
}

// ---------------------------------------------------------------------------
// gradeFor — round to integer, then transmute
// ---------------------------------------------------------------------------

export interface GradeResult {
  mark:   number
  letter: string
  qp:     number
}

/**
 * Derives the letter grade and quality points for a percentage mark.
 *
 * The mark is rounded to the nearest integer before table lookup (e.g. 83.75
 * → 84 → B/3.0). Returns null if pct is null.
 */
export function gradeFor(pct: number | null): GradeResult | null {
  if (pct === null) return null
  const mark = Math.round(pct)
  const { letter, qp } = transmute(mark)
  return { mark, letter, qp }
}

// ---------------------------------------------------------------------------
// computeStudentMarks — per-student MG/FG/Course/letter from cell percentages
// ---------------------------------------------------------------------------

export interface StudentMarks {
  midtermMark: number | null
  finalMark:   number | null
  courseMark:  number | null
  letter:      string | null
  qp:          number | null
}

export interface MarkAssessment {
  assessmentId: string
  /** quiz · homework · activity · exam (homework + activity share the papers bucket). */
  type:   'quiz' | 'homework' | 'activity' | 'exam'
  period: 'midterm' | 'final'
  /** Default true. When false the assessment is ungraded (practice) and excluded from marks. */
  graded?: boolean
}

/**
 * Pure per-student mark computation, shared by getSectionGrades (server) and the
 * Grade Editor live preview (client). `cells` maps assessmentId → cell percentage
 * (null/undefined = no score). Groups non-null cells by period + category, then
 * applies the FEU period/course/letter math from this module — so the editor's
 * live preview can never drift from the saved computation.
 */
export function computeStudentMarks(
  cells: Record<string, number | null>,
  assessments: MarkAssessment[],
  weights: { wtQuiz: number; wtPaper: number; wtExam: number },
): StudentMarks {
  const groups: Record<
    'midterm' | 'final',
    { quizzes: number[]; papers: number[]; exam: number[] }
  > = {
    midterm: { quizzes: [], papers: [], exam: [] },
    final:   { quizzes: [], papers: [], exam: [] },
  }

  for (const a of assessments) {
    if (a.graded === false) continue // ungraded/practice — excluded from marks
    const val = cells[a.assessmentId]
    if (val === null || val === undefined) continue
    const g = groups[a.period]
    if      (a.type === 'quiz')     g.quizzes.push(val)
    else if (a.type === 'exam')     g.exam.push(val)
    else                            g.papers.push(val) // 'activity' OR 'homework' → Papers/HW
  }

  const midtermMark = periodMark(
    {
      quizzes: categoryAverage(groups.midterm.quizzes),
      papers:  categoryAverage(groups.midterm.papers),
      exam:    categoryAverage(groups.midterm.exam),
    },
    weights,
  )
  const finalMark = periodMark(
    {
      quizzes: categoryAverage(groups.final.quizzes),
      papers:  categoryAverage(groups.final.papers),
      exam:    categoryAverage(groups.final.exam),
    },
    weights,
  )
  const cm    = courseMark(midtermMark, finalMark)
  const grade = gradeFor(cm)

  return {
    midtermMark,
    finalMark,
    courseMark: cm,
    letter: grade?.letter ?? null,
    qp:     grade?.qp     ?? null,
  }
}
