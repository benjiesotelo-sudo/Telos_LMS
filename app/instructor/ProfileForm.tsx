'use client'
import { useState } from 'react'
import { composeFullName } from '@/lib/name'
import { updateProfile } from '@/app/actions/updateProfile'

const PREFIX_OPTIONS = ['', 'Mr.', 'Ms.', 'Mrs.', 'Dr.', 'Engr.', 'Atty.', 'Other']
const SUFFIX_OPTIONS = ['', 'Jr.', 'Sr.', 'II', 'III', 'IV', 'Other']

function resolveOther(value: string | null | undefined, options: string[]) {
  const v = value ?? ''
  if (v === '') return { select: '', other: '' }
  if (options.includes(v)) return { select: v, other: '' }
  return { select: 'Other', other: v }
}

export function ProfileForm(props: {
  prefix?: string | null
  firstName: string
  middleInitial?: string | null
  lastName: string
  suffix?: string | null
  studentNumber?: string | null
  email: string
  role: string
}) {
  const initPrefix = resolveOther(props.prefix, PREFIX_OPTIONS.filter((o) => o !== 'Other'))
  const initSuffix = resolveOther(props.suffix, SUFFIX_OPTIONS.filter((o) => o !== 'Other'))

  const [prefix, setPrefix] = useState(initPrefix.select)
  const [prefixOther, setPrefixOther] = useState(initPrefix.other)
  const [firstName, setFirstName] = useState(props.firstName)
  const [middleInitial, setMiddleInitial] = useState(props.middleInitial ?? '')
  const [lastName, setLastName] = useState(props.lastName)
  const [suffix, setSuffix] = useState(initSuffix.select)
  const [suffixOther, setSuffixOther] = useState(initSuffix.other)
  const [studentNumber, setStudentNumber] = useState(props.studentNumber ?? '')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)

  const resolvedPrefix = prefix === 'Other' ? prefixOther : prefix
  const resolvedSuffix = suffix === 'Other' ? suffixOther : suffix

  const liveFullName = composeFullName({
    prefix: resolvedPrefix || undefined,
    firstName,
    middleInitial: middleInitial || undefined,
    lastName,
    suffix: resolvedSuffix || undefined,
  })

  const canSave = firstName.trim() !== '' && lastName.trim() !== ''

  async function onSave() {
    setBusy(true)
    setMsg('')
    setSaved(false)
    try {
      await updateProfile({
        prefix: resolvedPrefix || undefined,
        firstName,
        middleInitial: middleInitial || undefined,
        lastName,
        suffix: resolvedSuffix || undefined,
        studentNumber: studentNumber || undefined,
      })
      setSaved(true)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="feu-card" aria-label="Edit profile">
      <h2 style={{ fontSize: 16, marginBottom: 14, color: 'var(--green)' }}>Edit Name</h2>

      {/* Live full name preview */}
      <div style={{ marginBottom: 18, padding: '10px 12px', background: 'var(--feu-green-10, rgba(0,100,0,0.06))', borderRadius: 6 }}>
        <span className="feu-label">Full name (preview)</span>
        <p style={{ marginTop: 4, fontWeight: 600, color: 'var(--green)', fontSize: '1.05rem' }}>
          {liveFullName || <span className="feu-muted">—</span>}
        </p>
      </div>

      {/* Prefix */}
      <label className="feu-label" htmlFor="p-prefix">Prefix</label>
      <select id="p-prefix" className="feu-input" value={prefix} onChange={(e) => setPrefix(e.target.value)}>
        {PREFIX_OPTIONS.map((o) => (
          <option key={o} value={o}>{o === '' ? '(none)' : o}</option>
        ))}
      </select>
      {prefix === 'Other' && (
        <>
          <label className="feu-label" htmlFor="p-prefix-other">Custom prefix</label>
          <input
            id="p-prefix-other"
            className="feu-input"
            value={prefixOther}
            onChange={(e) => setPrefixOther(e.target.value)}
            placeholder="e.g. Prof."
          />
          <p className="feu-muted" style={{ fontSize: '0.78rem', marginTop: 2 }}>Proper case — e.g. Prof.</p>
        </>
      )}

      {/* First name */}
      <label className="feu-label" htmlFor="p-first">
        First name <span style={{ color: 'var(--feu-gold)' }}>*</span>
      </label>
      <input
        id="p-first"
        className="feu-input"
        value={firstName}
        onChange={(e) => setFirstName(e.target.value)}
        placeholder="e.g. Maria"
      />
      <p className="feu-muted" style={{ fontSize: '0.78rem', marginTop: 2 }}>Proper case — e.g. Maria</p>

      {/* Middle initial */}
      <label className="feu-label" htmlFor="p-mi">Middle initial</label>
      <input
        id="p-mi"
        className="feu-input"
        value={middleInitial}
        onChange={(e) => setMiddleInitial(e.target.value)}
        placeholder="e.g. A"
        maxLength={3}
      />
      <p className="feu-muted" style={{ fontSize: '0.78rem', marginTop: 2 }}>Single letter — e.g. A</p>

      {/* Last name */}
      <label className="feu-label" htmlFor="p-last">
        Last name <span style={{ color: 'var(--feu-gold)' }}>*</span>
      </label>
      <input
        id="p-last"
        className="feu-input"
        value={lastName}
        onChange={(e) => setLastName(e.target.value)}
        placeholder="e.g. Santos"
      />
      <p className="feu-muted" style={{ fontSize: '0.78rem', marginTop: 2 }}>Proper case — e.g. Santos</p>

      {/* Suffix */}
      <label className="feu-label" htmlFor="p-suffix">Suffix</label>
      <select id="p-suffix" className="feu-input" value={suffix} onChange={(e) => setSuffix(e.target.value)}>
        {SUFFIX_OPTIONS.map((o) => (
          <option key={o} value={o}>{o === '' ? '(none)' : o}</option>
        ))}
      </select>
      {suffix === 'Other' && (
        <>
          <label className="feu-label" htmlFor="p-suffix-other">Custom suffix</label>
          <input
            id="p-suffix-other"
            className="feu-input"
            value={suffixOther}
            onChange={(e) => setSuffixOther(e.target.value)}
            placeholder="e.g. MD"
          />
          <p className="feu-muted" style={{ fontSize: '0.78rem', marginTop: 2 }}>Proper case — e.g. MD</p>
        </>
      )}

      {/* Student number */}
      <label className="feu-label" htmlFor="p-sn">Student number</label>
      <input
        id="p-sn"
        className="feu-input"
        value={studentNumber}
        onChange={(e) => setStudentNumber(e.target.value)}
        placeholder="e.g. 2021-00001"
      />

      <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          type="button"
          className="feu-btn-green"
          onClick={onSave}
          disabled={busy || !canSave}
        >
          {busy ? 'Saving…' : 'Save changes'}
        </button>
        {saved && (
          <span style={{ color: 'var(--green)', fontSize: '0.875rem' }}>Saved!</span>
        )}
      </div>
      {msg && (
        <p role="alert" className="feu-error" style={{ marginTop: 10 }}>{msg}</p>
      )}
    </section>
  )
}
