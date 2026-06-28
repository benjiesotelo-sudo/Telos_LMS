import Link from 'next/link'
import type { StudentTask } from '@/lib/types'

const MANILA = 'Asia/Manila'
function fmtDate(iso: string | null): string | null {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleString('en-PH', {
      timeZone: MANILA,
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function typeLabel(t: string): string {
  return t === 'quiz' ? 'Quiz' : t === 'activity' ? 'Homework' : 'Exam'
}
function typeBadge(t: string): React.CSSProperties {
  const bg = t === 'quiz' ? '#eef6f1' : t === 'activity' ? '#fff7e6' : '#eef1fb'
  const fg = t === 'quiz' ? 'var(--green)' : t === 'activity' ? 'var(--gold-dk)' : '#3b5bdb'
  return { background: bg, color: fg, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.4px' }
}
function scoreColor(pct: number): string {
  if (pct >= 75) return 'var(--green)'
  if (pct >= 50) return 'var(--gold-dk)'
  return '#c0392b'
}

function StatusPill({ task }: { task: StudentTask }) {
  if (task.graded && task.scorePct !== null) {
    return (
      <span style={{ fontSize: 12, fontWeight: 700, color: scoreColor(task.scorePct) }}>
        {task.scorePct.toFixed(1)}%
      </span>
    )
  }
  if (task.submitted) return <span style={{ fontSize: 12, color: 'var(--green)', fontWeight: 600 }}>Submitted</span>
  if (task.isManual) return <span style={{ fontSize: 12, color: 'var(--gray)' }}>Graded offline</span>
  return <span style={{ fontSize: 12, color: 'var(--gold-dk)', fontWeight: 600 }}>To do</span>
}

function Action({ task }: { task: StudentTask }) {
  const now = Date.now()
  const notOpen = task.opensAt != null && new Date(task.opensAt).getTime() > now
  const closed = task.closesAt != null && new Date(task.closesAt).getTime() <= now

  // Completed → result/review link
  if (task.submitted && task.submissionId) {
    return (
      <Link href={`/student/results/${task.submissionId}`} className="feu-btn-outline">
        {task.canReview ? 'Review answers' : 'View result'}
      </Link>
    )
  }
  if (task.isManual) return <span className="feu-muted" style={{ fontSize: 12 }}>—</span>
  if (!task.active || notOpen) return <span className="feu-muted" style={{ fontSize: 12 }}>Not yet available</span>
  if (closed) return <span style={{ fontSize: 12, color: '#c0392b' }}>Closed — missed</span>
  return (
    <Link href={`/student/take/${task.assignmentId}`} className="feu-btn-gold">
      {task.durationMinutes ? `Start (${task.durationMinutes} min)` : 'Take'}
    </Link>
  )
}

/** Renders a flat list of task rows. Items may carry a classLabel (cross-class lists). */
export function TaskList({ tasks }: { tasks: (StudentTask & { classLabel?: string })[] }) {
  if (tasks.length === 0) return <p className="feu-muted">Nothing here yet.</p>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {tasks.map((t) => {
        const due = fmtDate(t.closesAt ?? t.dueDate)
        const metaParts: string[] = []
        if (t.classLabel) metaParts.push(t.classLabel)
        if (t.submitted && t.submittedAt) metaParts.push(`Submitted ${fmtDate(t.submittedAt)}`)
        else if (due) metaParts.push(`${t.closesAt ? 'Closes' : 'Due'} ${due}`)
        return (
          <div
            key={t.assignmentId}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 14px',
              border: '1px solid var(--border)',
              borderRadius: 6,
              background: '#fff',
            }}
          >
            <span style={typeBadge(t.type)}>{typeLabel(t.type)}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{t.title}</div>
              {metaParts.length > 0 && (
                <div className="feu-muted" style={{ fontSize: 12 }}>{metaParts.join(' · ')}</div>
              )}
            </div>
            <StatusPill task={t} />
            <Action task={t} />
          </div>
        )
      })}
    </div>
  )
}

/** Groups tasks Quizzes → Homework → Exams for the class-detail view. */
export function GroupedTaskList({ tasks }: { tasks: StudentTask[] }) {
  const groups: { label: string; items: StudentTask[] }[] = [
    { label: 'Quizzes', items: tasks.filter((t) => t.type === 'quiz') },
    { label: 'Homework', items: tasks.filter((t) => t.type === 'activity') },
    { label: 'Exams', items: tasks.filter((t) => t.type === 'exam') },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {groups.map((g) =>
        g.items.length === 0 ? null : (
          <div key={g.label}>
            <h3 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--gray)', margin: '0 0 8px' }}>
              {g.label}
            </h3>
            <TaskList tasks={g.items} />
          </div>
        ),
      )}
    </div>
  )
}
