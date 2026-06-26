# Theme A — Identity, Profiles, Super-Admin & Account Management — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]` checkboxes.

**Goal:** Real name fields (prefix/first/MI/last/suffix → auto-generated full name) on profiles + registration; profile view/edit; password change + recovery pages; a super-admin (`admin`) account-management module (CRUD users + reset passwords); and load the real data for Benjie (super-admin) + Mamoun. Plus the quick shell renames (Enrollment; Course Builder).

**Architecture:** Add name-part columns to `profiles`; `full_name` becomes **derived** (composed app-side from the parts, never hand-entered). Registration + profile-edit collect the parts and write the derived `full_name`. Password change uses `supabase.auth.updateUser`; the reset page consumes the Supabase recovery session. Account management is admin-only server actions over the service-role client (respecting the privilege-escalation guard). Server actions call `refresh()` from `next/cache` after mutations (the vendored pattern from Theme N).

**Tech stack:** Next.js (VENDORED — read `node_modules/next/dist/docs/` before framework APIs), Supabase, TypeScript, Vitest against LOCAL stack.

## Global Constraints
- **Privilege-escalation guard stays intact:** never re-grant table UPDATE on `profiles.role`/`status`. The migration may grant UPDATE only on the NEW name columns (safe) to `authenticated`. Role/status changes go ONLY through admin (service-role) actions.
- Vendored Next: read the docs before routing/auth APIs; mutations call `refresh()` from `next/cache` in the server action (the `vitest.setup.ts` mock already stubs it).
- Action tests authenticate via `setTestUser(email, PW)`; fixtures `createUser`, `seedCourse`, `seedClass`.
- Full name format: `First M.I. Last, Suffix` (skip empty parts; no leading/trailing spaces or stray comma).
- Suffix dropdown: (none)/Jr./Sr./II/III/IV/Other(type). Prefix dropdown: (none)/Mr./Ms./Mrs./Dr./Engr./Atty./Other(type).
- Registration fields show an example + proper-capitalization hint each; student number required.
- FEU theme classes; keep suite green + build passing each task.

## File map
- Migration: `supabase/migrations/0006_profile_name_fields.sql`
- Lib: `lib/types.ts` (extend), `lib/name.ts` (NEW — `composeFullName(parts)`)
- Actions: `app/actions/updateProfile.ts`, `app/actions/updatePassword.ts`, `app/actions/requestPasswordReset.ts`, `app/actions/admin/listUsers.ts`, `app/actions/admin/adminUpsertUser.ts`, `app/actions/admin/adminDeleteUser.ts`, `app/actions/admin/adminResetPassword.ts`; modify `app/actions/registerViaLink.ts`
- UI: `app/instructor/profile/page.tsx` + `ProfileForm.tsx`, `app/student/profile/page.tsx` (reuse form), `app/account/password/page.tsx` (change), `app/reset-password/page.tsx` (recovery), `app/instructor/users/page.tsx` + `UsersPanel.tsx` (admin), `app/register/[token]/RegisterForm.tsx` (name parts), login "Forgot password?" link. Sidebar: rename Enrollment, add Course Builder + Users (admin-only).
- Data: `supabase/seed.sql` (Benjie super-admin + name parts; idempotent) + a documented one-time cloud step for Mamoun's parts.
- Tests: `tests/name.test.ts`, `tests/profile.test.ts`, `tests/admin-users.test.ts`, extend `tests/register.test.ts`.

---

## Task A1: `composeFullName` helper + migration (name fields)

**Files:** Create `lib/name.ts`, `supabase/migrations/0006_profile_name_fields.sql`, `tests/name.test.ts`; extend `tests/schema.test.ts`.

**Interfaces:** `composeFullName({prefix?, firstName, middleInitial?, lastName, suffix?}) → string` (format `First M.I. Last, Suffix`, prefix prepended if present, empty parts skipped, trimmed, no stray comma when no suffix).

- [ ] **Step 1 — failing test** `tests/name.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { composeFullName } from '@/lib/name'
describe('composeFullName', () => {
  it('composes first MI last', () => {
    expect(composeFullName({ firstName: 'Benjamin', middleInitial: 'C.', lastName: 'Sotelo' })).toBe('Benjamin C. Sotelo')
  })
  it('includes suffix with a comma', () => {
    expect(composeFullName({ firstName: 'John', lastName: 'Doe', suffix: 'Jr.' })).toBe('John Doe, Jr.')
  })
  it('includes prefix when present', () => {
    expect(composeFullName({ prefix: 'Dr.', firstName: 'Jane', lastName: 'Roe' })).toBe('Dr. Jane Roe')
  })
  it('skips empty middle/suffix cleanly', () => {
    expect(composeFullName({ firstName: 'Mamoun', middleInitial: 'F R', lastName: 'Bani' })).toBe('Mamoun F R Bani')
  })
})
```
- [ ] **Step 2 — run → FAIL.**
- [ ] **Step 3 — implement `lib/name.ts`:**
```ts
export interface NameParts {
  prefix?: string; firstName: string; middleInitial?: string; lastName: string; suffix?: string
}
export function composeFullName(p: NameParts): string {
  const core = [p.prefix, p.firstName, p.middleInitial, p.lastName]
    .map((s) => (s ?? '').trim()).filter(Boolean).join(' ')
  const suffix = (p.suffix ?? '').trim()
  return suffix ? `${core}, ${suffix}` : core
}
```
- [ ] **Step 4 — migration** `0006_profile_name_fields.sql`:
```sql
-- 0006_profile_name_fields.sql — structured name parts; full_name becomes app-derived.
alter table profiles add column prefix text not null default '';
alter table profiles add column first_name text not null default '';
alter table profiles add column middle_initial text not null default '';
alter table profiles add column last_name text not null default '';
alter table profiles add column suffix text not null default '';
-- Let users self-edit their own name parts (safe columns; NOT role/status).
grant update (prefix, first_name, middle_initial, last_name, suffix) on public.profiles to authenticated;
```
Add schema-test assertions that the 5 columns exist.
- [ ] **Step 5 — `supabase db reset`; run tests → PASS.**
- [ ] **Step 6 — commit** `feat(db): profile name-part columns + composeFullName helper`

---

## Task A2: `registerViaLink` + RegisterForm collect name parts

**Files:** Modify `app/actions/registerViaLink.ts`, `app/register/[token]/RegisterForm.tsx`; extend `tests/register.test.ts`.

**Interfaces:** `registerViaLink` input gains `prefix?, firstName, middleInitial?, lastName, suffix?` (replaces the single `fullName`); it composes `full_name` via `composeFullName` and stores parts + full_name + student_number in user_metadata; role forced `student`, status `pending` (unchanged). Student number stays REQUIRED.

- [ ] **Step 1 — update register tests** to pass name parts instead of `fullName`, asserting the stored `full_name` is the composed value and the parts persist. Run → FAIL.
- [ ] **Step 2 — implement:** in `registerViaLink`, accept the parts, `const fullName = composeFullName({...})`, and put `prefix, first_name, middle_initial, last_name, suffix, full_name, student_number` in `user_metadata` (the `handle_new_user` trigger must copy them — see note). Keep role/status/dup-guard logic.
- [ ] **Step 2b — update `handle_new_user` trigger** (new migration `0007_handle_new_user_names.sql`) to also copy the name parts from `raw_user_meta_data` into the profile row. Re-`supabase db reset`.
- [ ] **Step 3 — RegisterForm:** replace the single Full Name input with Prefix (select+Other), First Name, Middle Initial, Last Name, Suffix (select+Other) + keep Student Number (required) and Email/Password. Each field: a `placeholder` example + a small hint about proper capitalization (e.g. "Proper case, e.g. Benjamin"). Disable submit until first/last/email/password/student# present.
- [ ] **Step 4 — run tests + build → green; commit** `feat(register): structured name fields + auto full name`

---

## Task A3: Profile view/edit (both roles)

**Files:** Create `app/instructor/ProfileForm.tsx` (shared client form), rewrite `app/instructor/profile/page.tsx` + `app/student/profile/page.tsx`; create `app/actions/updateProfile.ts`; `tests/profile.test.ts`.

**Interfaces:** `updateProfile({prefix?, firstName, middleInitial?, lastName, suffix?, studentNumber?}) → {ok}` updates the caller's own profile parts + recomposed `full_name` (admin client or the authenticated grant; never role/status). Returns ok; calls `refresh()`.

- [ ] **Step 1 — test:** a signed-in user updates their parts; assert profile parts + composed `full_name` persist; role/status unchanged. Run → FAIL.
- [ ] **Step 2 — implement `updateProfile`** (compose full_name, write parts+full_name+student_number; `refresh()`).
- [ ] **Step 3 — `ProfileForm`** (client): editable parts + student number; shows the live composed full name (read-only); Save → updateProfile. Reuse on both profile pages (pass current values).
- [ ] **Step 4 — green + build; commit** `feat(profile): structured name view/edit with derived full name`

---

## Task A4: Password change page + recovery (reset) page + Forgot link

**Files:** Create `app/account/password/page.tsx` + `ChangePasswordForm.tsx`, `app/reset-password/page.tsx` + `ResetPasswordForm.tsx`, `app/actions/updatePassword.ts`, `app/actions/requestPasswordReset.ts`; add a "Forgot password?" control on `app/login/page.tsx`. Update `gateRoute` PUBLIC_PREFIXES to include `/reset-password`.

**Interfaces:** `updatePassword({newPassword})` calls `supabase.auth.updateUser({password})` for the signed-in (or recovery-session) user. `requestPasswordReset({email})` calls `supabase.auth.resetPasswordForEmail(email, {redirectTo: <SITE_URL>/reset-password})`.

- [ ] **Step 1 — `updatePassword` action** + a test that a signed-in user can change their password (sign in with old, change, sign in with new). Run RED→GREEN.
- [ ] **Step 2 — ChangePasswordForm** at `/account/password` (logged-in): new password + confirm → updatePassword → success.
- [ ] **Step 3 — ResetPasswordForm** at `/reset-password`: a CLIENT page — on mount, the Supabase browser client picks up the recovery token from the URL (`detectSessionInUrl`); the form lets the user set a new password via `updateUser`. Read the vendored Supabase/Next docs for the recovery-session handling. Add `/reset-password` to `gateRoute` PUBLIC_PREFIXES.
- [ ] **Step 4 — Forgot link** on `/login` → calls `requestPasswordReset` with the entered email; show "check your email."
- [ ] **Step 5 — green + build; commit** `feat(auth): change-password + recovery reset pages + forgot link`

---

## Task A5: Super-admin account-management module

**Files:** Create `app/actions/admin/listUsers.ts`, `adminUpsertUser.ts`, `adminDeleteUser.ts`, `adminResetPassword.ts`; `app/instructor/users/page.tsx` + `UsersPanel.tsx`; add a **Users** sidebar item shown only to admins; `tests/admin-users.test.ts`.

**Interfaces (all require caller role `admin`, else throw; service-role ops):**
- `listUsers() → AdminUserRow[]` (id, full_name, email, role, status, student_number).
- `adminUpsertUser({id?, email, role, status, prefix?, firstName, middleInitial?, lastName, suffix?, studentNumber?, password?}) → {id}` — create (no id) or edit; composes full_name; create uses `admin.auth.admin.createUser`.
- `adminDeleteUser({id}) → {ok}` (refuse to delete self).
- `adminResetPassword({id, newPassword}) → {ok}` (`admin.auth.admin.updateUserById`).

- [ ] **Step 1 — tests:** admin can list/create/edit/reset/delete; a NON-admin (instructor) calling any of these is rejected (`rejects.toThrow`). Run RED.
- [ ] **Step 2 — implement the four actions** with an `assertAdmin()` guard (read caller role via authenticated client; service-role for the ops). `refresh()` after mutations.
- [ ] **Step 3 — UsersPanel + page:** admin-only table of users with Create / Edit / Reset password / Delete; wire the actions. Page guards: if caller isn't admin, render "Forbidden".
- [ ] **Step 4 — sidebar:** show **Users** item only when the layout's profile role is `admin`.
- [ ] **Step 5 — green + build; commit** `feat(admin): super-admin account management (CRUD users + reset password)`

---

## Task A6: Shell renames (Enrollment; Course Builder)

**Files:** `app/instructor/layout.tsx` (sidebar ITEMS), move `app/instructor/roster/` → `app/instructor/enrollment/`; create `app/instructor/builder/page.tsx` (CoursePanel + ClassPanel moved here) and trim `app/instructor/classes/page.tsx` to a list only (creation removed; click-through prepared for Theme C class detail).

- [ ] **Step 1 — rename route** roster→enrollment (move folder, update sidebar label "Roster & Links"→"Enrollment", href `/instructor/enrollment`).
- [ ] **Step 2 — Course Builder:** new `/instructor/builder` with `<CoursePanel/>` + `<ClassPanel/>`; add sidebar item "Course Builder". Remove the creation panels from `/instructor/classes`, leaving the existing-classes list (each row a link to `/instructor/classes/[id]` — the detail page itself is Theme C).
- [ ] **Step 3 — build + suite green; commit** `feat(shell): rename Enrollment; split Course Builder from Classes`

---

## Task A7: Load real data (Benjie super-admin + Mamoun) — seed + cloud step

**Files:** `supabase/seed.sql` (extend, idempotent); a documented one-time cloud SQL snippet (NOT committed with PII beyond what seed already implies).

- [ ] **Step 1 — seed.sql:** after the instructor bootstrap, set Benjie's profile: `role='admin'`, `prefix=''`, `first_name='Benjamin'`, `middle_initial='C.'`, `last_name='Sotelo'`, `suffix=''`, `student_number='202601011'`, and `full_name='Benjamin C. Sotelo'` — idempotent, looked up by email. (Mamoun is not bootstrapped in seed; handle via the cloud step.)
- [ ] **Step 2 — document the cloud one-time step** in CONTINUE.md: a SQL-Editor `update profiles set first_name='Mamoun', middle_initial='F R', last_name='Bani', student_number='2024046681', full_name='Mamoun F R Bani' where email='<mamoun email>'`, and the same for Benjie if seed wasn't run on cloud. Note these run AFTER `supabase db push` of 0006/0007.
- [ ] **Step 3 — `supabase db reset` locally; confirm seed applies; commit** `feat(seed): Benjie super-admin + structured name; document Mamoun cloud update`

---

## Final verification (Theme A milestone)
- [ ] `supabase db reset && npm test` — full suite green.
- [ ] `npm run build` — passes; new routes compile.
- [ ] Manual: register a student with the new fields; edit a profile; change a password; (admin) open Users and create/edit/reset/delete; Forgot-password → recovery → set new password.
- [ ] Report to the user (milestone) before starting Theme C.
