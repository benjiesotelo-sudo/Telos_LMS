# Full End-to-End Browser Audit

Built everything through the real UI: course → class → import quiz+homework → assign → reveal → enroll link → register student → approve → student takes both (timed + untimed) → answers + review → instructor sees the grade.

**22 PASS · 0 WARN · 0 FAIL** of 22. Screenshots: `e2e/shots/full/`.

| Step | Result | Notes |
|---|---|---|
| 1. Login as instructor | ✅ PASS | http://localhost:3100/instructor |
| 2. Create course | ✅ PASS | AUD90973 created |
| 3. Create class section | ✅ PASS | section A1 (class dff91592) |
| 4. Import assessments | ✅ PASS | homework + quiz imported via JSON |
| 5. Create manual assessment | ✅ PASS | activity, 40 pts |
| 6. Assign to class | ✅ PASS | hw=5632d999 quiz=e15b01da (quiz timed 30m) |
| 7. Reveal Answers toggle | ✅ PASS | enabled reveal on 2 assignment(s) |
| 8. Generate enroll link | ✅ PASS | …-1fb5-4318-866a-b57eeceef57f |
| 9. Student self-registers | ✅ PASS | audit-stu-90973@local.test → pending |
| 10. Approve pending student | ✅ PASS | status=active |
| 11. Search → real query filters correctly | ✅ PASS | student row shown, "E2E Admin" filtered out |
| Instructor pass — no page crashes | ✅ PASS | zero pageerrors |
| 12. New student logs in | ✅ PASS | http://localhost:3100/student |
| 12b. Dashboard shows tasks | ✅ PASS | assigned items visible |
| 13. Take homework + autograde | ✅ PASS | result page shows score |
| 13b. Answer review reveals | ✅ PASS | "Your answer" + correct/✓ shown |
| 14. Timed quiz — pre-quiz + countdown | ✅ PASS | prequiz=true countdown=true |
| 14b. Quiz submit → result | ✅ PASS | reached result page |
| 14c. Quiz reveals answers with NO close set (new rule) | ✅ PASS | answer review shown immediately |
| 15. Student grades render | ✅ PASS |  |
| Student pass — no page crashes | ✅ PASS | zero pageerrors |
| 16. Grade sheet shows new student | ✅ PASS | student row present |
