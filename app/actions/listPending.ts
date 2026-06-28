'use server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { PendingRow } from '@/lib/types'

export async function listPending(): Promise<PendingRow[]> {
  const supabase = await createClient()
  const { data: auth, error } = await supabase.auth.getUser()
  if (error || !auth.user) throw new Error('Not authenticated')

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', auth.user.id)
    .single()

  if (!callerProfile) throw new Error('Forbidden')
  const isAdmin = callerProfile.role === 'admin'
  const isInstructor = callerProfile.role === 'instructor'
  if (!isAdmin && !isInstructor) throw new Error('Forbidden')

  const admin = createAdminClient()

  if (isAdmin) {
    // Admin sees all pending profiles, with className from a pending enrollment if one exists.
    const { data: pending, error: pErr } = await admin
      .from('profiles')
      .select(`
        id,
        full_name,
        email,
        student_number,
        join_reason,
        enrollments!student_id (
          status,
          classes:class_id (
            course_id,
            section_label,
            courses:course_id ( code )
          )
        )
      `)
      .eq('status', 'pending')
      .eq('role', 'student')

    if (pErr) throw new Error(pErr.message)

    return (pending ?? []).map((p: any) => {
      const enr = (p.enrollments ?? []).find((e: any) => e.status === 'pending')
      const cls = enr?.classes
      const className = cls
        ? `${cls.courses?.code ?? ''} - ${cls.section_label}`
        : null
      return {
        studentId: p.id,
        fullName: p.full_name,
        email: p.email,
        studentNumber: p.student_number ?? '',
        className,
        reason: p.join_reason ?? null,
      }
    })
  }

  // Instructor path:
  // 1. Pending students enrolled (with pending enrollment) in one of the caller's classes.
  const { data: myClasses } = await admin
    .from('classes')
    .select('id, section_label, courses:course_id(code)')
    .eq('instructor_id', auth.user.id)

  const myClassIds = (myClasses ?? []).map((c: any) => c.id)

  const classMap: Record<string, string> = {}
  for (const c of myClasses ?? []) {
    classMap[c.id] = `${(c.courses as any)?.code ?? ''} - ${c.section_label}`
  }

  const classRows: PendingRow[] = []
  if (myClassIds.length > 0) {
    const { data: placedEnrollments, error: enrErr } = await admin
      .from('enrollments')
      .select(`
        class_id,
        student_id,
        status,
        profiles:student_id (
          id,
          full_name,
          email,
          student_number,
          status,
          join_reason
        )
      `)
      .in('class_id', myClassIds)
      .eq('status', 'pending')

    if (enrErr) throw new Error(enrErr.message)

    for (const enr of placedEnrollments ?? []) {
      const prof = enr.profiles as any
      if (!prof || prof.status !== 'pending') continue
      classRows.push({
        studentId: prof.id,
        fullName: prof.full_name,
        email: prof.email,
        studentNumber: prof.student_number ?? '',
        className: classMap[enr.class_id] ?? null,
        reason: prof.join_reason ?? null,
      })
    }
  }

  // 2. Unplaced pending students: pending profiles with NO enrollment row at all.
  //    (general-link registrants — visible to any instructor per spec). Two-step:
  //    fetch all enrolled student_ids, then keep pending profiles not in that set.
  const { data: allEnrStudents, error: enrErr } = await admin
    .from('enrollments')
    .select('student_id')
  if (enrErr) throw new Error(enrErr.message)
  const enrolledIds = new Set((allEnrStudents ?? []).map((e: any) => e.student_id))
  const { data: allPending, error: upErr } = await admin
    .from('profiles')
    .select('id, full_name, email, student_number, join_reason')
    .eq('status', 'pending')
    .eq('role', 'student')
  if (upErr) throw new Error(upErr.message)
  for (const p of (allPending ?? []) as any[]) {
    if (!enrolledIds.has(p.id)) {
      classRows.push({
        studentId: p.id,
        fullName: p.full_name,
        email: p.email,
        studentNumber: p.student_number ?? '',
        className: null,
        reason: p.join_reason ?? null,
      })
    }
  }

  return classRows
}
