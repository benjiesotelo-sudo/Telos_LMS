# Theme N — App Shell, Navigation & Page Structure — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]` checkboxes.

**Goal:** Split the single cramped instructor page into routed pages behind a left-sidebar shell (same for the student side), add an enroll-link **management** view (list active links, reuse/revoke, countdown), and make lists update without a manual refresh.

**Architecture:** Next.js App Router nested layouts. `app/instructor/layout.tsx` + `app/student/layout.tsx` each render a left sidebar (a client `Sidebar` component using `usePathname` for active state) around `{children}`. The current `app/instructor/page.tsx` mega-page is broken apart: each panel moves to its own route and fetches its own data. Two new server actions (`listEnrollLinks`, `revokeEnrollLink`) back the link-management view; client panels call `router.refresh()` after mutations.

**Tech stack:** Next.js (VENDORED — read `node_modules/next/dist/docs/` before using any framework API: nested layouts, `usePathname`, `useRouter().refresh()`, route segments). Supabase, TypeScript, Vitest against the LOCAL stack.

## Global Constraints
- **This is NOT stock Next.js** — read the vendored docs in `node_modules/next/dist/docs/` before writing routing/layout/navigation code. Heed deprecations.
- Reuse the existing FEU theme classes (`feu-card`, `feu-input`, `feu-label`, `feu-btn-green/gold/outline`, `feu-error`, `feu-muted`, `feu-header`, `feu-crest`, `feu-inst`). New shell CSS goes in `app/globals.css` as new `.feu-shell*` / `.feu-nav*` classes — do not restyle existing classes.
- `signOut` already exists in `app/login/actions.ts` — reuse it, do not create a new one.
- Routing is gated by `lib/auth/gateRoute.ts` (already covers `/instructor/*` and `/student/*` via prefix) — do NOT change gate semantics.
- Server actions read auth via `globalThis.__TELOS_TEST_USER__` under VITEST → action tests authenticate with `setTestUser(email, PW)` (NOT signInAs). Fixtures: `createUser`, `seedCourse`, `seedClass`, `seedEnrollment`.
- Keep the full suite green and `npm run build` passing at every task.
- `createClient()` is async — always `await`.
- Answer-key secrecy + tenant isolation + privilege-escalation guard remain intact (unchanged by this theme).

---

## File map
- Create: `app/instructor/layout.tsx`, `app/student/layout.tsx`, `app/components/Sidebar.tsx` (shared client nav)
- Create routes: `app/instructor/classes/page.tsx`, `app/instructor/roster/page.tsx`, `app/instructor/assessments/page.tsx`, `app/instructor/grades/page.tsx`, `app/instructor/profile/page.tsx`; `app/student/classes/page.tsx`, `app/student/profile/page.tsx`
- Rewrite: `app/instructor/page.tsx` (becomes the Dashboard landing), `app/instructor/EnrollLinksPanel.tsx` → link-management view
- Create actions: `app/actions/listEnrollLinks.ts`, `app/actions/revokeEnrollLink.ts`
- Modify (no-refresh): `app/instructor/CoursePanel.tsx`, `app/instructor/ClassPanel.tsx`, `app/instructor/PendingPanel.tsx`
- CSS: `app/globals.css` (append shell/nav classes)
- Tests: `tests/enroll-links.test.ts` (extend), and a new `tests/shell.test.ts` if useful

---

## Task 1: Enroll-link management actions (`listEnrollLinks` + `revokeEnrollLink`)

**Files:** Create `app/actions/listEnrollLinks.ts`, `app/actions/revokeEnrollLink.ts`; extend `tests/enroll-links.test.ts`.

**Interfaces:**
- `listEnrollLinks() → EnrollLinkRow[]` where `EnrollLinkRow = {id, token, url, kind, classId: string|null, className: string|null, expiresAt, createdAt}` — only ACTIVE links (revoked_at IS NULL AND expires_at > now) owned by the caller (admin: all).
- `revokeEnrollLink({id}) → {ok:true}` — sets `revoked_at = now()`; caller must own the link (or admin).

- [ ] **Step 1: Failing tests** — append to `tests/enroll-links.test.ts`:
```ts
import { listEnrollLinks } from '@/app/actions/listEnrollLinks'
import { revokeEnrollLink } from '@/app/actions/revokeEnrollLink'

describe('listEnrollLinks + revokeEnrollLink', () => {
  it('lists active links for the caller and excludes revoked ones', async () => {
    const instr = await createUser({ role: 'instructor', email: `${tag}-mgr@x.com`, password: PW, fullName: 'M' })
    const courseId = (await seedCourse({ instructorId: instr.id, code: `${tag}-MG`, title: 'C' })).id
    const classId = (await seedClass({ instructorId: instr.id, courseId, period: 'Midyear' })).id
    await setTestUser(instr.email, PW)
    const a = await generateEnrollLink({ kind: 'class', classId })
    const b = await generateEnrollLink({ kind: 'general' })
    let rows = await listEnrollLinks()
    expect(rows.length).toBe(2)
    const classRow = rows.find((r) => r.kind === 'class')
    expect(classRow?.className).toBeTruthy()
    // revoke one
    await revokeEnrollLink({ id: rows[0].id })
    rows = await listEnrollLinks()
    expect(rows.length).toBe(1)
  })

  it('forbids revoking another instructor\'s link', async () => {
    const owner = await createUser({ role: 'instructor', email: `${tag}-own2@x.com`, password: PW, fullName: 'O' })
    await setTestUser(owner.email, PW)
    const link = await generateEnrollLink({ kind: 'general' })
    const rows = await listEnrollLinks()
    const other = await createUser({ role: 'instructor', email: `${tag}-oth2@x.com`, password: PW, fullName: 'T' })
    await setTestUser(other.email, PW)
    await expect(revokeEnrollLink({ id: rows[0].id })).rejects.toThrow()
  })
})
```

- [ ] **Step 2: Run → FAIL** (`npm test -- enroll-links`).

- [ ] **Step 3: Implement `listEnrollLinks.ts`** (admin-client read, auth-guarded; build url from token):
```ts
'use server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { EnrollLinkRow } from '@/lib/types'

export async function listEnrollLinks(): Promise<EnrollLinkRow[]> {
  const supabase = await createClient()
  const { data: auth, error } = await supabase.auth.getUser()
  if (error || !auth.user) throw new Error('Not authenticated')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', auth.user.id).single()
  const isAdmin = profile?.role === 'admin'
  if (!profile || (profile.role !== 'instructor' && !isAdmin)) throw new Error('Forbidden')

  const admin = createAdminClient()
  let q = admin.from('enroll_links')
    .select('id, token, kind, class_id, expires_at, created_at, classes:class_id(section_label, courses:course_id(code))')
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
  if (!isAdmin) q = q.eq('instructor_id', auth.user.id)
  const { data, error: qErr } = await q
  if (qErr) throw new Error(qErr.message)
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  return (data ?? []).map((r: any) => ({
    id: r.id,
    token: r.token,
    url: `${base}/register/${r.token}`,
    kind: r.kind,
    classId: r.class_id,
    className: r.classes ? `${r.classes.courses?.code ?? ''} - ${r.classes.section_label}` : null,
    expiresAt: r.expires_at,
    createdAt: r.created_at,
  }))
}
```
Add to `lib/types.ts`:
```ts
export interface EnrollLinkRow {
  id: string; token: string; url: string
  kind: 'class' | 'general'
  classId: string | null; className: string | null
  expiresAt: string; createdAt: string
}
```

- [ ] **Step 4: Implement `revokeEnrollLink.ts`**:
```ts
'use server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function revokeEnrollLink(input: { id: string }): Promise<{ ok: true }> {
  const supabase = await createClient()
  const { data: auth, error } = await supabase.auth.getUser()
  if (error || !auth.user) throw new Error('Not authenticated')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', auth.user.id).single()
  const isAdmin = profile?.role === 'admin'
  if (!profile || (profile.role !== 'instructor' && !isAdmin)) throw new Error('Forbidden')

  const admin = createAdminClient()
  const { data: link } = await admin.from('enroll_links').select('id, instructor_id').eq('id', input.id).single()
  if (!link) throw new Error('Link not found')
  if (!isAdmin && link.instructor_id !== auth.user.id) throw new Error('Not the link owner')
  const { error: upErr } = await admin.from('enroll_links').update({ revoked_at: new Date().toISOString() }).eq('id', input.id)
  if (upErr) throw new Error(upErr.message)
  return { ok: true }
}
```

- [ ] **Step 5: Run → PASS** (`npm test -- enroll-links`).
- [ ] **Step 6: Commit** `feat(actions): listEnrollLinks + revokeEnrollLink (active-link management)`

---

## Task 2: Shell CSS + shared Sidebar + instructor layout

**Files:** Append to `app/globals.css`; create `app/components/Sidebar.tsx`, `app/instructor/layout.tsx`.

**Interfaces:**
- `Sidebar({ title, items, user })` client component: `items: {href, label}[]`; highlights the active item via `usePathname()`; renders a logout button wired to the existing `signOut` server action (via a `<form action={signOut}>`).

- [ ] **Step 1: Append shell CSS to `app/globals.css`** (new classes only — do not touch existing):
```css
/* ── App shell ── */
.feu-shell { display: flex; min-height: 100vh; }
.feu-sidebar { width: 232px; flex-shrink: 0; background: var(--green); color: #fff;
  display: flex; flex-direction: column; padding: 18px 0; border-right: 4px solid var(--gold); }
.feu-sidebar-brand { font-family: var(--font-marcellus-sc, serif); font-size: 18px; text-align: center;
  padding: 6px 16px 16px; border-bottom: 1px solid rgba(255,255,255,.18); margin-bottom: 10px; }
.feu-nav { display: flex; flex-direction: column; gap: 2px; padding: 0 10px; }
.feu-nav-link { padding: 10px 14px; border-radius: 8px; color: #eaf3ee; font-size: 14px; font-weight: 600; }
.feu-nav-link:hover { background: rgba(255,255,255,.10); }
.feu-nav-link.active { background: var(--gold); color: var(--ink); }
.feu-sidebar-foot { margin-top: auto; padding: 12px 16px; }
.feu-main { flex: 1; min-width: 0; }
.feu-page { max-width: 880px; margin: 0 auto; padding: 28px 24px; }
.feu-page h1 { font-family: var(--font-marcellus-sc, serif); color: var(--green); font-size: 22px; margin-bottom: 4px; }
.feu-page-sub { color: var(--gray); font-size: 13px; margin-bottom: 20px; }
@media (max-width: 720px) { .feu-shell { flex-direction: column; } .feu-sidebar { width: 100%; flex-direction: row;
  border-right: none; border-bottom: 4px solid var(--gold); overflow-x: auto; } .feu-nav { flex-direction: row; } .feu-sidebar-foot { margin: 0; } }
```

- [ ] **Step 2: Create `app/components/Sidebar.tsx`** (client):
```tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from '@/app/login/actions'

export function Sidebar({ title, items, userLabel }: {
  title: string; items: { href: string; label: string }[]; userLabel?: string
}) {
  const pathname = usePathname()
  const isActive = (href: string) =>
    href === pathname || (href !== '/instructor' && href !== '/student' && pathname.startsWith(href))
  return (
    <aside className="feu-sidebar">
      <div className="feu-sidebar-brand">{title}</div>
      <nav className="feu-nav">
        {items.map((it) => (
          <Link key={it.href} href={it.href} className={`feu-nav-link${isActive(it.href) ? ' active' : ''}`}>
            {it.label}
          </Link>
        ))}
      </nav>
      <div className="feu-sidebar-foot">
        {userLabel && <p style={{ fontSize: 12, color: '#d6ebdd', marginBottom: 8 }}>{userLabel}</p>}
        <form action={signOut}>
          <button type="submit" className="feu-btn-outline" style={{ width: '100%', background: 'transparent', color: '#fff', borderColor: 'rgba(255,255,255,.5)' }}>
            Log out
          </button>
        </form>
      </div>
    </aside>
  )
}
```
(Confirm `next/link` + `usePathname` import paths against the vendored docs before finalizing.)

- [ ] **Step 3: Create `app/instructor/layout.tsx`** (server; reads the user for the label):
```tsx
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/app/components/Sidebar'

const ITEMS = [
  { href: '/instructor', label: 'Dashboard' },
  { href: '/instructor/classes', label: 'Classes' },
  { href: '/instructor/roster', label: 'Roster & Links' },
  { href: '/instructor/assessments', label: 'Assessments' },
  { href: '/instructor/grades', label: 'Grades' },
  { href: '/instructor/profile', label: 'Profile' },
]

export default async function InstructorLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  let label: string | undefined
  if (auth.user) {
    const { data: p } = await supabase.from('profiles').select('full_name, email').eq('id', auth.user.id).maybeSingle()
    label = p?.full_name || p?.email || undefined
  }
  return (
    <div className="feu-shell">
      <Sidebar title="Telos · Instructor" items={ITEMS} userLabel={label} />
      <main className="feu-main">{children}</main>
    </div>
  )
}
```

- [ ] **Step 4:** `npm run build` → passes. Commit `feat(shell): instructor sidebar layout + nav + shell CSS`

---

## Task 3: Split the instructor mega-page into routed pages

**Files:** Rewrite `app/instructor/page.tsx`; create `classes/`, `roster/`, `assessments/`, `grades/`, `profile/` pages. Move each panel + its data fetch out of the old page.

Current `app/instructor/page.tsx` fetches `classes` (listClasses), `courses`, `pics` (listPics), submissions→rows and renders ImportPanel, CoursePanel, ClassPanel, EnrollLinksPanel, PendingPanel, AssignPanel, SubmissionsPanel. Distribute as:

- [ ] **`app/instructor/page.tsx` (Dashboard):** a landing wrapped in `<div className="feu-page">` — `<h1>Dashboard</h1>`, a short welcome, and quick-glance counts (e.g. number of classes via `listClasses()`, number pending via `listPending()`), with links to the sections. No panels.
- [ ] **`app/instructor/classes/page.tsx`:** fetch `courses` (`id, code`) + `pics` (`listPics()`) + `listClasses()`; render `<CoursePanel/>`, `<ClassPanel courses pics/>`, and a card listing existing classes (displayName · period · PIC).
- [ ] **`app/instructor/roster/page.tsx`:** render the new link-management `<EnrollLinksPanel/>` (Task 4) fed by `listEnrollLinks()` + `listClasses()`, and `<PendingPanel rows={await listPending()}/>`.
- [ ] **`app/instructor/assessments/page.tsx`:** render `<ImportPanel/>` + `<AssignPanel classes={(await listClasses()).map(c=>({id:c.id,displayName:c.displayName}))}/>`.
- [ ] **`app/instructor/grades/page.tsx`:** build the submissions `rows` (move that query here) and render `<SubmissionsPanel rows/>`.
- [ ] **`app/instructor/profile/page.tsx`:** show the caller's `full_name`, `email`, `role`, `student_number` in a `feu-card`; include a logout `<form action={signOut}>` (Theme A fills this out further).

Each page is its own `feu-page` wrapper with an `<h1>` + `feu-page-sub`. Keep all imports valid; the old single-page render block is replaced by the Dashboard.

- [ ] **Verify:** `npm run build` passes; click through every nav item in `npm run dev` (each renders, no crash). `npm test` still green. Commit `feat(instructor): split mega-page into routed pages`

---

## Task 4: Enroll-link management view (reuse + revoke + countdown)

**Files:** Rewrite `app/instructor/EnrollLinksPanel.tsx`.

**Interfaces:** `EnrollLinksPanel({ classes, links })` where `classes: {id, displayName}[]` and `links: EnrollLinkRow[]` (from `listEnrollLinks()`), rendered by the roster page.

- [ ] **Step 1: Rewrite the panel** to:
  - Show a **list of active links** (`links` prop): each row shows kind + className (or "General"), the URL (read-only, copyable), a **live countdown** of remaining validity (reuse the `remaining()` formatter: `d h m` / `h m` / `m s`), and a **Revoke** button → `revokeEnrollLink({id})` then `router.refresh()`.
  - A **Generate** control: pick kind (class/general) + class; on click call `generateEnrollLink(...)` then `router.refresh()` so the new link appears in the list. If an active link already exists for that exact class+kind, show a hint ("an active link already exists below — reuse it") instead of duplicating — but still allow generating a fresh one if they choose.
  - Use `useRouter` from the vendored Next (`next/navigation`) — confirm against the docs. The countdown still uses a `setInterval` in `useEffect` with cleanup.
- [ ] **Verify:** `npm run build` passes; manual: generate a link → it appears in the list with a ticking countdown; revoke → it disappears after refresh. `npm test` green. Commit `feat(roster): active enroll-link management — list, reuse, revoke, countdown`

---

## Task 5: No-refresh after mutations

**Files:** Modify `app/instructor/CoursePanel.tsx`, `app/instructor/ClassPanel.tsx`, `app/instructor/PendingPanel.tsx`.

- [ ] In each, import `useRouter` from `next/navigation`, get `const router = useRouter()`, and after a successful action call add `router.refresh()` so the server-rendered lists (existing classes, pending list, etc.) update without a manual reload. Keep the success message behavior.
- [ ] **Verify:** `npm run build` passes; manual: create a class → it appears in the Classes list without reloading; approve a pending student → row clears without reload. `npm test` green. Commit `feat(instructor): refresh server data after create/approve (no manual reload)`

---

## Task 6: Student shell

**Files:** Create `app/student/layout.tsx`, `app/student/classes/page.tsx`, `app/student/profile/page.tsx`. Keep `app/student/page.tsx` (Dashboard) working — wrap its content in `feu-page`.

- [ ] **`app/student/layout.tsx`:** mirror the instructor layout with `Sidebar title="Telos · Student"` and items `[{/student, Dashboard}, {/student/classes, My Classes}, {/student/profile, Profile}]`.
- [ ] **`app/student/classes/page.tsx`:** list the student's enrolled classes (join `enrollments → classes → courses`, show `code - section_label`, period). Basic card list.
- [ ] **`app/student/profile/page.tsx`:** profile card + logout (like instructor profile).
- [ ] Wrap the existing `app/student/page.tsx` body in `<div className="feu-page"><h1>Dashboard</h1>…</div>` so it sits correctly inside the new shell (it currently renders its own `feu-header`/`feu-wrap` — replace those with the page wrapper since the shell now provides chrome).
- [ ] **Verify:** `npm run build` passes; log in as a student → sidebar shows, all three pages render, take-flow still reachable. `npm test` green. Commit `feat(student): student sidebar shell + classes/profile pages`

---

## Final verification (shell checkpoint deliverable)
- [ ] `npm test` — full suite green.
- [ ] `npm run build` — passes; all new routes compile.
- [ ] Manual click-through (instructor + student): every nav item renders, logout works, link management lists/revokes, create/approve update without reload.
- [ ] Leave A/C/D/E features unbuilt — this theme delivers the FRAME only.
