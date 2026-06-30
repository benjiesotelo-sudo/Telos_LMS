# Browser Audit Report

**30 PASS · 0 WARN · 0 FAIL** of 30 checks. Screenshots in `e2e/shots/audit/`.

| Check | Result | Notes |
|---|---|---|
| Login — show/hide password toggle | ✅ PASS | password → text on Show |
| Login — instructor/admin | ✅ PASS | landed http://localhost:3100/instructor |
| Dashboard renders | ✅ PASS | dashboard cards visible |
| Courses list renders | ✅ PASS |  |
| Search — courses | ✅ PASS | gibberish → "no match" shown |
| Class detail renders | ✅ PASS |  |
| Search — class roster | ✅ PASS | gibberish → "no match" shown |
| Course Builder renders | ✅ PASS | form present (full create exercised via Assessments/DB elsewhere) |
| Enrollment — link area | ✅ PASS |  |
| Assessments list | ✅ PASS |  |
| Search — assessments | ✅ PASS | gibberish → "no match" shown |
| Grade sheet renders | ✅ PASS |  |
| Grade editor — edit + save | ✅ PASS | typed a score and clicked Save changes |
| Search — grade sheet students | ✅ PASS | gibberish → "no match" shown |
| Grades — Export CSV | ✅ PASS | downloaded E2E101_-_1-grades.csv |
| Admin Users tab | ✅ PASS |  |
| Search — admin users | ✅ PASS | gibberish → "no match" shown |
| Admin Password-resets tab | ✅ PASS |  |
| Instructor pass — no page crashes | ✅ PASS | zero pageerrors across instructor pages |
| Login — student | ✅ PASS | landed http://localhost:3100/student |
| Student dashboard | ✅ PASS |  |
| Search — student tasks | ✅ PASS | gibberish → "no match" shown |
| Search — student classes | ✅ PASS | gibberish → "no match" shown |
| Student grades | ✅ PASS |  |
| Student — take quiz → submit → result | ✅ PASS | result page (score shown) |
| Student pass — no page crashes | ✅ PASS | zero pageerrors across student pages |
| Reset flow — student submits request | ✅ PASS | submitted; saw confirmation |
| Reset flow — request appears in admin queue | ✅ PASS | student request listed |
| Reset flow — admin approves | ✅ PASS | clicked Approve |
| Reset flow — login with new password | ✅ PASS | landed http://localhost:3100/student |
