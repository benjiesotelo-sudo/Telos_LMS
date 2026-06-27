'use client'
import { useState } from 'react'
import { GradeSheet } from './GradeSheet'
import { GradeEditor } from './GradeEditor'
import type { SectionGrades } from '@/lib/types'

interface Props {
  grades: SectionGrades
  classId: string
}

/**
 * Client wrapper that owns the "which assessment is being edited" selection,
 * shared between the read-only GradeSheet (click a column header to select) and
 * the per-assessment GradeEditor (dropdown). Defaults to the first assessment
 * column so the editor is immediately useful.
 */
export function GradesView({ grades, classId }: Props) {
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string | null>(
    grades.assessments[0]?.assessmentId ?? null,
  )

  // A dropdown "— select —" sends '' — normalise to null.
  const onSelect = (id: string) => setSelectedAssessmentId(id === '' ? null : id)

  return (
    <>
      <GradeSheet
        grades={grades}
        selectedAssessmentId={selectedAssessmentId}
        onSelectAssessment={onSelect}
      />
      <GradeEditor
        grades={grades}
        classId={classId}
        selectedAssessmentId={selectedAssessmentId}
        onSelectAssessment={onSelect}
      />
    </>
  )
}
