import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { listClasses } from '@/app/actions/listClasses'
import { getSectionGrades } from '@/app/actions/getSectionGrades'
import { SectionPicker } from './SectionPicker'
import { GradeSheet } from './GradeSheet'

export default async function GradesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) redirect('/login')

  const { classId: classIdRaw } = await searchParams
  const classId = typeof classIdRaw === 'string' && classIdRaw ? classIdRaw : undefined

  const classes = await listClasses()

  let grades = null
  let gradesError: string | null = null

  if (classId) {
    try {
      grades = await getSectionGrades({ classId })
    } catch (e) {
      gradesError = e instanceof Error ? e.message : 'Failed to load grades.'
    }
  }

  return (
    // Expand beyond the default 880 px max-width so a wide grade table has room.
    <div className="feu-page" style={{ maxWidth: 'none' }}>
      <h1>Grades</h1>
      <p className="feu-page-sub">
        Select a class section to view the FEU grade sheet and enter manual overrides.
      </p>

      <SectionPicker key={classId ?? ''} classes={classes} selected={classId} />

      {gradesError && (
        <p style={{ color: '#c0392b', fontSize: 13, marginBottom: 16 }}>{gradesError}</p>
      )}

      {!classId && (
        <p className="feu-muted" style={{ marginTop: 8 }}>
          Choose a section above to load its grade sheet.
        </p>
      )}

      {grades && <GradeSheet grades={grades} classId={classId!} />}
    </div>
  )
}
