'use client'
import { useEffect, useState } from 'react'
import { generateEnrollLink } from '@/app/actions/generateEnrollLink'
import { revokeEnrollLink } from '@/app/actions/revokeEnrollLink'
import type { EnrollLinkRow } from '@/lib/types'

function remaining(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (ms <= 0) return 'expired'
  const d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000)
  const m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000)
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m ${s}s`
}

export function EnrollLinksPanel({
  classes,
  links,
}: {
  classes: { id: string; displayName: string }[]
  links: EnrollLinkRow[]
}) {
  const [kind, setKind] = useState<'class' | 'general'>('class')
  const [classId, setClassId] = useState(classes[0]?.id ?? '')
  const [busy, setBusy] = useState(false)
  const [revoking, setRevoking] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const [, setTick] = useState(0)

  // Single interval drives all countdown displays; clears on unmount
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [])

  // Detect if an active link already exists for the selected kind + class
  const duplicate = links.find(
    (l) => l.kind === kind && (kind === 'general' || l.classId === classId),
  )

  async function onGenerate() {
    setBusy(true); setMsg('')
    try {
      // The server action calls refresh() from next/cache, re-rendering this page
      await generateEnrollLink(kind === 'class' ? { kind, classId } : { kind })
    } catch (e) {
      setMsg(`Failed: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(false)
    }
  }

  async function onRevoke(id: string) {
    setRevoking(id); setMsg('')
    try {
      // The server action calls refresh() from next/cache, re-rendering this page
      await revokeEnrollLink({ id })
    } catch (e) {
      setMsg(`Revoke failed: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setRevoking(null)
    }
  }

  return (
    <section aria-labelledby="links-h" className="feu-card">
      <h2 id="links-h" style={{ fontSize: 16, marginBottom: 14, color: 'var(--green)' }}>Enrollment Links</h2>

      {/* ── Generate control ── */}
      <div style={{ marginBottom: 20 }}>
        <select
          className="feu-input"
          value={kind}
          onChange={(e) => setKind(e.target.value as 'class' | 'general')}
        >
          <option value="class">Class-join link (7 days)</option>
          <option value="general">General invite link (2 days)</option>
        </select>
        {kind === 'class' && (
          <select
            className="feu-input"
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            style={{ marginTop: 8 }}
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.displayName}</option>
            ))}
          </select>
        )}
        {duplicate && (
          <p className="feu-muted" style={{ marginTop: 6, fontSize: 12 }}>
            An active link already exists below — you can reuse it.
          </p>
        )}
        <div style={{ marginTop: 12 }}>
          <button
            type="button"
            className="feu-btn-gold"
            onClick={onGenerate}
            disabled={busy || (kind === 'class' && !classId)}
          >
            {busy ? 'Generating…' : 'Generate link'}
          </button>
        </div>
      </div>

      {/* ── Active links list ── */}
      <div>
        <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: 'var(--green)' }}>
          Active Links
        </h3>
        {links.length === 0 && (
          <p className="feu-muted" style={{ fontSize: 13 }}>No active enrollment links.</p>
        )}
        {links.map((link) => {
          const left = remaining(link.expiresAt)
          return (
            <div
              key={link.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                padding: '10px 0',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>
                  {link.kind === 'class'
                    ? (link.className ?? 'Class invite')
                    : 'General invite'}
                </span>
                <span className="feu-muted" style={{ fontSize: 12 }}>
                  {left === 'expired'
                    ? <span className="feu-error">expired</span>
                    : <>expires in <strong>{left}</strong></>
                  }
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  className="feu-input"
                  readOnly
                  value={link.url}
                  onFocus={(e) => e.currentTarget.select()}
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  className="feu-btn-outline"
                  onClick={() => onRevoke(link.id)}
                  disabled={revoking === link.id}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  {revoking === link.id ? 'Revoking…' : 'Revoke'}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {msg && <p role="status" className="feu-error" style={{ marginTop: 10 }}>{msg}</p>}
    </section>
  )
}
