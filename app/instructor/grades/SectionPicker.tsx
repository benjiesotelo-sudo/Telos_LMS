'use client'
import type { ClassRow } from '@/lib/types'

interface Props {
  classes: ClassRow[]
  selected?: string
}

export function SectionPicker({ classes, selected }: Props) {
  return (
    <div
      className="feu-card"
      style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}
    >
      <label
        htmlFor="gs-section"
        style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)', whiteSpace: 'nowrap' }}
      >
        Section:
      </label>
      <form
        method="get"
        action="/instructor/grades"
        style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}
      >
        <select
          id="gs-section"
          name="classId"
          defaultValue={selected ?? ''}
          onChange={(e) => e.currentTarget.form?.submit()}
          style={{
            flex: 1,
            padding: '6px 10px',
            border: '1px solid var(--border)',
            borderRadius: 5,
            fontSize: 13,
            color: 'var(--ink)',
            background: '#fff',
            cursor: 'pointer',
          }}
        >
          <option value="">— select a class —</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.displayName}
            </option>
          ))}
        </select>
        {/* Accessible fallback for no-JS environments */}
        <noscript>
          <button
            type="submit"
            style={{
              padding: '6px 14px',
              background: 'var(--green)',
              color: '#fff',
              border: 'none',
              borderRadius: 5,
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            View
          </button>
        </noscript>
      </form>
    </div>
  )
}
