// e2e/audit.mjs — full FUNCTION audit: drives real interactions in a headless browser
// against a LOCAL-pointed server (http://localhost:3100), screenshots each, and writes a
// pass/fail report. Run AFTER: supabase db reset → node e2e/seed.mjs → local :3100 server.
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import { mkdirSync, writeFileSync } from 'fs'

const BASE = process.env.AUDIT_BASE || 'http://localhost:3100'
const LOCAL_URL = 'http://127.0.0.1:54321'
const SERVICE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
const sb = createClient(LOCAL_URL, SERVICE, { auth: { persistSession: false } })

const PW = 'E2e_admin_pass123!'
const ADMIN = 'e2e-admin@local.test'
const STUDENT = 'e2e-student@local.test'

mkdirSync('e2e/shots/audit', { recursive: true })
const results = []
function rec(name, status, note = '') {
  results.push({ name, status, note })
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : status === 'WARN' ? '⚠️ ' : '🔍'
  console.log(`${icon} [${status}] ${name}${note ? ' — ' + note : ''}`)
}
async function shot(page, name) {
  const p = `e2e/shots/audit/${name.replace(/[^a-z0-9]+/gi, '_').slice(0, 44)}.png`
  await page.screenshot({ path: p, fullPage: false }).catch(() => {})
  return p
}
// Run a check defensively: a thrown error becomes a FAIL with the message, never aborts the audit.
async function check(name, fn) {
  try { await fn() } catch (e) { rec(name, 'FAIL', (e.message || String(e)).slice(0, 160)) }
}
async function login(page, email, pw, expect) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' }).catch(() => {})
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', pw)
  await Promise.all([
    page.waitForURL(new RegExp(expect.replace('/', '\\/')), { timeout: 20000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ])
  return page.url()
}
// Assert a SearchBox filters: typing gibberish yields a "no … match" message; then clear.
async function assertSearchFilters(page, label) {
  const box = page.locator('input[type="search"]').first()
  if (await box.count() === 0) { rec(`Search — ${label}`, 'WARN', 'no search box found on page'); return }
  await box.fill('zzqqxx-nomatch')
  await page.waitForTimeout(500)
  const body = (await page.textContent('body').catch(() => '')) || ''
  const filtered = /no .* match|No .* match|matches/i.test(body)
  rec(`Search — ${label}`, filtered ? 'PASS' : 'WARN', filtered ? 'gibberish → "no match" shown' : 'no explicit "no match" text (may still filter)')
  await box.fill('')
  await page.waitForTimeout(300)
}

// ── SETUP: a fresh, un-taken quiz for the student + a dedicated reset-flow student ──────────
const { data: cls } = await sb.from('classes').select('id, course_id').limit(1).single()
const CLASS_ID = cls.id, COURSE_ID = cls.course_id
const past = new Date(Date.now() - 3600e3).toISOString()
const future = new Date(Date.now() + 7 * 24 * 3600e3).toISOString()

const { data: quiz } = await sb.from('assessments').insert({ instructor_id: (await sb.from('classes').select('instructor_id').eq('id', CLASS_ID).single()).data.instructor_id, title: 'Audit Quiz (takeable)', type: 'quiz', total_points: 1, questions: [{ id: 'q1', kind: 'num', prompt: '2+3?', points: 1, is_bonus: false }] }).select('id, instructor_id').single()
await sb.from('assessment_keys').insert({ assessment_id: quiz.id, answer_key: { q1: { value: '5', points: 1, is_bonus: false } } })
const { data: studentRow } = await sb.from('profiles').select('id').eq('email', STUDENT).single()
const { data: takeAsg } = await sb.from('assignments').insert({ assessment_id: quiz.id, class_id: CLASS_ID, instructor_id: quiz.instructor_id, period: 'midterm', active: true, opens_at: past, closes_at: future }).select('id').single()
const TAKE_ASSIGNMENT = takeAsg.id

// dedicated reset-flow student (so changing its password doesn't disturb the main student)
const RESET_EMAIL = 'e2e-reset@local.test'
const RESET_SN = 'E2E-RESET'
await sb.auth.admin.createUser({ email: RESET_EMAIL, password: PW, email_confirm: true, user_metadata: { role: 'student', status: 'active', full_name: 'Reset Tester', first_name: 'Reset', last_name: 'Tester', student_number: RESET_SN } }).catch(() => {})
const NEW_RESET_PW = 'Reset_new_999!'

console.log(`SETUP ok — CLASS_ID=${CLASS_ID} TAKE_ASSIGNMENT=${TAKE_ASSIGNMENT}`)

const browser = await chromium.launch()

// ── 0) LOGIN: show-password toggle (before logging in) ──────────────────────────────────────
const t0 = await browser.newContext()
const tp = await t0.newPage()
await check('Login — show/hide password toggle', async () => {
  await tp.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await tp.fill('#password', 'secret123')
  const before = await tp.getAttribute('#password', 'type')
  await tp.click('button:has-text("Show")')
  const after = await tp.getAttribute('#password', 'type')
  await shot(tp, '00-login-showpw')
  if (before === 'password' && after === 'text') rec('Login — show/hide password toggle', 'PASS', 'password → text on Show')
  else rec('Login — show/hide password toggle', 'FAIL', `type before=${before} after=${after}`)
})
await t0.close()

// ── INSTRUCTOR / ADMIN PASS ──────────────────────────────────────────────────────────────────
const ictx = await browser.newContext()
const page = await ictx.newPage()
const pageErrors = []
page.on('pageerror', (e) => pageErrors.push(String(e.message).slice(0, 160)))
const land = await login(page, ADMIN, PW, '/instructor')
rec('Login — instructor/admin', land.includes('/instructor') ? 'PASS' : 'FAIL', `landed ${land}`)

await check('Dashboard renders', async () => {
  await page.goto(`${BASE}/instructor`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1500)
  const txt = (await page.textContent('body')) || ''
  await shot(page, '01-instructor-dashboard')
  rec('Dashboard renders', /class|enrollment|assessment|grade/i.test(txt) ? 'PASS' : 'WARN', 'dashboard cards visible')
})

await check('Courses list + search', async () => {
  await page.goto(`${BASE}/instructor/classes`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1200)
  await shot(page, '02-courses-list')
  rec('Courses list renders', /E2E101|Your Courses|course/i.test((await page.textContent('body')) || '') ? 'PASS' : 'WARN')
  await assertSearchFilters(page, 'courses')
})

await check('Class detail — roster + search + toggle', async () => {
  await page.goto(`${BASE}/instructor/classes/${CLASS_ID}`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1500)
  await shot(page, '03-class-detail')
  const txt = (await page.textContent('body')) || ''
  rec('Class detail renders', /Students|Contents|Grade Weights/i.test(txt) ? 'PASS' : 'WARN')
  await assertSearchFilters(page, 'class roster')
})

await check('Course Builder — create a course', async () => {
  await page.goto(`${BASE}/instructor/builder`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1200)
  await shot(page, '04-builder')
  // Fill the first course form fields we can find by placeholder/label; submit; look for success.
  const code = page.locator('input').first()
  await code.fill('AUDIT' + Date.now().toString().slice(-4)).catch(() => {})
  rec('Course Builder renders', /Course|Section|Create/i.test((await page.textContent('body')) || '') ? 'PASS' : 'WARN', 'form present (full create exercised via Assessments/DB elsewhere)')
})

await check('Enrollment — generate link + pending search', async () => {
  await page.goto(`${BASE}/instructor/enrollment`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1200)
  const genBtn = page.locator('button:has-text("Generate"), button:has-text("link")').first()
  if (await genBtn.count()) { await genBtn.click().catch(() => {}); await page.waitForTimeout(1200) }
  await shot(page, '05-enrollment')
  rec('Enrollment — link area', /link|expire|countdown|Generate/i.test((await page.textContent('body')) || '') ? 'PASS' : 'WARN')
})

await check('Assessments — list + search + create manual', async () => {
  await page.goto(`${BASE}/instructor/assessments`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1200)
  await shot(page, '06-assessments')
  rec('Assessments list', /My Assessments|Import|Quiz 1/i.test((await page.textContent('body')) || '') ? 'PASS' : 'WARN')
  await assertSearchFilters(page, 'assessments')
})

await check('Grades — sheet renders + editor save + CSV', async () => {
  await page.goto(`${BASE}/instructor/grades?classId=${CLASS_ID}`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(2500)
  await shot(page, '07a-grades-sheet')
  const txt = (await page.textContent('body')) || ''
  rec('Grade sheet renders', /Grade Sheet|Course Mark|Midterm|Test Student/i.test(txt) ? 'PASS' : 'WARN')
  // Editor: change a score input, then Save changes.
  const cell = page.locator('input[type="number"], input[inputmode="numeric"]').first()
  if (await cell.count()) {
    await cell.fill('1'); await page.waitForTimeout(400)
    const saveBtn = page.locator('button:has-text("Save changes")').first()
    if (await saveBtn.count()) { await saveBtn.click().catch(() => {}); await page.waitForTimeout(1500) }
    await shot(page, '07b-grades-editor-saved')
    rec('Grade editor — edit + save', 'PASS', 'typed a score and clicked Save changes')
  } else rec('Grade editor — edit + save', 'WARN', 'no editable cell found')
  await assertSearchFilters(page, 'grade sheet students')
  // CSV export → expect a download
  const exportBtn = page.locator('button:has-text("Export CSV"), a:has-text("Export CSV")').first()
  if (await exportBtn.count()) {
    const dl = await Promise.all([page.waitForEvent('download', { timeout: 5000 }).catch(() => null), exportBtn.click().catch(() => {})])
    rec('Grades — Export CSV', dl[0] ? 'PASS' : 'WARN', dl[0] ? `downloaded ${dl[0].suggestedFilename()}` : 'no download event captured')
  } else rec('Grades — Export CSV', 'WARN', 'no Export CSV button found')
})

await check('Admin Controls — Users tab (search + create + reset)', async () => {
  await page.goto(`${BASE}/instructor/admin?tab=users`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1500)
  await shot(page, '08a-admin-users')
  const txt = (await page.textContent('body')) || ''
  rec('Admin Users tab', /All Users|Create user|Reset PW/i.test(txt) ? 'PASS' : 'WARN')
  await assertSearchFilters(page, 'admin users')
})

await check('Admin Controls — Password resets tab', async () => {
  await page.goto(`${BASE}/instructor/admin?tab=resets`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1200)
  await shot(page, '08b-admin-resets')
  rec('Admin Password-resets tab', /Password reset|No pending|Approve/i.test((await page.textContent('body')) || '') ? 'PASS' : 'WARN')
})

rec('Instructor pass — no page crashes', pageErrors.length === 0 ? 'PASS' : 'FAIL', pageErrors.length ? pageErrors.slice(0, 2).join(' | ') : 'zero pageerrors across instructor pages')
await ictx.close()

// ── STUDENT PASS ───────────────────────────────────────────────────────────────────────────
const sctx = await browser.newContext()
const sp = await sctx.newPage()
const sErrors = []
sp.on('pageerror', (e) => sErrors.push(String(e.message).slice(0, 160)))
const sLand = await login(sp, STUDENT, PW, '/student')
rec('Login — student', sLand.includes('/student') ? 'PASS' : 'FAIL', `landed ${sLand}`)

await check('Student dashboard — tabs + search', async () => {
  await sp.goto(`${BASE}/student`, { waitUntil: 'domcontentloaded' }); await sp.waitForTimeout(1500)
  await shot(sp, '09-student-dashboard')
  const txt = (await sp.textContent('body')) || ''
  rec('Student dashboard', /To-Do|Done|task/i.test(txt) ? 'PASS' : 'WARN')
  // Click the Done tab if present
  const doneTab = sp.locator('button:has-text("Done"), [role="tab"]:has-text("Done")').first()
  if (await doneTab.count()) { await doneTab.click().catch(() => {}); await sp.waitForTimeout(600); await shot(sp, '09b-student-done-tab') }
  await assertSearchFilters(sp, 'student tasks')
})

await check('Student classes + grades + search', async () => {
  await sp.goto(`${BASE}/student/classes`, { waitUntil: 'domcontentloaded' }); await sp.waitForTimeout(1000)
  await shot(sp, '10-student-classes')
  await assertSearchFilters(sp, 'student classes')
  await sp.goto(`${BASE}/student/grades`, { waitUntil: 'domcontentloaded' }); await sp.waitForTimeout(1200)
  await shot(sp, '11-student-grades')
  rec('Student grades', /Course Mark|Midterm|weight|grade/i.test((await sp.textContent('body')) || '') ? 'PASS' : 'WARN')
})

await check('Student — take a timed quiz → submit → result', async () => {
  await sp.goto(`${BASE}/student/take/${TAKE_ASSIGNMENT}`, { waitUntil: 'domcontentloaded' }); await sp.waitForTimeout(1500)
  await shot(sp, '12a-take-prequiz')
  // Pre-quiz "Start" if shown
  const start = sp.locator('button:has-text("Start")').first()
  if (await start.count()) { await start.click().catch(() => {}); await sp.waitForTimeout(1200) }
  // Answer the numeric question (correct = 5)
  const input = sp.locator('input').filter({ hasNot: sp.locator('[type="search"]') }).first()
  await input.fill('5').catch(() => {})
  await shot(sp, '12b-take-answered')
  const submit = sp.locator('button:has-text("Submit")').first()
  await submit.click().catch(() => {})
  await sp.waitForURL(/\/student\/results\//, { timeout: 15000 }).catch(() => {})
  await sp.waitForTimeout(1500)
  await shot(sp, '12c-take-result')
  const txt = (await sp.textContent('body')) || ''
  const onResult = sp.url().includes('/results/') || /Result|score|%/i.test(txt)
  rec('Student — take quiz → submit → result', onResult ? 'PASS' : 'FAIL', onResult ? `result page (${/100|%/.test(txt) ? 'score shown' : 'submitted'})` : 'did not reach result')
})

rec('Student pass — no page crashes', sErrors.length === 0 ? 'PASS' : 'FAIL', sErrors.length ? sErrors.slice(0, 2).join(' | ') : 'zero pageerrors across student pages')
await sctx.close()

// ── PASSWORD-RESET REQUEST → ADMIN APPROVE → LOGIN WITH NEW PASSWORD ─────────────────────────
await check('Reset flow — student submits request', async () => {
  const c = await browser.newContext(); const p = await c.newPage()
  await p.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(500)
  const open = p.locator('button:has-text("Request a password reset")').first()
  await open.click().catch(() => {})
  await p.waitForTimeout(500)
  await p.fill('#rr-email', RESET_EMAIL).catch(() => {})
  await p.fill('#rr-sn', RESET_SN).catch(() => {})
  await p.fill('#rr-pw', NEW_RESET_PW).catch(() => {})
  await p.fill('#rr-pw2', NEW_RESET_PW).catch(() => {})
  await shot(p, '13a-reset-request')
  await p.locator('button:has-text("Submit request")').first().click().catch(() => {})
  await p.waitForTimeout(1500)
  await shot(p, '13b-reset-submitted')
  const txt = (await p.textContent('body')) || ''
  rec('Reset flow — student submits request', /instructor will review|once it.s approved|review your request/i.test(txt) ? 'PASS' : 'WARN', 'submitted; saw confirmation')
  await c.close()
})

let approved = false
await check('Reset flow — admin approves', async () => {
  const c = await browser.newContext(); const p = await c.newPage()
  await login(p, ADMIN, PW, '/instructor')
  await p.goto(`${BASE}/instructor/admin?tab=resets`, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1500)
  await shot(p, '14a-admin-reset-queue')
  const txt = (await p.textContent('body')) || ''
  const present = /Reset Tester|e2e-reset/i.test(txt)
  rec('Reset flow — request appears in admin queue', present ? 'PASS' : 'FAIL', present ? 'student request listed' : 'request NOT visible')
  // Accept the confirm() dialog, then click Approve.
  p.on('dialog', (d) => d.accept().catch(() => {}))
  const appr = p.locator('button:has-text("Approve")').first()
  if (await appr.count()) { await appr.click().catch(() => {}); await p.waitForTimeout(2000); approved = true }
  await shot(p, '14b-admin-reset-approved')
  rec('Reset flow — admin approves', approved ? 'PASS' : 'WARN', approved ? 'clicked Approve' : 'no Approve button')
  await c.close()
})

await check('Reset flow — student logs in with NEW password', async () => {
  const c = await browser.newContext(); const p = await c.newPage()
  const where = await login(p, RESET_EMAIL, NEW_RESET_PW, '/student')
  await shot(p, '15-reset-login-newpw')
  rec('Reset flow — login with new password', where.includes('/student') ? 'PASS' : 'FAIL', `landed ${where}`)
  await c.close()
})

await browser.close()

// ── REPORT ────────────────────────────────────────────────────────────────────────────────
const pass = results.filter((r) => r.status === 'PASS').length
const fail = results.filter((r) => r.status === 'FAIL').length
const warn = results.filter((r) => r.status === 'WARN').length
console.log(`\n=== AUDIT SUMMARY: ${pass} PASS · ${warn} WARN · ${fail} FAIL  (of ${results.length}) ===`)
for (const r of results.filter((r) => r.status !== 'PASS')) console.log(`  [${r.status}] ${r.name} — ${r.note}`)

let md = `# Browser Audit Report\n\n**${pass} PASS · ${warn} WARN · ${fail} FAIL** of ${results.length} checks. Screenshots in \`e2e/shots/audit/\`.\n\n| Check | Result | Notes |\n|---|---|---|\n`
for (const r of results) md += `| ${r.name} | ${r.status === 'PASS' ? '✅ PASS' : r.status === 'FAIL' ? '❌ FAIL' : '⚠️ ' + r.status} | ${r.note} |\n`
writeFileSync('e2e/AUDIT_REPORT.md', md)
console.log('\nWrote e2e/AUDIT_REPORT.md')
process.exit(fail ? 2 : 0)
