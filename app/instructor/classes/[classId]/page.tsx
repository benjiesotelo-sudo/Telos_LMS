import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getClassDetail } from '@/app/actions/getClassDetail'
import { AssignmentMetaControls } from '@/app/instructor/AssignmentMetaControls'
import { ClassWeightsForm } from '@/app/instructor/ClassWeightsForm'

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

  const typeLabel: Record<string, string> = {
    quiz: 'Quiz',
    activity: 'Paper/Activity',
    exam: 'Exam',
  }

  return (
    <div className="feu-page">
      {/* Back nav */}
      <p style={{ marginBottom: 8 }}>
        <Link href="/instructor/classes" style={{ color: 'var(--green)', fontSize: 13 }}>
          &larr; All Classes
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
            href={`/instructor/grades/${classId}`}
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
                  {typeLabel[asmt.type] ?? asmt.type}
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

        {students.length === 0 && (
          <p className="feu-muted">No students enrolled yet.</p>
        )}

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f1f7f3' }}>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Student #</th>
                <th style={thStyle}>Email</th>
                <th style={thStyle}>Status</th>
              </tr>
            </thead>
            <tbody>
              {students.map((stu) => (
                <tr key={stu.studentId} style={{ borderBottom: '1px solid var(--line, #eee)' }}>
                  <td style={tdStyle}>{stu.fullName || <span className="feu-muted">—</span>}</td>
                  <td style={tdStyle}>{stu.studentNumber ?? <span className="feu-muted">—</span>}</td>
                  <td style={tdStyle}>{stu.email}</td>
                  <td style={tdStyle}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        color: stu.status === 'active' ? 'var(--green)' : 'var(--gray)',
                      }}
                    >
                      {stu.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Weights editor ───────────────────────────────────────────────── */}
      <section className="feu-card" aria-labelledby="weights-h">
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
    </div>
  )
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '7px 10px',
  fontWeight: 600,
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  color: '#3c5a48',
  borderBottom: '1px solid var(--line, #eee)',
}

const tdStyle: React.CSSProperties = {
  padding: '8px 10px',
  color: 'var(--ink)',
}
