'use client'
import { useState } from 'react'
import { searchStudents, inviteToClass } from '@/app/actions/invites'
import type { UserSearchResult } from '@/app/actions/invites'

export function InviteStudent({ classId }: { classId: string }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<UserSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [invitingId, setInvitingId] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  async function doSearch(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    setSearching(true)
    try {
      setResults(await searchStudents({ query }))
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Search failed.')
    } finally {
      setSearching(false)
    }
  }

  async function invite(studentId: string, name: string) {
    setInvitingId(studentId)
    setMsg(null)
    try {
      await inviteToClass({ classId, studentId })
      setMsg(`Invited ${name}. They'll see it in their app.`)
      setResults((r) => r.filter((u) => u.id !== studentId))
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Invite failed.')
    } finally {
      setInvitingId(null)
    }
  }

  return (
    <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
      <h3 style={{ fontSize: 14, margin: '0 0 8px' }}>Invite an existing student</h3>
      <form onSubmit={doSearch} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="name, email, or student number"
          style={{ flex: 1, maxWidth: 340, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 5, fontSize: 13 }}
        />
        <button type="submit" className="feu-btn-outline" disabled={searching || query.trim().length < 2} style={{ fontSize: 13 }}>
          {searching ? 'Searching…' : 'Search'}
        </button>
      </form>

      {results.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
          {results.map((u) => (
            <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 5 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontWeight: 600 }}>{u.fullName || u.email}</span>
                <span className="feu-muted" style={{ fontSize: 12, marginLeft: 8 }}>
                  {u.studentNumber ?? '—'} · {u.email}
                </span>
              </div>
              <button type="button" className="feu-btn-gold" disabled={invitingId === u.id} onClick={() => invite(u.id, u.fullName || u.email)} style={{ fontSize: 12, padding: '4px 12px' }}>
                {invitingId === u.id ? 'Inviting…' : 'Invite'}
              </button>
            </div>
          ))}
        </div>
      )}
      {msg && <p className="feu-muted" style={{ fontSize: 13, margin: 0 }}>{msg}</p>}
    </div>
  )
}
