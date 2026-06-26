'use server'
import { createClient } from '@/lib/supabase/server'
import type { ClassRow } from '@/lib/types'

export async function listClasses(): Promise<ClassRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('classes')
    .select('id, course_id, period, section_label, pic, course:course_id(code, title)')
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map((c: any) => ({
    id: c.id,
    courseId: c.course_id,
    code: c.course?.code ?? '',
    title: c.course?.title ?? '',
    period: c.period,
    sectionLabel: c.section_label,
    pic: c.pic ?? '',
    displayName: `${c.course?.code ?? ''} - ${c.section_label}`,
  }))
}

export async function listPics(): Promise<string[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('classes').select('pic')
  const set = new Set((data ?? []).map((r: any) => r.pic).filter((p: string) => p && p.trim()))
  return [...set].sort()
}
