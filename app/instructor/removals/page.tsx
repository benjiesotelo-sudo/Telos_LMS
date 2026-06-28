import { redirect } from 'next/navigation'

// Removal requests now live under Admin Controls. Keep this route for bookmarks.
export default function RemovalsRedirect() {
  redirect('/instructor/admin?tab=removals')
}
