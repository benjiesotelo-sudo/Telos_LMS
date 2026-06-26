import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { listClasses } from '@/app/actions/listClasses'
import { listPending } from '@/app/actions/listPending'
import { listEnrollLinks } from '@/app/actions/listEnrollLinks'
import { EnrollLinksPanel } from '@/app/instructor/EnrollLinksPanel'
import { PendingPanel } from '@/app/instructor/PendingPanel'

export default async function EnrollmentPage() {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) redirect('/login')

  const [classes, pending, links] = await Promise.all([listClasses(), listPending(), listEnrollLinks()])

  return (
    <div className="feu-page">
      <h1>Enrollment</h1>
      <p className="feu-page-sub">Generate enrollment links and manage pending registrations.</p>

      <EnrollLinksPanel
        classes={classes.map((c) => ({ id: c.id, displayName: c.displayName }))}
        links={links}
      />
      <PendingPanel rows={pending} />
    </div>
  )
}
