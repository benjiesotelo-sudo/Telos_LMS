// tests/gradebook.test.ts
import { describe, it, expect } from 'vitest'
import {
  transmute,
  categoryAverage,
  periodMark,
  courseMark,
  gradeFor,
} from '@/lib/gradebook'

// ---------------------------------------------------------------------------
// transmute — boundary checks
// ---------------------------------------------------------------------------
describe('transmute', () => {
  it('49 → F / 0.0', () => {
    expect(transmute(49)).toEqual({ letter: 'F', qp: 0.0 })
  })
  it('0 → F / 0.0', () => {
    expect(transmute(0)).toEqual({ letter: 'F', qp: 0.0 })
  })
  it('50 → D / 1.0 (lowest passing)', () => {
    expect(transmute(50)).toEqual({ letter: 'D', qp: 1.0 })
  })
  it('56 → D / 1.0', () => {
    expect(transmute(56)).toEqual({ letter: 'D', qp: 1.0 })
  })
  it('57 → D+ / 1.5', () => {
    expect(transmute(57)).toEqual({ letter: 'D+', qp: 1.5 })
  })
  it('63 → D+ / 1.5', () => {
    expect(transmute(63)).toEqual({ letter: 'D+', qp: 1.5 })
  })
  it('64 → C / 2.0', () => {
    expect(transmute(64)).toEqual({ letter: 'C', qp: 2.0 })
  })
  it('70 → C / 2.0', () => {
    expect(transmute(70)).toEqual({ letter: 'C', qp: 2.0 })
  })
  it('71 → C+ / 2.5', () => {
    expect(transmute(71)).toEqual({ letter: 'C+', qp: 2.5 })
  })
  it('77 → C+ / 2.5', () => {
    expect(transmute(77)).toEqual({ letter: 'C+', qp: 2.5 })
  })
  it('78 → B / 3.0', () => {
    expect(transmute(78)).toEqual({ letter: 'B', qp: 3.0 })
  })
  it('84 → B / 3.0', () => {
    expect(transmute(84)).toEqual({ letter: 'B', qp: 3.0 })
  })
  it('85 → B+ / 3.5', () => {
    expect(transmute(85)).toEqual({ letter: 'B+', qp: 3.5 })
  })
  it('91 → B+ / 3.5', () => {
    expect(transmute(91)).toEqual({ letter: 'B+', qp: 3.5 })
  })
  it('92 → A / 4.0', () => {
    expect(transmute(92)).toEqual({ letter: 'A', qp: 4.0 })
  })
  it('100 → A / 4.0', () => {
    expect(transmute(100)).toEqual({ letter: 'A', qp: 4.0 })
  })
  it('105 → A / 4.0 (bonus may exceed 100)', () => {
    expect(transmute(105)).toEqual({ letter: 'A', qp: 4.0 })
  })
})

// ---------------------------------------------------------------------------
// categoryAverage — arithmetic mean; null if empty
// ---------------------------------------------------------------------------
describe('categoryAverage', () => {
  it('[80, 90] → 85', () => {
    expect(categoryAverage([80, 90])).toBe(85)
  })
  it('[] → null', () => {
    expect(categoryAverage([])).toBeNull()
  })
  it('[70] → 70 (single item)', () => {
    expect(categoryAverage([70])).toBe(70)
  })
  it('[60, 70, 80] → 70', () => {
    expect(categoryAverage([60, 70, 80])).toBe(70)
  })
  it('[100] → 100', () => {
    expect(categoryAverage([100])).toBe(100)
  })
})

// ---------------------------------------------------------------------------
// periodMark — default weights 30 / 20 / 50
// ---------------------------------------------------------------------------
describe('periodMark', () => {
  it('all null → null', () => {
    expect(periodMark({ quizzes: null, papers: null, exam: null })).toBeNull()
  })

  // --- WITH Papers (standard 30/20/50) ---
  it('quizzes=85 papers=75 exam=90 → 85.5', () => {
    // 85*0.30 + 75*0.20 + 90*0.50 = 25.5 + 15 + 45 = 85.5
    expect(periodMark({ quizzes: 85, papers: 75, exam: 90 })).toBe(85.5)
  })
  it('quizzes=80 papers=70 exam=88 → 82', () => {
    // 80*0.30 + 70*0.20 + 88*0.50 = 24 + 14 + 44 = 82
    expect(periodMark({ quizzes: 80, papers: 70, exam: 88 })).toBe(82)
  })

  // --- WITHOUT Papers (spec explicit 50/50 fallback) ---
  it('papers=null quizzes=85 exam=90 → 87.5 (50/50 fallback)', () => {
    // 85*0.50 + 90*0.50 = 42.5 + 45 = 87.5
    expect(periodMark({ quizzes: 85, papers: null, exam: 90 })).toBe(87.5)
  })
  it('papers=null quizzes=60 exam=80 → 70 (50/50 fallback)', () => {
    expect(periodMark({ quizzes: 60, papers: null, exam: 80 })).toBe(70)
  })

  // --- papers=null with one of quizzes/exam also null ---
  it('papers=null quizzes=null exam=90 → 90', () => {
    expect(periodMark({ quizzes: null, papers: null, exam: 90 })).toBe(90)
  })
  it('papers=null quizzes=85 exam=null → 85', () => {
    expect(periodMark({ quizzes: 85, papers: null, exam: null })).toBe(85)
  })

  // --- papers present, one other category null (general renorm) ---
  it('quizzes=null papers=70 exam=88 → proportional renorm of 0.20+0.50', () => {
    // totalW = 0.70; papers contribution = 0.20/0.70*70 = 20; exam = 0.50/0.70*88 ≈ 62.857...
    const expected = (0.20 / 0.70) * 70 + (0.50 / 0.70) * 88
    expect(periodMark({ quizzes: null, papers: 70, exam: 88 })).toBeCloseTo(expected, 10)
  })
  it('quizzes=85 papers=75 exam=null → proportional renorm of 0.30+0.20', () => {
    // totalW = 0.50; quiz = 0.30/0.50*85 = 51; papers = 0.20/0.50*75 = 30 → 81
    const expected = (0.30 / 0.50) * 85 + (0.20 / 0.50) * 75
    expect(periodMark({ quizzes: 85, papers: 75, exam: null })).toBeCloseTo(expected, 10)
  })

  // --- custom weights ---
  it('custom weights: GE 70/30/0 split (no exam)', () => {
    // wtQuiz=0.70, wtPaper=0.30, wtExam=0 — exam null; papers present
    // renorm: quiz=0.70/(0.70+0.30)*85 + papers=0.30/(0.70+0.30)*75 = 0.70*85 + 0.30*75 = 59.5+22.5=82
    expect(
      periodMark(
        { quizzes: 85, papers: 75, exam: null },
        { wtQuiz: 0.70, wtPaper: 0.30, wtExam: 0.00 }
      )
    ).toBeCloseTo(82, 10)
  })
  it('all three present with custom weights', () => {
    // wtQuiz=0.40, wtPaper=0.10, wtExam=0.50
    // 80*0.40 + 70*0.10 + 88*0.50 = 32+7+44 = 83
    expect(
      periodMark(
        { quizzes: 80, papers: 70, exam: 88 },
        { wtQuiz: 0.40, wtPaper: 0.10, wtExam: 0.50 }
      )
    ).toBe(83)
  })
})

// ---------------------------------------------------------------------------
// courseMark — simple average, null propagation
// ---------------------------------------------------------------------------
describe('courseMark', () => {
  it('(80, 90) → 85', () => {
    expect(courseMark(80, 90)).toBe(85)
  })
  it('(80, null) → 80', () => {
    expect(courseMark(80, null)).toBe(80)
  })
  it('(null, 90) → 90', () => {
    expect(courseMark(null, 90)).toBe(90)
  })
  it('(null, null) → null', () => {
    expect(courseMark(null, null)).toBeNull()
  })
  it('(85.5, 82) → 83.75 (rounds to 2 dp)', () => {
    expect(courseMark(85.5, 82)).toBe(83.75)
  })
  it('result rounds to 2 decimal places', () => {
    // (80 + 81) / 2 = 80.5 (clean)
    expect(courseMark(80, 81)).toBe(80.5)
  })
  it('odd third-dp is rounded correctly', () => {
    // (71.3 + 72.4) / 2 = 71.85
    expect(courseMark(71.3, 72.4)).toBe(71.85)
  })
})

// ---------------------------------------------------------------------------
// gradeFor — null passthrough + rounded transmutation
// ---------------------------------------------------------------------------
describe('gradeFor', () => {
  it('null → null', () => {
    expect(gradeFor(null)).toBeNull()
  })
  it('83.75 → { mark:84, letter:"B", qp:3.0 }', () => {
    expect(gradeFor(83.75)).toEqual({ mark: 84, letter: 'B', qp: 3.0 })
  })
  it('91.4 → { mark:91, letter:"B+", qp:3.5 }', () => {
    expect(gradeFor(91.4)).toEqual({ mark: 91, letter: 'B+', qp: 3.5 })
  })
  it('91.5 → { mark:92, letter:"A", qp:4.0 } (rounds up to 92)', () => {
    expect(gradeFor(91.5)).toEqual({ mark: 92, letter: 'A', qp: 4.0 })
  })
  it('49.9 → { mark:50, letter:"D", qp:1.0 } (rounds up to 50)', () => {
    expect(gradeFor(49.9)).toEqual({ mark: 50, letter: 'D', qp: 1.0 })
  })
  it('49.4 → { mark:49, letter:"F", qp:0.0 }', () => {
    expect(gradeFor(49.4)).toEqual({ mark: 49, letter: 'F', qp: 0.0 })
  })
})

// ---------------------------------------------------------------------------
// End-to-end: a full two-period course example
// ---------------------------------------------------------------------------
describe('end-to-end FEU course grade', () => {
  it('computes course grade from raw category averages', () => {
    // Midterm
    //   quizzes: items [70, 80, 90] → average 80
    //   papers:  items [75, 85]     → average 80
    //   exam:    items [88]         → average 88
    //   periodMark = 80*0.30 + 80*0.20 + 88*0.50 = 24 + 16 + 44 = 84
    const midQuizAvg = categoryAverage([70, 80, 90])   // 80
    const midPaperAvg = categoryAverage([75, 85])       // 80
    const midExamAvg = categoryAverage([88])            // 88
    const midMark = periodMark({
      quizzes: midQuizAvg,
      papers: midPaperAvg,
      exam: midExamAvg,
    })
    expect(midMark).toBe(84)

    // Final
    //   quizzes: [65, 75] → 70
    //   papers:  [80]     → 80
    //   exam:    [90]     → 90
    //   periodMark = 70*0.30 + 80*0.20 + 90*0.50 = 21 + 16 + 45 = 82
    const finQuizAvg = categoryAverage([65, 75])        // 70
    const finPaperAvg = categoryAverage([80])           // 80
    const finExamAvg = categoryAverage([90])            // 90
    const finMark = periodMark({
      quizzes: finQuizAvg,
      papers: finPaperAvg,
      exam: finExamAvg,
    })
    expect(finMark).toBe(82)

    // Course = round((84 + 82) / 2, 2) = 83
    const course = courseMark(midMark, finMark)
    expect(course).toBe(83)

    // Letter grade: gradeFor(83) → mark=83 → 78–84 → B / 3.0
    const grade = gradeFor(course)
    expect(grade).toEqual({ mark: 83, letter: 'B', qp: 3.0 })
  })

  it('no-papers fallback: both periods without Papers column', () => {
    // Midterm: quizzes=80, papers=null, exam=88 → 50/50 → 84
    const midMark = periodMark({ quizzes: 80, papers: null, exam: 88 })
    expect(midMark).toBe(84)

    // Final: quizzes=70, papers=null, exam=90 → 50/50 → 80
    const finMark = periodMark({ quizzes: 70, papers: null, exam: 90 })
    expect(finMark).toBe(80)

    // Course = round((84 + 80) / 2, 2) = 82
    const course = courseMark(midMark, finMark)
    expect(course).toBe(82)

    // gradeFor(82) → mark=82 → B / 3.0
    expect(gradeFor(course)).toEqual({ mark: 82, letter: 'B', qp: 3.0 })
  })
})
