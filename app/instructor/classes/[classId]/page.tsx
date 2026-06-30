import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getClassDetail } from '@/app/actions/getClassDetail'
import { getClassRemovalRequests } from '@/app/actions/removalRequests'
import { RosterTable } from './RosterTable'
import { typeName } from '@/lib/assessmentType'
import { AssignmentMetaControls } from '@/app/instructor/AssignmentMetaControls'
import { ClassWeightsForm } from '@/app/instructor/ClassWeightsForm'
import { ClassSettingsForm } from '@/app/instructor/ClassSettingsForm'
import { InviteStudent } from './InviteStudent'

export default async function ClassDetailPage({
  params,
}: {
  params: Promise<{ classId: string }>
}) {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) redirect('/login')

  const { classId } = await params

  let detail: Awaited<ReturnType<typeof getClassDetail>> | null = null
  let errorMsg: string | null = null

  try {
    detail = await getClassDetail({ classId })
  } catch (e) {
    errorMsg = e instanceof Error ? e.message : 'Unknown error'
  }

  if (!detail) {
    return (
      <div className="feu-page">
        <h1>Class not found</h1>
        <p className="feu-muted">{errorMsg ?? 'This class could not be loaded.'}</p>
        <Link href="/instructor/classes" style={{ color: 'var(--green)' }}>
          &larr; Back to Classes
        </Link>
      </div>
    )
  }

  const { class: cls, assessments, students } = detail

  // Pending removal requests for this class → student ids (so the roster shows status).
  const removalReqs = await getClassRemovalRequests({ classId: cls.id })
  const pendingRemoval = new Set(removalReqs.filter((r) => r.status === 'pending').map((r) => r.studentId))
  const pendingRemovalIds = [...pendingRemoval]

  return (
    <div className="feu-page">
      {/* Back nav */}
      <p style={{ marginBottom: 8 }}>
        <Link
          href={`/instructor/classes?course=${cls.courseId}`}
          style={{ color: 'var(--green)', fontSize: 13 }}
        >
          &larr; Back to Sections
        </Link>
      </p>

      {/* ── Header card ──────────────────────────────────────────────────── */}
      <section className="feu-card" style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, marginBottom: 4, color: 'var(--green)' }}>
          {cls.displayName}
        </h1>
        <p style={{ fontSize: 15, color: 'var(--ink)', marginBottom: 2 }}>{cls.title}</p>
        <p className="feu-muted" style={{ fontSize: 13 }}>
          {cls.period}
          {cls.pic ? <>&nbsp;·&nbsp;PIC: <strong>{cls.pic}</strong></> : null}
          {cls.sectionLabel ? <>&nbsp;·&nbsp;Section <strong>{cls.sectionLabel}</strong></> : null}
        </p>
        <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
          <Link
            href={`/instructor/grades?classId=${classId}`}
            style={{
              fontSize: 13,
              color: 'var(--green)',
              border: '1px solid var(--green)',
              borderRadius: 5,
              padding: '4px 10px',
              textDecoration: 'none',
            }}
          >
            Grade Sheet &rarr;
          </Link>
        </div>
      </section>

      {/* ── Contents section ─────────────────────────────────────────────── */}
      <section className="feu-card" aria-labelledby="contents-h" style={{ marginBottom: 20 }}>
        <h2 id="contents-h" style={{ fontSize: 16, marginBottom: 14, color: 'var(--green)' }}>
          Contents
        </h2>

        {assessments.length === 0 && (
          <p className="feu-muted">No assessments assigned to this class yet.</p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {assessments.map((asmt) => (
            <div
              key={asmt.assignmentId}
              style={{
                borderBottom: '1px solid var(--line, #eee)',
                paddingBottom: 16,
              }}
            >
              {/* Assessment title row */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{asmt.title}</span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    color: 'var(--gray)',
                    padding: '1px 6px',
                    border: '1px solid var(--line, #e2e8e4)',
                    borderRadius: 3,
                  }}
                >
                  {typeName(asmt.type)}
                </span>
              </div>

              {/* Meta controls (active, reveal, period, deadlines) */}
              <AssignmentMetaControls assignment={asmt} />
            </div>
          ))}
        </div>
      </section>

      {/* ── Students section ─────────────────────────────────────────────── */}
      <section className="feu-card" aria-labelledby="students-h" style={{ marginBottom: 20 }}>
        <h2 id="students-h" style={{ fontSize: 16, marginBottom: 14, color: 'var(--green)' }}>
          Students ({students.length})
        </h2>

        <RosterTable students={students} pendingRemovalIds={pendingRemovalIds} classId={cls.id} />

        <InviteStudent classId={cls.id} />
      </section>

      {/* ── Weights editor ───────────────────────────────────────────────── */}
      <section className="feu-card" aria-labelledby="weights-h" style={{ marginBottom: 20 }}>
        <h2 id="weights-h" style={{ fontSize: 16, marginBottom: 14, color: 'var(--green)' }}>
          Grade Weights
        </h2>
        <ClassWeightsForm
          classId={classId}
          wtQuiz={cls.weights.wtQuiz}
          wtPaper={cls.weights.wtPaper}
          wtExam={cls.weights.wtExam}
        />
      </section>

      {/* ── Class settings ───────────────────────────────────────────────── */}
      <section className="feu-card" aria-labelledby="settings-h">
        <h2 id="settings-h" style={{ fontSize: 16, marginBottom: 4, color: 'var(--green)' }}>
          Class Settings
        </h2>
        <p className="feu-muted" style={{ fontSize: 12, marginBottom: 14 }}>
          Change the academic period or section label for this class.
        </p>
        <ClassSettingsForm
          classId={classId}
          period={cls.period}
          sectionLabel={cls.sectionLabel}
        />
      </section>
    </div>
  )
}
