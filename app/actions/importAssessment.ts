'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { AssessmentImport, Question } from '@/lib/types'

export async function importAssessment(
  json: AssessmentImport,
): Promise<{ assessmentId: string }> {
  // --- fail-closed validation ---
  const questionIds = new Set(json.questions.map((q) => q.id))
  const keyIds = new Set(Object.keys(json.answer_key))
  if (questionIds.size !== json.questions.length) {
    throw new Error('Duplicate question ids in import')
  }
  if (
    questionIds.size !== keyIds.size ||
    [...questionIds].some((id) => !keyIds.has(id))
  ) {
    throw new Error('answer_key qids do not match question ids')
  }
  const basePoints = json.questions
    .filter((q) => !q.is_bonus)
    .reduce((sum, q) => sum + q.points, 0)
  if (json.total_points !== basePoints) {
    throw new Error(
      `total_points (${json.total_points}) != sum of non-bonus points (${basePoints})`,
    )
  }

  // --- caller identity + role gate ---
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!profile || (profile.role !== 'instructor' && profile.role !== 'admin')) {
    throw new Error('Only instructors or admins may import assessments')
  }

  // --- rebuild questions field-by-field (whitelist; no answer field can leak) ---
  const questions: Question[] = json.questions.map((q) => {
    const base: Question = {
      id: q.id,
      kind: q.kind,
      prompt: q.prompt,
      points: q.points,
      is_bonus: q.is_bonus,
    }
    if (q.kind === 'mcq') base.options = q.options
    return base
  })

  // --- insert assessment + key ATOMICALLY (single transaction in the RPC) ---
  // A function body is one transaction, so a key-insert failure rolls back the
  // assessment insert too — no orphan rows.
  const { data: newId, error: rpcErr } = await admin.rpc('import_assessment', {
    p_instructor: user.id,
    p_title: json.title,
    p_type: json.type,
    p_total_points: json.total_points,
    p_questions: questions,
    p_answer_key: json.answer_key,
  })
  if (rpcErr || !newId) {
    throw new Error(`Failed to import assessment: ${rpcErr?.message ?? 'unknown'}`)
  }

  return { assessmentId: newId as string }
}
