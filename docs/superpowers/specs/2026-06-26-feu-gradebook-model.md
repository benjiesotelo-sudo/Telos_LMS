# FEU Gradebook Model — decoded from ECL1103_Grade_Sheet.xlsx + FEU policy research (2026-06-26)

Source: instructor's real FEU sheet ("FOR SUBMISSION" + "Midterm Grading"/"Final Grading"/
"TRANSMUTATION TABLE" sheets) cross-checked with FEU Manila official grading policy.

## The computation (exact, from the sheet's formulas)

**Per assessment item:** entered as `raw score (NE)` out of `MAX`. Item % = `(NE / MAX) * 100`.
Item letter = transmute(item %).

**Per category average** (Quizzes, Papers/HW/SW, Term Exam) = the **mean of the item %s of the
items that have data** — empty items are excluded from both numerator and denominator. This is
the "ADAPTIVE to however many I deploy": 1 quiz or 6 quizzes both work; only filled items count.

**Per period mark** (Midterm, then Final), as a percentage:
```
if no Papers/HW/SW items:   mark = Quizzes% * 0.50 + TermExam% * 0.50
else:                       mark = Quizzes% * 0.30 + Papers/HW/SW% * 0.20 + TermExam% * 0.50
```
(Weights 30/20/50 = 50% formative / 50% summative — the "professional/major course" split.
The no-papers fallback redistributes the 20% so quizzes+exam = 50/50.)

**Course mark** (the COURSE GRADE "MARK"):
```
if both period marks empty -> blank
elif only one exists        -> that one
else                        -> ROUND((MidtermMark + FinalMark) / 2, 2)
```
i.e. Midterm and Final each count 50% of the course grade.

**Letter grade (LG)** = transmute(course mark %) via the table below.

## Transmutation table (instructor's = current FEU official)
| % range | Letter | QP |
|---|---|---|
| 92–100 | A  | 4.0 |
| 85–91  | B+ | 3.5 |
| 78–84  | B  | 3.0 |
| 71–77  | C+ | 2.5 |
| 64–70  | C  | 2.0 |
| 57–63  | D+ | 1.5 |
| 50–56  | D  | 1.0 (lowest passing) |
| 0–49   | F  | 0.0 (fail) |

Passing mark = **50%**. (Law programs would be 75%, N/A here.)

## How this maps onto Telos
- Telos assessments already auto-grade to `earned/possible` → a percentage. **That percentage IS
  the item %** by default.
- **Manual override (CONFIRMED):** for any (student, assessment) the instructor can enter a
  **manual score that TAKES PRIORITY** over the auto-graded digital score. Uses: a student who
  missed the online quiz, **bonus points**, or a paper graded offline. So each grade cell =
  `manual_score if present else auto_graded_%`. The override is stored per submission/grade-entry
  and is what flows into the category averages. (Allow it to exceed 100 for bonus.)
- Each assessment has a `type` (activity / quiz / exam) → maps to the category:
  quiz→Quizzes, activity→Papers/HW/SW, exam→Term Exam.
- Need a **period** tag (Midterm / Final) per assignment so the two-period split works.
- Weights (30/20/50) should be **configurable per class** (GE courses are 70/30 at FEU; this
  sheet is a 50/50 professional course). Default = 30/20/50.
- Grades view: pick a section → table of enrolled students × their per-category averages,
  period marks, course mark + letter. Adaptive column count by deployed assessments.

## Open questions for the instructor (to finalize)
1. Weights per class configurable (default 30/20/50)? Or fixed?
2. Confirm two-period model: Midterm mark + Final mark, course = average of the two (50/50)?
3. Manual-score items: do you grade papers/HW offline and enter a score, or are all graded
   items auto-graded quizzes in Telos? (Determines whether we need a manual score-entry field.)
4. Keep the exact no-papers fallback (quizzes/exam → 50/50), or general renormalization?
5. Do you want a Midterm advisory grade shown mid-term, or only the final course grade?

## FEU special marks (for later)
AW (authorized withdrawal), IP (in progress), P (passed, non-credit). INC/DRP are not current
FEU Manila marks. Out of scope for the first gradebook; note for completeness.
