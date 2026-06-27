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
  /**
   * The assessment's maximum raw score (assessments.total_points).
   * Used to convert a raw override into a cell percentage:
   *   cell% = rawScore / totalPoints * 100
   * Also surfaced in the GradeSheet input hint ("/ {totalPoints}").
   */
  totalPoints: number
}

/**
 * One student row in the section gradebook.
 *
 * cells: keyed by assessmentId.  Value is a PERCENTAGE (0–100+):
 *   - If an override exists: rawScore / totalPoints * 100  (may exceed 100 for bonus).
 *   - Else if an auto-graded submission exists (possible > 0): earned / possible * 100.
 *   - Else: null (no data).
 *
 * rawOverrides: keyed by assessmentId.  Present ONLY for cells that have a
 * grade_override row.  The stored raw score (not the converted %) — used to
 * prefill the GradeSheet edit input with the previously-entered raw value.
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
  /**
   * Raw override scores (the value stored in grade_overrides.score) for each
   * assessment that has an override.  Empty object when no overrides exist.
   * Used to prefill the override input with the last-entered raw score.
   */
  rawOverrides: Record<string, number>
  /**
   * Auto-graded raw score (submissions.earned) for each assessment the student
   * has an online submission for.  Present ONLY when a submission exists —
   * manual/offline assessments never appear here.  The per-assessment GradeEditor
   * uses this to show "auto N" and to decide whether an entered value differs
   * from the auto score (an override is created only when it does).
   */
  autoRaw: Record<string, number>
  midtermMark: number | null
  finalMark:   number | null
  courseMark:  number | null
  letter: string | null
  qp:     number | null
}

// ---------------------------------------------------------------------------
// ClassDetail — returned by getClassDetail
// ---------------------------------------------------------------------------

export interface ClassDetailAssessment {
  assignmentId: string
  assessmentId: string
  title: string
  type: 'activity' | 'quiz' | 'exam'
  period: 'midterm' | 'final'
  active: boolean
  revealAnswers: boolean
  opensAt: string | null
  closesAt: string | null
  dueDate: string | null
}

export interface ClassDetailStudent {
  studentId: string
  fullName: string
  studentNumber: string | null
  email: string
  status: string
}

export interface ClassDetail {
  class: {
    id: string
    courseId: string
    displayName: string
    code: string
    title: string
    period: string
    sectionLabel: string
    pic: string
    weights: { wtQuiz: number; wtPaper: number; wtExam: number }
  }
  assessments: ClassDetailAssessment[]
  students: ClassDetailStudent[]
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
