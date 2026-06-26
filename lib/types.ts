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
