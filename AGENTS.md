<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# UX conventions (project rule)

**No frozen-looking screens.** Every interaction that does async work must show immediate feedback — never let the UI look stuck while it loads:
- **Page/route navigation:** every data-fetching route segment under `app/instructor/` and `app/student/` has a `loading.tsx` (Suspense fallback) so transitions show a loading state instantly.
- **Buttons / actions:** disable the control and show a pending label (e.g. "Saving…") while a server action runs; re-enable on completion. Surface errors; never leave a click with no visible result.
- **Lists after mutation:** rely on the server action's `refresh()` (from `next/cache`) so data updates without a manual reload (already the pattern here).
Treat this as a default for all new UI in this project.
