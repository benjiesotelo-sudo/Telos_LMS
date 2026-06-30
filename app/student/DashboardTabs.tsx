'use client'
import { useState } from 'react'
import { TaskList } from './TaskList'
import { SearchBox } from '@/app/components/SearchBox'
import { typeName } from '@/lib/assessmentType'
import type { StudentTask } from '@/lib/types'

type Item = StudentTask & { classId: string; classLabel: string }

export function DashboardTabs({ todo, done }: { todo: Item[]; done: Item[] }) {
  const [tab, setTab] = useState<'todo' | 'done'>('todo')
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()
  const matches = (t: Item) =>
    q === '' ||
    [t.title, t.classLabel, typeName(t.type)].some((v) => (v ?? '').toLowerCase().includes(q))

  const todoF = todo.filter(matches)
  const doneF = done.filter(matches)

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 18px',
    fontSize: 14,
    fontWeight: 700,
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    color: active ? 'var(--green)' : 'var(--gray)',
    borderBottom: active ? '3px solid var(--gold)' : '3px solid transparent',
  })

  // Active tab's underlying (unfiltered) list — drives whether to show the search box
  // and which empty/no-match message applies.
  const activeTotal = tab === 'todo' ? todo.length : done.length
  const activeFiltered = tab === 'todo' ? todoF : doneF
  const noMatches = activeTotal > 0 && q !== '' && activeFiltered.length === 0

  return (
    <div className="feu-card">
      <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid var(--border)', marginBottom: 14 }}>
        <button type="button" style={tabStyle(tab === 'todo')} onClick={() => setTab('todo')}>
          To-Do{todo.length > 0 ? ` (${todo.length})` : ''}
        </button>
        <button type="button" style={tabStyle(tab === 'done')} onClick={() => setTab('done')}>
          Done{done.length > 0 ? ` (${done.length})` : ''}
        </button>
      </div>

      {activeTotal > 0 && (
        <SearchBox
          value={query}
          onChange={setQuery}
          placeholder="Search tasks by title, class, or type…"
          ariaLabel="Search tasks"
        />
      )}

      {tab === 'todo' ? (
        <>
          <p className="feu-muted" style={{ fontSize: 12, margin: '0 0 12px' }}>Open across all your classes, soonest deadline first.</p>
          {todo.length === 0 ? (
            <p className="feu-muted">You&apos;re all caught up. 🎉</p>
          ) : noMatches ? (
            <p className="feu-muted">No tasks match &ldquo;{query}&rdquo;.</p>
          ) : (
            <TaskList tasks={todoF} />
          )}
        </>
      ) : (
        <>
          <p className="feu-muted" style={{ fontSize: 12, margin: '0 0 12px' }}>Most recently finished first.</p>
          {done.length === 0 ? (
            <p className="feu-muted">Nothing submitted yet.</p>
          ) : noMatches ? (
            <p className="feu-muted">No tasks match &ldquo;{query}&rdquo;.</p>
          ) : (
            <TaskList tasks={doneF} />
          )}
        </>
      )}
    </div>
  )
}
