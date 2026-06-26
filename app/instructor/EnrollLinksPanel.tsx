'use client'
import { useEffect, useState } from 'react'
import { generateEnrollLink } from '@/app/actions/generateEnrollLink'

function remaining(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (ms <= 0) return 'expired'
  const d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000)
  const m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000)
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m ${s}s`
}

export function EnrollLinksPanel({ classes }: { classes: { id: string; displayName: string }[] }) {
  const [kind, setKind] = useState<'class' | 'general'>('class')
  const [classId, setClassId] = useState(classes[0]?.id ?? '')
  const [link, setLink] = useState<{ url: string; expiresAt: string } | null>(null)
  const [, setTick] = useState(0)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (!link) return
    const t = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [link])

  async function onGenerate() {
    setBusy(true); setMsg('')
    try {
      const res = await generateEnrollLink(kind === 'class' ? { kind, classId } : { kind })
      setLink({ url: res.url, expiresAt: res.expiresAt })
    } catch (e) {
      setMsg(`Failed: ${e instanceof Error ? e.message : String(e)}`)
    } finally { setBusy(false) }
  }

  const left = link ? remaining(link.expiresAt) : ''
  return (
    <section aria-labelledby="links-h" className="feu-card">
      <h2 id="links-h" style={{ fontSize: 16, marginBottom: 14, color: 'var(--green)' }}>Enrollment Links</h2>
      <select className="feu-input" value={kind} onChange={(e) => setKind(e.target.value as 'class' | 'general')}>
        <option value="class">Class-join link (7 days)</option>
        <option value="general">General invite link (2 days)</option>
      </select>
      {kind === 'class' && (
        <select className="feu-input" value={classId} onChange={(e) => setClassId(e.target.value)} style={{ marginTop: 8 }}>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.displayName}</option>)}
        </select>
      )}
      <div style={{ marginTop: 12 }}>
        <button type="button" className="feu-btn-gold" onClick={onGenerate} disabled={busy || (kind === 'class' && !classId)}>
          {busy ? 'Generating…' : 'Generate link'}
        </button>
      </div>
      {link && left !== 'expired' && (
        <div style={{ marginTop: 14 }}>
          <input className="feu-input" readOnly value={link.url} onFocus={(e) => e.currentTarget.select()} />
          <p className="feu-muted" style={{ marginTop: 6 }}>Valid for <strong>{left}</strong></p>
        </div>
      )}
      {link && left === 'expired' && <p className="feu-error" style={{ marginTop: 10 }}>Link expired — generate a new one.</p>}
      {msg && <p role="status" className="feu-error" style={{ marginTop: 10 }}>{msg}</p>}
    </section>
  )
}
