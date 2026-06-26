export type UserRole = 'admin' | 'instructor' | 'student'
export type UserStatus = 'pending' | 'active' | 'suspended'

export type QuestionKind = 'num' | 'mcq'

export interface Question {
  id: string
  kind: QuestionKind
  prompt: string
  points: number
  is_bonus: boolean
  options?: string[] // options present iff kind==='mcq', in FINAL display order; NO correct answer here
}

export interface AnswerKeyItem {
  value: string // correct option TEXT (mcq) or integer string (num)
  points: number
  is_bonus: boolean
}

export interface AssessmentImport {
  title: string
  type: 'activity' | 'quiz' | 'exam'
  total_points: number
  questions: Question[]
  answer_key: Record<string, AnswerKeyItem>
}

export interface GradedSubmission {
  earned: number
  possible: number // EXCLUDES bonus
}

export type ComponentType = 'activity' | 'quiz' | 'exam'

export interface ComponentWeights {
  activity: number
  quiz: number
  exam: number // default {activity:10, quiz:40, exam:50}
}

export interface ComponentResult {
  pct: number | null
  earned: number
  possible: number
}

export interface FinalResult {
  components: Record<ComponentType, ComponentResult>
  final: number
  provisional: number
  complete: boolean
}

export interface ComponentSubmission {
  type: ComponentType
  earned: number
  possible: number
}

export interface ClassRow {
  id: string
  courseId: string
  code: string
  title: string
  period: string
  sectionLabel: string
  pic: string
  displayName: string
}

export interface PendingRow {
  studentId: string
  fullName: string
  email: string
  studentNumber: string
  className: string | null
}

export interface AdminUserRow {
  id: string
  fullName: string
  email: string
  role: UserRole
  status: UserStatus
  studentNumber: string | null
}

export interface EnrollLinkRow {
  id: string; token: string; url: string
  kind: 'class' | 'general'
  classId: string | null; className: string | null
  expiresAt: string; createdAt: string
}

export interface GradeOverride {
  id: string
  studentId: string
  assessmentId: string
  classId: string
  score: number       // may exceed 100 (bonus)
  note: string
  instructorId: string
  createdAt: string
  updatedAt: string
}

// ---------------------------------------------------------------------------
// SectionGrades — returned by getSectionGrades; drives the GradeSheet render.
// ---------------------------------------------------------------------------

/** One deployed assessment column in the gradebook. */
export interface SectionAssessmentMeta {
  /** The assignment row id (one deployment of the assessment in this class). */
  id: string
  /** The underlying assessment id — also the key used in SectionStudentRow.cells. */
  assessmentId: string
  title: string
  type: 'activity' | 'quiz' | 'exam'
  period: 'midterm' | 'final'
}

/**
 * One student row in the section gradebook.
 *
 * cells: keyed by assessmentId.  Value = manual override score if one exists,
 * else (earned / possible * 100) from the auto-graded submission (possible > 0),
 * else null (no data).
 *
 * Note: if the same assessment is deployed more than once in the same class the
 * last deployment wins in the cells map (unsupported edge-case; don't do it).
 */
export interface SectionStudentRow {
  studentId: string
  fullName: string
  studentNumber: string | null
  /** Cell percentage for each assessment; null = no submission and no override. */
  cells: Record<string, number | null>
  midtermMark: number | null
  finalMark:   number | null
  courseMark:  number | null
  letter: string | null
  qp:     number | null
}

/** Full section gradebook returned by getSectionGrades. */
export interface SectionGrades {
  class: {
    id: string
    displayName: string
    weights: { wtQuiz: number; wtPaper: number; wtExam: number }
  }
  /** Ordered list of deployed assessment columns (matches gradebook column order). */
  assessments: SectionAssessmentMeta[]
  students: SectionStudentRow[]
}
