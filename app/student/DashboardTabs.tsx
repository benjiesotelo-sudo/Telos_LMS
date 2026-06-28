'use client'
import { useState } from 'react'
import { TaskList } from './TaskList'
import type { StudentTask } from '@/lib/types'

type Item = StudentTask & { classId: string; classLabel: string }

export function DashboardTabs({ todo, done }: { todo: Item[]; done: Item[] }) {
  const [tab, setTab] = useState<'todo' | 'done'>('todo')

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

      {tab === 'todo' ? (
        <>
          <p className="feu-muted" style={{ fontSize: 12, margin: '0 0 12px' }}>Open across all your classes, soonest deadline first.</p>
          {todo.length === 0 ? <p className="feu-muted">You&apos;re all caught up. 🎉</p> : <TaskList tasks={todo} />}
        </>
      ) : (
        <>
          <p className="feu-muted" style={{ fontSize: 12, margin: '0 0 12px' }}>Most recently finished first.</p>
          {done.length === 0 ? <p className="feu-muted">Nothing submitted yet.</p> : <TaskList tasks={done} />}
        </>
      )}
    </div>
  )
}
