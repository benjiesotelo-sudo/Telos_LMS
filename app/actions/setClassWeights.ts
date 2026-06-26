'use server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { refresh } from 'next/cache'

export interface SetClassWeightsInput {
  classId: string
  wtQuiz: number
  wtPaper: number
  wtExam: number
}

export async function setClassWeights(input: SetClassWeightsInput): Promise<{ ok: true }> {
  // ── 1. Validate weights sum ────────────────────────────────────────────────
  const sum = input.wtQuiz + input.wtPaper + input.wtExam
  if (Math.abs(sum - 1) >= 0.001) {
    throw new Error(`Weights must sum to 1.0 (got ${sum.toFixed(6)}); adjust quiz/paper/exam so the sum equals 1.`)
  }

  // ── 2. Auth + owner guard ─────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: auth, error: authErr } = await supabase.auth.getUser()
  if (authErr || !auth.user) throw new Error('Not authenticated')
  const callerId = auth.user.id

  const { data: caller } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', callerId)
    .single()
  const isAdmin = caller?.role === 'admin'

  const admin = createAdminClient()

  const { data: cls, error: clsErr } = await admin
    .from('classes')
    .select('instructor_id')
    .eq('id', input.classId)
    .single()
  if (clsErr || !cls) throw new Error('Class not found')
  if (!isAdmin && cls.instructor_id !== callerId) throw new Error('Not the class owner')

  // ── 3. Update weights ──────────────────────────────────────────────────────
  const { error: updErr } = await admin
    .from('classes')
    .update({ wt_quiz: input.wtQuiz, wt_paper: input.wtPaper, wt_exam: input.wtExam })
    .eq('id', input.classId)
  if (updErr) throw new Error(`Failed to update weights: ${updErr.message}`)

  refresh()
  return { ok: true }
}
