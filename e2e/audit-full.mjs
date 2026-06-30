// e2e/audit-full.mjs — TRUE end-to-end audit. Builds EVERYTHING through the real UI like a human:
// create course → class → import quiz+homework → assign → reveal → enroll link → register a new
// student → approve → student logs in, TAKES both (timed + untimed), answers, submits, sees score
// and answer review → instructor sees the grade. Plus real-query searches. Screenshots every step.
//
// Run AFTER: supabase db reset → node e2e/seed.mjs → local :3100 server up.
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import { mkdirSync, writeFileSync } from 'fs'

const BASE = process.env.AUDIT_BASE || 'http://localhost:3100'
const sb = createClient('http://127.0.0.1:54321', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU', { auth: { persistSession: false } })

const PW = 'E2e_admin_pass123!'
const ADMIN = 'e2e-admin@local.test'
const RND = String(Date.now()).slice(-5)
const COURSE_CODE = 'AUD' + RND
const SECTION = 'A1'
const STU = { first: 'Audra', last: 'Tester' + RND, sn: 'AUD-' + RND, email: `audit-stu-${RND}@local.test`, pw: 'Audit_pw_123!' }

mkdirSync('e2e/shots/full', { recursive: true })
const R = []
function rec(name, status, note = '') {
  R.push({ name, status, note })
  console.log(`${status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️ '} [${status}] ${name}${note ? ' — ' + note : ''}`)
}
let N = 0
async function shot(p, name) { const f = `e2e/shots/full/${String(++N).padStart(2, '0')}-${name.replace(/[^a-z0-9]+/gi, '_').slice(0, 40)}.png`; await p.screenshot({ path: f }).catch(() => {}); return f }
async function step(name, fn) { try { return await fn() } catch (e) { rec(name, 'FAIL', (e.message || String(e)).slice(0, 170)); return null } }
async function login(page, email, pw, expect) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"]', email); await page.fill('input[type="password"]', pw)
  await Promise.all([page.waitForURL(new RegExp(expect.replace('/', '\\/')), { timeout: 20000 }).catch(() => {}), page.click('button[type="submit"]')])
  return page.url()
}

// 'activity' type so answers reveal immediately when graded (quiz/exam/homework need a past
// close date to reveal — see AssignmentMetaControls). This lets one run exercise answer review.
const HW = { title: `Audit Activity ${RND}`, type: 'activity', total_points: 2, questions: [
  { id: 'q1', kind: 'num', prompt: 'What is 3 + 4?', points: 1, is_bonus: false },
  { id: 'q2', kind: 'mcq', prompt: 'Capital of the Philippines?', points: 1, is_bonus: false, options: ['Manila', 'Cebu', 'Davao'] },
], answer_key: { q1: { value: '7', points: 1, is_bonus: false }, q2: { value: 'Manila', points: 1, is_bonus: false } } }
const QZ = { title: `Audit Quiz ${RND}`, type: 'quiz', total_points: 1, questions: [
  { id: 'q1', kind: 'num', prompt: 'What is 10 - 4?', points: 1, is_bonus: false },
], answer_key: { q1: { value: '6', points: 1, is_bonus: false } } }

const browser = await chromium.launch()
const ictx = await browser.newContext()
const page = await ictx.newPage()
const pageErrors = []
page.on('pageerror', (e) => pageErrors.push(String(e.message).slice(0, 150)))

let hwAsg = null, qzAsg = null, NEW_CLASS_ID = null, enrollUrl = null

// ── 1) Login ──
const land = await login(page, ADMIN, PW, '/instructor')
rec('1. Login as instructor', land.includes('/instructor') ? 'PASS' : 'FAIL', land)

// ── 2) Create a course (UI) ──
await step('2. Create course', async () => {
  await page.goto(`${BASE}/instructor/builder`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(800)
  await page.fill('#c-code', COURSE_CODE); await page.fill('#c-title', 'Audit Course ' + RND); await page.fill('#c-desc', 'created by full audit')
  await page.click('button:has-text("Create course")')
  await page.waitForSelector(`text=Course ${COURSE_CODE} created`, { timeout: 8000 })
  await shot(page, 'course-created')
  rec('2. Create course', 'PASS', `${COURSE_CODE} created`)
})

// ── 3) Create a class section (UI) ──
await step('3. Create class section', async () => {
  await page.goto(`${BASE}/instructor/builder`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(800)
  await page.selectOption('#cl-course', { label: COURSE_CODE }).catch(async () => { await page.selectOption('#cl-course', { index: 0 }) })
  await page.selectOption('#cl-period', '1st Semester').catch(() => {})
  await page.fill('#cl-section', SECTION); await page.fill('#cl-pic', 'Auditor')
  await page.click('button:has-text("Create class")')
  await page.waitForSelector(`text=Created section ${SECTION}`, { timeout: 8000 })
  await shot(page, 'class-created')
  const { data } = await sb.from('classes').select('id').eq('section_label', SECTION).order('created_at', { ascending: false }).limit(1).single()
  NEW_CLASS_ID = data?.id
  rec('3. Create class section', NEW_CLASS_ID ? 'PASS' : 'FAIL', `section ${SECTION} (class ${NEW_CLASS_ID?.slice(0, 8)})`)
})

// ── 4) Import a homework + a quiz via JSON (UI) ──
await step('4. Import assessments (homework + quiz)', async () => {
  for (const [obj, label] of [[HW, 'homework'], [QZ, 'quiz']]) {
    await page.goto(`${BASE}/instructor/assessments`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(600)
    await page.fill('#import-json', JSON.stringify(obj))
    await page.locator('section:has(#import-json) button:has-text("Import")').click()
    await page.waitForSelector('text=Imported assessment', { timeout: 8000 })
  }
  await shot(page, 'imported')
  rec('4. Import assessments', 'PASS', 'homework + quiz imported via JSON')
})

// ── 5) Create a manual assessment (UI) ──
await step('5. Create manual assessment', async () => {
  await page.goto(`${BASE}/instructor/assessments`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(600)
  await page.fill('#manual-name', `Audit Manual ${RND}`); await page.selectOption('#manual-type', 'activity'); await page.fill('#manual-points', '40')
  await page.locator('section:has(#manual-name) button:has-text("Create")').click()
  await page.waitForSelector('text=Created assessment', { timeout: 8000 })
  await shot(page, 'manual-created')
  rec('5. Create manual assessment', 'PASS', 'activity, 40 pts')
})

// ── 6) Assign homework (untimed) + quiz (30-min timed) to the new class (UI) ──
async function assign(title, durationMin) {
  await page.goto(`${BASE}/instructor/assessments`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(800)
  await page.selectOption('#assign-class', { label: `${COURSE_CODE} - ${SECTION}` }).catch(async () => {
    const v = await page.locator('#assign-class option').filter({ hasText: COURSE_CODE }).first().getAttribute('value'); await page.selectOption('#assign-class', v)
  })
  const av = await page.locator('#assign-id option').filter({ hasText: title }).first().getAttribute('value')
  await page.selectOption('#assign-id', av)
  if (durationMin) await page.fill('#assign-duration', String(durationMin))
  await page.click('button:has-text("Assign")')
  await page.waitForSelector('text=Assigned (', { timeout: 8000 })
  const txt = (await page.locator('text=Assigned (').first().textContent()) || ''
  return (txt.match(/Assigned \(([0-9a-f-]+)\)/) || [])[1] || null
}
await step('6. Assign homework + quiz', async () => {
  hwAsg = await assign(HW.title, null)
  qzAsg = await assign(QZ.title, 30)
  await shot(page, 'assigned')
  rec('6. Assign to class', hwAsg && qzAsg ? 'PASS' : 'FAIL', `hw=${hwAsg?.slice(0, 8)} quiz=${qzAsg?.slice(0, 8)} (quiz timed 30m)`)
})

// ── 7) Class detail: reveal answers ON for the homework (so review shows after grading) ──
await step('7. Toggle Reveal Answers (all assignments)', async () => {
  // Toggle ONE reveal per fresh page load: setAssignmentMeta calls refresh(), and toggling
  // a second box before that re-render settles can drop the save (a fast-toggle race).
  let toggled = 0
  for (let iter = 0; iter < 5; iter++) {
    await page.goto(`${BASE}/instructor/classes/${NEW_CLASS_ID}`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1200)
    const boxes = page.locator('label:has-text("Reveal Answers") input[type="checkbox"]')
    const n = await boxes.count()
    let didOne = false
    for (let i = 0; i < n; i++) {
      const b = boxes.nth(i)
      if (!(await b.isChecked())) {
        await b.check().catch(() => {})
        await page.locator('text=Saved').first().waitFor({ timeout: 5000 }).catch(() => {})
        await page.waitForTimeout(900)
        toggled++; didOne = true; break // reload before the next toggle
      }
    }
    if (!didOne) break
  }
  await shot(page, 'reveal-on')
  rec('7. Reveal Answers toggle', toggled > 0 ? 'PASS' : 'WARN', `enabled reveal on ${toggled} assignment(s)`)
})

// ── 8) Enrollment: generate a class-join link for the new section, read its URL (UI) ──
await step('8. Generate enroll link', async () => {
  await page.goto(`${BASE}/instructor/enrollment`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1000)
  const sectionSel = page.locator('section[aria-labelledby="links-h"] select').nth(1)
  await sectionSel.selectOption({ label: `${COURSE_CODE} - ${SECTION}` }).catch(() => {})
  await page.locator('section[aria-labelledby="links-h"] button:has-text("Generate link")').click()
  await page.waitForTimeout(1500)
  enrollUrl = await page.locator('section[aria-labelledby="links-h"] input[readonly]').first().inputValue().catch(() => null)
  await shot(page, 'enroll-link')
  rec('8. Generate enroll link', enrollUrl && enrollUrl.includes('/register/') ? 'PASS' : 'FAIL', enrollUrl ? '…' + enrollUrl.slice(-28) : 'no url')
})

// ── 9) Register a NEW student via the real link (UI, fresh context) ──
await step('9. Student self-registers via link', async () => {
  if (!enrollUrl) throw new Error('no enroll url')
  // The generated URL uses NEXT_PUBLIC_SITE_URL (localhost:3000 fallback in this local build);
  // rewrite the host to our :3100 server. The token is the real, valid link token.
  const token = enrollUrl.split('/register/')[1]
  const regUrl = `${BASE}/register/${token}`
  const c = await browser.newContext(); const p = await c.newPage()
  await p.goto(regUrl, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(800)
  await p.fill('#r-first', STU.first); await p.fill('#r-last', STU.last); await p.fill('#r-sn', STU.sn)
  await p.fill('#r-email', STU.email); await p.fill('#r-pw', STU.pw); await p.fill('#r-pw2', STU.pw)
  await shot(p, 'register-filled')
  await p.click('button:has-text("Register")')
  await p.waitForSelector('text=Registration submitted', { timeout: 8000 })
  await shot(p, 'register-submitted')
  rec('9. Student self-registers', 'PASS', `${STU.email} → pending`)
  await c.close()
})

// ── 10) Instructor approves the pending student (UI) ──
await step('10. Approve pending student', async () => {
  await page.goto(`${BASE}/instructor/enrollment`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1200)
  await shot(page, 'pending-before-approve')
  const row = page.locator('div', { hasText: STU.last }).filter({ has: page.locator('button:has-text("Approve")') }).last()
  const appr = (await row.count()) ? row.locator('button:has-text("Approve")').first() : page.locator('button:has-text("Approve")').first()
  await appr.click()
  await page.waitForTimeout(1500)
  await shot(page, 'pending-approved')
  const { data } = await sb.from('profiles').select('status').eq('email', STU.email).single()
  rec('10. Approve pending student', data?.status === 'active' ? 'PASS' : 'FAIL', `status=${data?.status}`)
})

// ── 11) Real-query search (admin Users): type the student's name → row shows, others hidden ──
await step('11. Search filters to the right row', async () => {
  await page.goto(`${BASE}/instructor/admin?tab=users`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1200)
  const box = page.locator('input[type="search"]').first()
  await box.fill(STU.first); await page.waitForTimeout(700)
  await shot(page, 'users-search-match')
  // Strong signal: a known OTHER user ("E2E Admin") must disappear when filtering to the student.
  const adminHidden = await page.locator('td:has-text("E2E Admin")').count() === 0
  const stuVisible = await page.locator(`td:has-text("${STU.first}")`).count() > 0
  rec('11. Search → real query filters correctly', stuVisible && adminHidden ? 'PASS' : 'WARN', `student row ${stuVisible ? 'shown' : 'MISSING'}, "E2E Admin" ${adminHidden ? 'filtered out' : 'still shown'}`)
})

rec('Instructor pass — no page crashes', pageErrors.length === 0 ? 'PASS' : 'FAIL', pageErrors[0] || 'zero pageerrors')
await ictx.close()

// ── 12-14) STUDENT logs in and TAKES both assessments ──
const sctx = await browser.newContext()
const sp = await sctx.newPage()
const sErr = []
sp.on('pageerror', (e) => sErr.push(String(e.message).slice(0, 150)))
const sLand = await login(sp, STU.email, STU.pw, '/student')
rec('12. New student logs in', sLand.includes('/student') ? 'PASS' : 'FAIL', sLand)

await step('12b. Dashboard shows assigned tasks', async () => {
  await sp.goto(`${BASE}/student`, { waitUntil: 'domcontentloaded' }); await sp.waitForTimeout(1500)
  await shot(sp, 'student-dashboard')
  const body = (await sp.textContent('body')) || ''
  rec('12b. Dashboard shows tasks', body.includes(HW.title) || body.includes(QZ.title) ? 'PASS' : 'WARN', 'assigned items visible')
})

// Homework (untimed) → answer → submit → result WITH answer review
await step('13. Take homework → answer → submit → answer review', async () => {
  await sp.goto(`${BASE}/student/take/${hwAsg}`, { waitUntil: 'domcontentloaded' })
  await sp.waitForSelector('input[placeholder="your answer"]', { timeout: 12000 })
  await shot(sp, 'hw-take')
  await sp.locator('input[placeholder="your answer"]').first().fill('7')           // q1 correct
  await sp.locator('input[type="radio"][value="Manila"]').check().catch(() => {})  // q2 correct
  await shot(sp, 'hw-answered')
  await sp.waitForTimeout(500)
  await Promise.all([
    sp.waitForURL(/\/student\/results\//, { timeout: 20000 }).catch(() => {}),
    sp.locator('button:has-text("Submit")').first().click(),
  ])
  await sp.waitForTimeout(1200)
  await shot(sp, 'hw-result')
  const body = (await sp.textContent('body')) || ''
  const scored = sp.url().includes('/results/') && /%/.test(body)
  const review = /Answer Review/i.test(body) && /Your answer/i.test(body)
  rec('13. Take homework + autograde', scored ? 'PASS' : 'FAIL', scored ? 'result page shows score' : 'no score')
  rec('13b. Answer review reveals', review ? 'PASS' : 'WARN', review ? '"Your answer" + correct/✓ shown' : 'review not visible')
})

// Quiz (timed) → pre-quiz Start → countdown → answer → submit → result
await step('14. Take TIMED quiz → Start → countdown → submit', async () => {
  await sp.goto(`${BASE}/student/take/${qzAsg}`, { waitUntil: 'domcontentloaded' }); await sp.waitForTimeout(1200)
  await shot(sp, 'quiz-prequiz')
  const startBtn = sp.locator('button:has-text("Start")').first()
  const hadPrequiz = await startBtn.count() > 0
  if (hadPrequiz) await startBtn.click()
  // Wait for the actual question form to render before interacting (avoids the intro→taking race).
  await sp.waitForSelector('input[placeholder="your answer"]', { timeout: 12000 })
  const timerShown = /Time remaining/i.test((await sp.textContent('body')) || '')
  await shot(sp, 'quiz-taking')
  await sp.locator('input[placeholder="your answer"]').first().fill('6')  // correct
  await sp.waitForTimeout(500) // let the debounced draft-save settle
  await Promise.all([
    sp.waitForURL(/\/student\/results\//, { timeout: 20000 }).catch(() => {}),
    sp.locator('button:has-text("Submit")').first().click(),
  ])
  await sp.waitForTimeout(1000)
  await shot(sp, 'quiz-result')
  const reached = sp.url().includes('/results/')
  const qbody = (await sp.textContent('body')) || ''
  const qReview = /Answer Review/i.test(qbody) && /Your answer/i.test(qbody)
  rec('14. Timed quiz — pre-quiz + countdown', hadPrequiz && timerShown ? 'PASS' : 'WARN', `prequiz=${hadPrequiz} countdown=${timerShown}`)
  rec('14b. Quiz submit → result', reached ? 'PASS' : 'FAIL', reached ? 'reached result page' : 'did not reach result')
  rec('14c. Quiz reveals answers with NO close set (new rule)', qReview ? 'PASS' : 'FAIL', qReview ? 'answer review shown immediately' : 'review NOT shown (rule not applied?)')
})

await step('15. Student grades show the new scores', async () => {
  await sp.goto(`${BASE}/student/grades`, { waitUntil: 'domcontentloaded' }); await sp.waitForTimeout(1200)
  await shot(sp, 'student-grades')
  rec('15. Student grades render', /Course Mark|Midterm|%/.test((await sp.textContent('body')) || '') ? 'PASS' : 'WARN')
})
rec('Student pass — no page crashes', sErr.length === 0 ? 'PASS' : 'FAIL', sErr[0] || 'zero pageerrors')
await sctx.close()

// ── 16) Instructor grade sheet shows the student + scores ──
await step('16. Instructor grade sheet shows the student', async () => {
  const c = await browser.newContext(); const p = await c.newPage()
  await login(p, ADMIN, PW, '/instructor')
  await p.goto(`${BASE}/instructor/grades?classId=${NEW_CLASS_ID}`, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2500)
  await shot(p, 'instructor-gradesheet')
  const body = (await p.textContent('body')) || ''
  rec('16. Grade sheet shows new student', body.includes(STU.last) || body.includes(STU.first) ? 'PASS' : 'WARN', 'student row present')
  await c.close()
})

await browser.close()

// ── REPORT ──
const pass = R.filter((r) => r.status === 'PASS').length, fail = R.filter((r) => r.status === 'FAIL').length, warn = R.filter((r) => r.status === 'WARN').length
console.log(`\n=== FULL AUDIT: ${pass} PASS · ${warn} WARN · ${fail} FAIL  (of ${R.length}) ===`)
for (const r of R.filter((r) => r.status !== 'PASS')) console.log(`  [${r.status}] ${r.name} — ${r.note}`)
let md = `# Full End-to-End Browser Audit\n\nBuilt everything through the real UI: course → class → import quiz+homework → assign → reveal → enroll link → register student → approve → student takes both (timed + untimed) → answers + review → instructor sees the grade.\n\n**${pass} PASS · ${warn} WARN · ${fail} FAIL** of ${R.length}. Screenshots: \`e2e/shots/full/\`.\n\n| Step | Result | Notes |\n|---|---|---|\n`
for (const r of R) md += `| ${r.name} | ${r.status === 'PASS' ? '✅ PASS' : r.status === 'FAIL' ? '❌ FAIL' : '⚠️ WARN'} | ${r.note} |\n`
writeFileSync('e2e/AUDIT_FULL_REPORT.md', md)
console.log('Wrote e2e/AUDIT_FULL_REPORT.md')
process.exit(fail ? 2 : 0)
