import { redirect } from 'next/navigation'

// User management now lives under Admin Controls. Keep this route working for
// bookmarks by redirecting to the hub's Users tab.
export default function UsersRedirect() {
  redirect('/instructor/admin?tab=users')
}
