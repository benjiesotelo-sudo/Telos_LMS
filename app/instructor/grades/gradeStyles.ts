// Shared color + layout helpers for the Grade Sheet (read-only) and Grade Editor.
// Plain module (no 'use server', no 'use client') so both client grids can import it.

export function scoreColor(pct: number): string {
  if (pct >= 75) return 'var(--green)'
  if (pct >= 50) return 'var(--gold-dk)'
  return '#c0392b'
}

export function letterColor(letter: string | null): string {
  if (!letter) return 'var(--gray)'
  if (letter === 'A') return 'var(--green)'
  if (letter.startsWith('B')) return '#2563eb'
  if (letter.startsWith('C')) return 'var(--gold-dk)'
  if (letter.startsWith('D')) return '#ea580c'
  return '#c0392b' // F
}

// Type tag/name/order live in the shared module so every surface agrees.
import { typeTag, typeName, assessmentOrder } from '@/lib/assessmentType'
export { typeTag, typeName, assessmentOrder }

export function typeBg(t: string): string {
  return t === 'quiz'
    ? '#f0f9f4'
    : t === 'homework'
      ? '#f3f0fb'
      : t === 'activity'
        ? '#fffbeb'
        : '#eef2ff' // exam
}

/** Split + sort assessment columns: midterm/final, each ordered quizzes → papers → exams. */
export function splitPeriods<
  T extends { type: string; period: 'midterm' | 'final' },
>(cols: T[]): { midtermCols: T[]; finalCols: T[] } {
  const sort = (a: T, b: T) => assessmentOrder(a.type) - assessmentOrder(b.type)
  return {
    midtermCols: cols.filter((c) => c.period === 'midterm').sort(sort),
    finalCols:   cols.filter((c) => c.period === 'final').sort(sort),
  }
}

export const MANUAL_TINT = '#fffbe6'   // amber — a saved manual override
export const EDIT_OUTLINE = '#2563eb'  // blue — an unsaved staged edit
export const EDIT_TINT = '#eff4ff'     // light blue — an unsaved staged edit
