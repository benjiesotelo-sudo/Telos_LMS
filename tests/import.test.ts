import { describe, it, expect, beforeAll } from 'vitest'
import quiz1 from '@/tests/fixtures/quiz-1.json'
import { importAssessment } from '@/app/actions/importAssessment'
import { gradeSubmission } from '@/lib/grading'
import { createAdminClient } from '@/lib/supabase/server'
import { createUser } from '@/tests/helpers/fixtures'
import { setTestUser } from '@/tests/helpers/auth'
import type { AssessmentImport, Question, AnswerKeyItem } from '@/lib/types'

const json = quiz1 as AssessmentImport

describe('importAssessment', () => {
  const password = 'pw-import-12345'
  const email = 'instructor.import@example.com'

  beforeAll(async () => {
    await createUser({ role: 'instructor', email, password, fullName: 'Import Owner' })
  })

  it('stores answer-free questions + a server-only answer key, scoped to the caller', async () => {
    await setTestUser(email, password)
    const { assessmentId } = await importAssessment(json)
    expect(assessmentId).toBeTruthy()

    const admin = createAdminClient()
    const { data: assessment } = await admin
      .from('assessments')
      .select('instructor_id, total_points, questions')
      .eq('id', assessmentId)
      .single()
    expect(assessment).toBeTruthy()
    expect(assessment!.total_points).toBe(30)

    // caller is the owner
    const { data: { user } } = await (await (await import('@/lib/supabase/server')).createClient()).auth.getUser()
    expect(assessment!.instructor_id).toBe(user!.id)

    // NO answer fields ever reach assessments.questions
    const storedQs = assessment!.questions as Question[]
    expect(storedQs.length).toBe(json.questions.length)
    for (const q of storedQs) {
      expect(q).not.toHaveProperty('correct')
      expect(q).not.toHaveProperty('correct_index')
      expect(q).not.toHaveProperty('value')
      expect(q).not.toHaveProperty('answer')
      expect(Object.keys(q).sort()).toEqual(
        (q.kind === 'mcq'
          ? ['id', 'is_bonus', 'kind', 'options', 'points', 'prompt']
          : ['id', 'is_bonus', 'kind', 'points', 'prompt']),
      )
    }

    // the answer key lives ONLY in assessment_keys
    const { data: keyRow } = await admin
      .from('assessment_keys')
      .select('answer_key')
      .eq('assessment_id', assessmentId)
      .single()
    expect(keyRow).toBeTruthy()
    const answerKey = keyRow!.answer_key as Record<string, AnswerKeyItem>
    expect(Object.keys(answerKey).sort()).toEqual(Object.keys(json.answer_key).sort())

    // grade the STORED key:
    // perfect (all 31 incl. bonus q31) -> earned 35, possible 30
    const perfect: Record<string, string> = {}
    for (const qid in answerKey) perfect[qid] = answerKey[qid].value
    expect(gradeSubmission(perfect, answerKey)).toEqual({ earned: 35, possible: 30 })

    // regular items only -> 30/30
    const regularPerfect: Record<string, string> = {}
    for (const qid in answerKey) {
      if (!answerKey[qid].is_bonus) regularPerfect[qid] = answerKey[qid].value
    }
    expect(gradeSubmission(regularPerfect, answerKey)).toEqual({ earned: 30, possible: 30 })

    // missing 6 regular items -> 24/30
    const regularIds = storedQs.filter((q) => !q.is_bonus).map((q) => q.id)
    const missing6 = { ...regularPerfect }
    for (const qid of regularIds.slice(0, 6)) missing6[qid] = '__wrong__'
    expect(gradeSubmission(missing6, answerKey)).toEqual({ earned: 24, possible: 30 })
  })

  it('rejects malformed JSON (answer_key qid mismatch)', async () => {
    await setTestUser(email, password)
    const broken: AssessmentImport = {
      ...json,
      answer_key: Object.fromEntries(
        Object.entries(json.answer_key).filter(([qid]) => qid !== 'q1'),
      ),
    }
    await expect(importAssessment(broken)).rejects.toThrow()
  })

  it('is atomic: a failed answer-key insert leaves NO orphan assessment row', async () => {
    const admin = createAdminClient()
    const { data: owner } = await admin.from('profiles').select('id').eq('role', 'instructor').limit(1).single()
    const uniqueTitle = `ORPHAN_PROBE_${Date.now()}`
    // Call the RPC directly with a NULL answer_key → the second insert violates NOT NULL,
    // rolling back the whole transaction (so the assessment must not persist).
    const { error } = await admin.rpc('import_assessment', {
      p_instructor: owner!.id,
      p_title: uniqueTitle,
      p_type: 'quiz',
      p_total_points: 1,
      p_questions: [],
      p_answer_key: null,
    })
    expect(error).not.toBeNull()
    const { data: orphans } = await admin.from('assessments').select('id').eq('title', uniqueTitle)
    expect(orphans ?? []).toHaveLength(0)
  })
})
