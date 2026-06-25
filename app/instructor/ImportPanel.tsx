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
    <section aria-labelledby="import-h">
      <h2 id="import-h">Import assessment</h2>
      <textarea
        aria-label="Assessment JSON"
        rows={8}
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder='Paste AssessmentImport JSON'
      />
      <button type="button" onClick={onImport} disabled={busy || !raw.trim()}>
        {busy ? 'Importing...' : 'Import'}
      </button>
      {msg && <p role="status">{msg}</p>}
    </section>
  )
}
