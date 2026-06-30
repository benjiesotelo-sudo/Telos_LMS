'use client'
import { useState } from 'react'
import { registerViaLink } from '@/app/actions/registerViaLink'
import { PasswordInput } from '@/app/components/PasswordInput'

const PREFIX_OPTIONS = ['', 'Mr.', 'Ms.', 'Mrs.', 'Dr.', 'Engr.', 'Atty.', 'Other']
const SUFFIX_OPTIONS = ['', 'Jr.', 'Sr.', 'II', 'III', 'IV', 'Other']

export function RegisterForm({ token, kind, sections }: {
  token: string; kind: 'class' | 'general'; sections: { id: string; displayName: string }[]
}) {
  const [prefix, setPrefix] = useState('')
  const [prefixOther, setPrefixOther] = useState('')
  const [firstName, setFirstName] = useState('')
  const [middleInitial, setMiddleInitial] = useState('')
  const [lastName, setLastName] = useState('')
  const [suffix, setSuffix] = useState('')
  const [suffixOther, setSuffixOther] = useState('')
  const [email, setEmail] = useState('')
  const [studentNumber, setStudentNumber] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [classId, setClassId] = useState('')
  const [reason, setReason] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  const resolvedPrefix = prefix === 'Other' ? prefixOther : prefix
  const resolvedSuffix = suffix === 'Other' ? suffixOther : suffix

  const canSubmit =
    firstName.trim() !== '' &&
    lastName.trim() !== '' &&
    email.trim() !== '' &&
    password !== '' &&
    confirmPassword !== '' &&
    studentNumber.trim() !== ''

  async function onSubmit() {
    setMsg('')
    if (password.length < 6) { setMsg('Password must be at least 6 characters.'); return }
    if (password !== confirmPassword) { setMsg('Passwords do not match.'); return }
    setBusy(true)
    try {
      await registerViaLink({
        token,
        prefix: resolvedPrefix || undefined,
        firstName,
        middleInitial: middleInitial || undefined,
        lastName,
        suffix: resolvedSuffix || undefined,
        email,
        password,
        studentNumber,
        classId: classId || undefined,
        reason: reason.trim() || undefined,
      })
      setDone(true)
    } catch (e) {
      setMsg(`${e instanceof Error ? e.message : String(e)}`)
    } finally { setBusy(false) }
  }

  if (done) return <div className="feu-card"><p className="feu-muted">Registration submitted. Your instructor will approve your account — you can log in once approved.</p></div>

  return (
    <section className="feu-card">
      {/* Prefix */}
      <label className="feu-label" htmlFor="r-prefix">Prefix</label>
      <select id="r-prefix" className="feu-input" value={prefix} onChange={(e) => setPrefix(e.target.value)}>
        {PREFIX_OPTIONS.map((o) => <option key={o} value={o}>{o === '' ? '(none)' : o}</option>)}
      </select>
      {prefix === 'Other' && (
        <>
          <label className="feu-label" htmlFor="r-prefix-other">Custom Prefix</label>
          <input id="r-prefix-other" className="feu-input" value={prefixOther}
            onChange={(e) => setPrefixOther(e.target.value)}
            placeholder="e.g. Prof." />
          <p className="feu-muted" style={{ fontSize: '0.78rem', marginTop: 2 }}>Proper case — e.g. Prof.</p>
        </>
      )}

      {/* First Name */}
      <label className="feu-label" htmlFor="r-first">First Name <span style={{ color: 'var(--feu-gold)' }}>*</span></label>
      <input id="r-first" className="feu-input" value={firstName}
        onChange={(e) => setFirstName(e.target.value)}
        placeholder="e.g. Maria" />
      <p className="feu-muted" style={{ fontSize: '0.78rem', marginTop: 2 }}>Proper case — e.g. Maria</p>

      {/* Middle Initial */}
      <label className="feu-label" htmlFor="r-mi">Middle Initial</label>
      <input id="r-mi" className="feu-input" value={middleInitial}
        onChange={(e) => setMiddleInitial(e.target.value)}
        placeholder="e.g. A" maxLength={3} />
      <p className="feu-muted" style={{ fontSize: '0.78rem', marginTop: 2 }}>Single letter — e.g. A</p>

      {/* Last Name */}
      <label className="feu-label" htmlFor="r-last">Last Name <span style={{ color: 'var(--feu-gold)' }}>*</span></label>
      <input id="r-last" className="feu-input" value={lastName}
        onChange={(e) => setLastName(e.target.value)}
        placeholder="e.g. Santos" />
      <p className="feu-muted" style={{ fontSize: '0.78rem', marginTop: 2 }}>Proper case — e.g. Santos</p>

      {/* Suffix */}
      <label className="feu-label" htmlFor="r-suffix">Suffix</label>
      <select id="r-suffix" className="feu-input" value={suffix} onChange={(e) => setSuffix(e.target.value)}>
        {SUFFIX_OPTIONS.map((o) => <option key={o} value={o}>{o === '' ? '(none)' : o}</option>)}
      </select>
      {suffix === 'Other' && (
        <>
          <label className="feu-label" htmlFor="r-suffix-other">Custom Suffix</label>
          <input id="r-suffix-other" className="feu-input" value={suffixOther}
            onChange={(e) => setSuffixOther(e.target.value)}
            placeholder="e.g. MD" />
          <p className="feu-muted" style={{ fontSize: '0.78rem', marginTop: 2 }}>Proper case — e.g. MD</p>
        </>
      )}

      {/* Student Number */}
      <label className="feu-label" htmlFor="r-sn">Student Number <span style={{ color: 'var(--feu-gold)' }}>*</span></label>
      <input id="r-sn" className="feu-input" value={studentNumber}
        onChange={(e) => setStudentNumber(e.target.value)}
        placeholder="e.g. 2021-00001" />

      {/* Email */}
      <label className="feu-label" htmlFor="r-email">Email <span style={{ color: 'var(--feu-gold)' }}>*</span></label>
      <input id="r-email" className="feu-input" type="email" value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="e.g. m.santos@feu.edu.ph" />

      {/* Password */}
      <label className="feu-label" htmlFor="r-pw">Password <span style={{ color: 'var(--feu-gold)' }}>*</span></label>
      <PasswordInput id="r-pw" value={password}
        onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={6} />
      <p className="feu-muted" style={{ fontSize: '0.78rem', marginTop: 2 }}>At least 6 characters — tap “Show” to check what you typed.</p>

      {/* Confirm Password — always masked, so you retype it from memory and catch typos */}
      <label className="feu-label" htmlFor="r-pw2">Confirm Password <span style={{ color: 'var(--feu-gold)' }}>*</span></label>
      <input id="r-pw2" className="feu-input" type="password" autoComplete="new-password" value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)} />
      {confirmPassword !== '' && password !== confirmPassword && (
        <p className="feu-error" style={{ fontSize: '0.78rem', marginTop: 2 }}>Passwords don’t match yet.</p>
      )}

      {/* Section picker (general links only) */}
      {kind === 'general' && (
        <>
          <label className="feu-label" htmlFor="r-sec">Section (optional)</label>
          <select id="r-sec" className="feu-input" value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">— pick later —</option>
            {sections.map((s) => <option key={s.id} value={s.id}>{s.displayName}</option>)}
          </select>
        </>
      )}

      {/* Optional reason — helps the instructor approve faster */}
      <label className="feu-label" htmlFor="r-reason">Reason for joining (optional)</label>
      <textarea
        id="r-reason"
        className="feu-input"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={2}
        maxLength={500}
        placeholder="Optional — a short reason can speed up approval (e.g. your course/section or instructor)."
      />

      <div style={{ marginTop: 14 }}>
        <button type="button" className="feu-btn-green" onClick={onSubmit} disabled={busy || !canSubmit}>
          {busy ? 'Submitting…' : 'Register'}
        </button>
      </div>
      {msg && <p role="status" className="feu-error" style={{ marginTop: 10 }}>{msg}</p>}
    </section>
  )
}
