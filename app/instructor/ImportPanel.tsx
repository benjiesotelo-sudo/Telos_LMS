'use client'
import { useState } from 'react'
import { importAssessment } from '@/app/actions/importAssessment'

export function ImportPanel() {
  const [raw, setRaw] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  async function onImport() {
    setBusy(true)
    setMsg('')
    try {
      const json = JSON.parse(raw)
      const { assessmentId } = await importAssessment(json)
      setMsg(`Imported assessment ${assessmentId}`)
      setRaw('')
    } catch (e) {
      setMsg(`Import failed: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby="import-h" className="feu-card">
      <h2 id="import-h" style={{ fontSize: 16, marginBottom: 14, color: 'var(--green)' }}>
        Import Assessment
      </h2>
      <label className="feu-label" htmlFor="import-json">Assessment JSON</label>
      <textarea
        id="import-json"
        aria-label="Assessment JSON"
        className="feu-input"
        rows={8}
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder="Paste AssessmentImport JSON"
        style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: 13 }}
      />
      <div style={{ marginTop: 12 }}>
        <button
          type="button"
          className="feu-btn-gold"
          onClick={onImport}
          disabled={busy || !raw.trim()}
        >
          {busy ? 'Importing...' : 'Import'}
        </button>
      </div>
      {msg && (
        <p
          role="status"
          className={msg.startsWith('Import failed') ? 'feu-error' : 'feu-muted'}
          style={{ marginTop: 10 }}
        >
          {msg}
        </p>
      )}
    </section>
  )
}
