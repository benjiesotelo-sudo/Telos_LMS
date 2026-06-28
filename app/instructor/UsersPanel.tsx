'use client'
import { useState } from 'react'
import { adminUpsertUser } from '@/app/actions/admin/adminUpsertUser'
import { adminDeleteUser } from '@/app/actions/admin/adminDeleteUser'
import { adminResetPassword } from '@/app/actions/admin/adminResetPassword'
import type { AdminUserRow } from '@/lib/types'

// ── Types ──────────────────────────────────────────────────────────────────
type ModalState =
  | { kind: 'none' }
  | { kind: 'create' }
  | { kind: 'edit'; row: AdminUserRow }
  | { kind: 'reset'; id: string; fullName: string }
  | { kind: 'delete'; id: string; fullName: string }

const ROLE_OPTIONS = ['admin', 'instructor', 'student'] as const
const STATUS_OPTIONS = ['active', 'pending', 'suspended'] as const

// ── Helpers ────────────────────────────────────────────────────────────────
function roleBadge(role: string) {
  const color = role === 'admin' ? 'var(--gold-dk, #b8860b)' : role === 'instructor' ? 'var(--green, #1a7c4e)' : 'var(--gray, #666)'
  return <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color }}>{role}</span>
}

function statusBadge(status: string) {
  const color = status === 'active' ? 'var(--green, #1a7c4e)' : status === 'suspended' ? 'var(--red, #c0392b)' : 'var(--gray, #666)'
  return <span style={{ fontSize: 11, color }}>{status}</span>
}

// ── Upsert Form ────────────────────────────────────────────────────────────
function UpsertForm({
  initial,
  onClose,
  onDone,
}: {
  initial?: AdminUserRow
  onClose: () => void
  onDone: (msg: string) => void
}) {
  const isEdit = !!initial?.id
  const [email, setEmail] = useState(initial?.email ?? '')
  const [role, setRole] = useState<string>(initial?.role ?? 'student')
  const [status, setStatus] = useState<string>(initial?.status ?? 'active')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [studentNumber, setStudentNumber] = useState(initial?.studentNumber ?? '')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  // For edit, parse full name roughly into first/last
  const [displayName, setDisplayName] = useState(initial?.fullName ?? '')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    setBusy(true)
    try {
      if (isEdit) {
        // When editing, split display name into first/last for simplicity
        const parts = displayName.trim().split(/\s+/)
        const fn = parts[0] ?? ''
        const ln = parts.slice(1).join(' ') || fn
        await adminUpsertUser({
          id: initial!.id,
          email,
          role: role as any,
          status: status as any,
          firstName: fn,
          lastName: ln,
          studentNumber: studentNumber || undefined,
          password: password || undefined,
        })
        onDone(`Updated ${displayName}`)
      } else {
        await adminUpsertUser({
          email,
          role: role as any,
          status: status as any,
          firstName,
          lastName,
          studentNumber: studentNumber || undefined,
          password: password || undefined,
        })
        onDone(`Created ${firstName} ${lastName}`)
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const fieldStyle: React.CSSProperties = { display: 'block', width: '100%', padding: '6px 8px', border: '1px solid var(--line, #ddd)', borderRadius: 4, fontSize: 13, marginBottom: 12, boxSizing: 'border-box' }
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--gray, #555)' }

  return (
    <form onSubmit={submit}>
      {isEdit ? (
        <>
          <label style={labelStyle}>Display name</label>
          <input style={fieldStyle} value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
        </>
      ) : (
        <>
          <label style={labelStyle}>First name</label>
          <input style={fieldStyle} value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
          <label style={labelStyle}>Last name</label>
          <input style={fieldStyle} value={lastName} onChange={(e) => setLastName(e.target.value)} required />
        </>
      )}

      <label style={labelStyle}>Email</label>
      <input style={fieldStyle} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />

      <label style={labelStyle}>Role</label>
      <select style={fieldStyle} value={role} onChange={(e) => setRole(e.target.value)}>
        {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>

      <label style={labelStyle}>Status</label>
      <select style={fieldStyle} value={status} onChange={(e) => setStatus(e.target.value)}>
        {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>

      <label style={labelStyle}>Student number</label>
      <input style={fieldStyle} value={studentNumber} onChange={(e) => setStudentNumber(e.target.value)} placeholder="optional" />

      <label style={labelStyle}>{isEdit ? 'New password (leave blank to keep)' : 'Password'}</label>
      <input style={fieldStyle} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required={!isEdit} autoComplete="new-password" />

      {err && <p style={{ color: 'var(--red, #c0392b)', fontSize: 12, marginBottom: 8 }}>{err}</p>}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
        <button type="button" className="feu-btn-gold" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="submit" className="feu-btn-green" disabled={busy}>{busy ? 'Saving…' : (isEdit ? 'Save changes' : 'Create user')}</button>
      </div>
    </form>
  )
}

// ── Modal Shell ────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="feu-card" style={{ width: '100%', maxWidth: 440, boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 15, color: 'var(--green, #1a7c4e)' }}>{title}</h3>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--gray)' }} aria-label="Close">&times;</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── Main Panel ────────────────────────────────────────────────────────────
export function UsersPanel({ rows: initialRows }: { rows: AdminUserRow[] }) {
  const [rows, setRows] = useState<AdminUserRow[]>(initialRows)
  const [query, setQuery] = useState('')
  const [modal, setModal] = useState<ModalState>({ kind: 'none' })
  const [flash, setFlash] = useState('')
  const [resetPw, setResetPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  function showFlash(msg: string) {
    setFlash(msg)
    setTimeout(() => setFlash(''), 3500)
  }

  function closeModal() {
    setModal({ kind: 'none' })
    setResetPw('')
    setErr('')
  }

  async function handleDelete(id: string, fullName: string) {
    setBusy(true)
    setErr('')
    try {
      await adminDeleteUser({ id })
      setRows((r) => r.filter((u) => u.id !== id))
      closeModal()
      showFlash(`Deleted ${fullName}`)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function handleResetPassword(id: string, fullName: string) {
    setBusy(true)
    setErr('')
    try {
      await adminResetPassword({ id, newPassword: resetPw })
      closeModal()
      showFlash(`Password reset for ${fullName}`)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const thStyle: React.CSSProperties = { textAlign: 'left', padding: '6px 10px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--gray, #666)', borderBottom: '2px solid var(--line, #ddd)' }
  const tdStyle: React.CSSProperties = { padding: '8px 10px', fontSize: 13, borderBottom: '1px solid var(--line, #eee)', verticalAlign: 'middle' }
  const btnSm: React.CSSProperties = { fontSize: 12, padding: '4px 10px', borderRadius: 5, cursor: 'pointer', whiteSpace: 'nowrap', lineHeight: 1.2 }
  // Pin the Actions column to the right edge so Edit/Reset/Delete are ALWAYS visible,
  // no horizontal scrolling (or scrolling past 500 rows) needed to reach them.
  const stickyActionsTh: React.CSSProperties = { ...thStyle, textAlign: 'right', position: 'sticky', right: 0, background: '#fff', zIndex: 2, boxShadow: '-8px 0 8px -8px rgba(0,0,0,0.18)' }
  const stickyActionsTd: React.CSSProperties = { ...tdStyle, textAlign: 'right', position: 'sticky', right: 0, background: '#fff', zIndex: 1, boxShadow: '-8px 0 8px -8px rgba(0,0,0,0.18)' }

  const q = query.trim().toLowerCase()
  const filtered = q === ''
    ? rows
    : rows.filter((r) =>
        [r.fullName, r.email, r.studentNumber, r.role, r.status]
          .some((v) => (v ?? '').toLowerCase().includes(q)),
      )

  return (
    <section aria-labelledby="users-h" className="feu-card" style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <h2 id="users-h" style={{ margin: 0, fontSize: 16, color: 'var(--green, #1a7c4e)' }}>
          All Users ({q === '' ? rows.length : `${filtered.length} of ${rows.length}`})
        </h2>
        <button type="button" className="feu-btn-green" onClick={() => setModal({ kind: 'create' })}>+ Create user</button>
      </div>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name, email, student #, role, or status…"
        aria-label="Search users"
        style={{ width: '100%', maxWidth: 420, padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, marginBottom: 14, boxSizing: 'border-box' }}
      />

      {flash && (
        <div style={{ background: 'var(--green-lt, #e8f5ee)', border: '1px solid var(--green, #1a7c4e)', borderRadius: 4, padding: '8px 12px', marginBottom: 12, fontSize: 13, color: 'var(--green, #1a7c4e)' }}>
          {flash}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="feu-muted">No users found.</p>
      ) : filtered.length === 0 ? (
        <p className="feu-muted">No users match &ldquo;{query}&rdquo;.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Email</th>
                <th style={thStyle}>Role</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Student #</th>
                <th style={stickyActionsTh}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id}>
                  <td style={tdStyle}>{row.fullName || <span className="feu-muted">—</span>}</td>
                  <td style={{ ...tdStyle, width: 200, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.email}>{row.email}</td>
                  <td style={tdStyle}>{roleBadge(row.role)}</td>
                  <td style={tdStyle}>{statusBadge(row.status)}</td>
                  <td style={tdStyle}>{row.studentNumber ?? <span className="feu-muted">—</span>}</td>
                  <td style={stickyActionsTd}>
                    <span style={{ display: 'inline-flex', gap: 6, whiteSpace: 'nowrap' }}>
                      <button type="button" className="feu-btn-green" style={btnSm} onClick={() => setModal({ kind: 'edit', row })}>Edit</button>
                      <button type="button" className="feu-btn-gold" style={btnSm} onClick={() => { setModal({ kind: 'reset', id: row.id, fullName: row.fullName }) }}>Reset PW</button>
                      <button type="button" style={{ ...btnSm, background: 'var(--red, #c0392b)', color: '#fff', border: 'none' }} onClick={() => setModal({ kind: 'delete', id: row.id, fullName: row.fullName })}>Delete</button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* CREATE MODAL */}
      {modal.kind === 'create' && (
        <Modal title="Create user" onClose={closeModal}>
          <UpsertForm
            onClose={closeModal}
            onDone={(msg) => {
              // Refresh the page to get updated list
              window.location.reload()
              closeModal()
              showFlash(msg)
            }}
          />
        </Modal>
      )}

      {/* EDIT MODAL */}
      {modal.kind === 'edit' && (
        <Modal title={`Edit ${modal.row.fullName}`} onClose={closeModal}>
          <UpsertForm
            initial={modal.row}
            onClose={closeModal}
            onDone={(msg) => {
              window.location.reload()
              closeModal()
              showFlash(msg)
            }}
          />
        </Modal>
      )}

      {/* RESET PASSWORD MODAL */}
      {modal.kind === 'reset' && (
        <Modal title={`Reset password — ${modal.fullName}`} onClose={closeModal}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--gray)' }}>New password (min 6 chars)</label>
          <input
            type="password"
            value={resetPw}
            onChange={(e) => setResetPw(e.target.value)}
            style={{ display: 'block', width: '100%', padding: '6px 8px', border: '1px solid var(--line, #ddd)', borderRadius: 4, fontSize: 13, marginBottom: 12, boxSizing: 'border-box' }}
            autoComplete="new-password"
          />
          {err && <p style={{ color: 'var(--red, #c0392b)', fontSize: 12, marginBottom: 8 }}>{err}</p>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="feu-btn-gold" onClick={closeModal} disabled={busy}>Cancel</button>
            <button type="button" className="feu-btn-green" onClick={() => handleResetPassword(modal.id, modal.fullName)} disabled={busy || resetPw.length < 6}>
              {busy ? 'Saving…' : 'Reset password'}
            </button>
          </div>
        </Modal>
      )}

      {/* DELETE MODAL */}
      {modal.kind === 'delete' && (
        <Modal title="Confirm deletion" onClose={closeModal}>
          <p style={{ marginBottom: 16, fontSize: 14 }}>
            Permanently delete <strong>{modal.fullName}</strong>? This cannot be undone.
          </p>
          {err && <p style={{ color: 'var(--red, #c0392b)', fontSize: 12, marginBottom: 8 }}>{err}</p>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="feu-btn-gold" onClick={closeModal} disabled={busy}>Cancel</button>
            <button
              type="button"
              style={{ background: 'var(--red, #c0392b)', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 14px', cursor: 'pointer', fontSize: 13 }}
              onClick={() => handleDelete(modal.id, modal.fullName)}
              disabled={busy}
            >
              {busy ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </Modal>
      )}
    </section>
  )
}
