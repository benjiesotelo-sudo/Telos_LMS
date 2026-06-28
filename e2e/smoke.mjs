// e2e/smoke.mjs — headless smoke: log in, load every page, detect re-request loops,
// console/page errors, and "stuck on Loading…". Run AFTER seed.mjs + a :3100 dev server.
import { chromium } from 'playwright'
import { mkdirSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

const BASE = process.env.SMOKE_BASE || 'http://localhost:3100'
const ADMIN_EMAIL = 'e2e-admin@local.test'
const ADMIN_PASSWORD = 'E2e_admin_pass123!'

// Fetch the seeded class/course IDs from the local DB (robust to re-seeds).
const sb = createClient('http://127.0.0.1:54321', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU', { auth: { persistSession: false } })
const { data: cls } = await sb.from('classes').select('id, course_id').limit(1).single()
const CLASS_ID = cls.id
const COURSE_ID = cls.course_id
console.log(`Using CLASS_ID=${CLASS_ID} COURSE_ID=${COURSE_ID}`)

const ROUTES = [
  ['/instructor', 'Dashboard'],
  ['/instructor/classes', 'Courses index'],
  [`/instructor/classes?course=${COURSE_ID}`, 'Sections of course'],
  [`/instructor/classes/${CLASS_ID}`, 'Class detail'],
  ['/instructor/builder', 'Course/Class Builder'],
  ['/instructor/enrollment', 'Enrollment'],
  ['/instructor/assessments', 'Assessments'],
  ['/instructor/grades', 'Grades (picker)'],
  [`/instructor/grades?classId=${CLASS_ID}`, 'Grades (section) <-- reported bug'],
  ['/instructor/profile', 'Profile'],
  ['/instructor/users', 'Users (admin)'],
  ['/account/password', 'Change password'],
]

mkdirSync('e2e/shots', { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage()

// ── Login ──
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' }).catch(() => {})
await page.fill('input[type="email"]', ADMIN_EMAIL)
await page.fill('input[type="password"]', ADMIN_PASSWORD)
await Promise.all([
  page.waitForURL(/\/instructor/, { timeout: 15000 }).catch(() => {}),
  page.click('button[type="submit"]'),
])
const afterLogin = page.url()
console.log(`LOGIN -> ${afterLogin}`)
if (!afterLogin.includes('/instructor')) {
  console.log('LOGIN_FAILED — cannot continue'); await browser.close(); process.exit(1)
}

const results = []
async function checkRoutes(page, routes) {
for (const [path, label] of routes) {
  const url = `${BASE}${path}`
  const reqCounts = new Map()
  const consoleErrors = []
  const pageErrors = []
  const onReq = (req) => {
    // count document + RSC fetches of THIS path (ignore static assets)
    const u = req.url()
    if (u.startsWith(BASE) && !/\.(js|css|png|svg|ico|woff2?)(\?|$)/.test(u)) {
      const key = u.replace(BASE, '').split('?')[0]
      reqCounts.set(key, (reqCounts.get(key) || 0) + 1)
    }
  }
  const onConsole = (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 200)) }
  const onPageErr = (err) => pageErrors.push(String(err.message || err).slice(0, 200))
  page.on('request', onReq)
  page.on('console', onConsole)
  page.on('pageerror', onPageErr)

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch((e) => pageErrors.push('goto: ' + e.message))
  await page.waitForTimeout(4000) // observe for a loop

  const bodyText = (await page.textContent('body').catch(() => '')) || ''
  const stuckLoading = /Loading…|Loading\.\.\./.test(bodyText) && bodyText.replace(/\s+/g, ' ').trim().length < 400
  const thisPathHits = reqCounts.get(path.split('?')[0]) || 0
  const looping = thisPathHits > 4

  page.off('request', onReq); page.off('console', onConsole); page.off('pageerror', onPageErr)
  const shot = `e2e/shots/${label.replace(/[^a-z0-9]+/gi, '_').slice(0, 30)}.png`
  await page.screenshot({ path: shot, fullPage: false }).catch(() => {})

  const verdict = looping ? 'LOOP' : pageErrors.length ? 'PAGE_ERROR' : stuckLoading ? 'STUCK_LOADING' : consoleErrors.length ? 'CONSOLE_ERR' : 'OK'
  results.push({ label, path, verdict, selfHits: thisPathHits, pageErrors, consoleErrors })
  console.log(`[${verdict}] ${label}  (self-requests: ${thisPathHits})${pageErrors[0] ? '  pageError: ' + pageErrors[0] : ''}${consoleErrors[0] ? '  console: ' + consoleErrors[0] : ''}`)
}
}

// ── Instructor pass (admin) ──
await checkRoutes(page, ROUTES)

// ── Student pass (fresh context, logs in as the seeded student) ──
const STUDENT_EMAIL = 'e2e-student@local.test'
const STUDENT_ROUTES = [
  ['/student', 'Student Dashboard'],
  ['/student/classes', 'Student Classes list'],
  ['/student/grades', 'Student Grades'],
  [`/student/classes/${CLASS_ID}`, 'Student class detail'],
]
const sctx = await browser.newContext()
const spage = await sctx.newPage()
await spage.goto(`${BASE}/login`, { waitUntil: 'networkidle' }).catch(() => {})
await spage.fill('input[type="email"]', STUDENT_EMAIL)
await spage.fill('input[type="password"]', ADMIN_PASSWORD)
await Promise.all([
  spage.waitForURL(/\/student/, { timeout: 15000 }).catch(() => {}),
  spage.click('button[type="submit"]'),
])
const sAfter = spage.url()
console.log(`STUDENT LOGIN -> ${sAfter}`)
if (sAfter.includes('/student')) {
  await checkRoutes(spage, STUDENT_ROUTES)
} else {
  console.log('STUDENT_LOGIN_FAILED')
  results.push({ label: 'Student login', path: '/student', verdict: 'PAGE_ERROR', selfHits: 0, pageErrors: ['student login failed'], consoleErrors: [] })
}

await browser.close()
const bad = results.filter((r) => r.verdict !== 'OK')
console.log(`\n=== SUMMARY: ${results.length - bad.length}/${results.length} OK ===`)
for (const b of bad) console.log(`  ${b.verdict}: ${b.label} — hits=${b.selfHits} ${b.pageErrors.join('; ')} ${b.consoleErrors.join('; ')}`)
process.exit(bad.length ? 2 : 0)
