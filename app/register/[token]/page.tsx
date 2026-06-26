import { createAdminClient } from '@/lib/supabase/server'
import { RegisterForm } from './RegisterForm'

export default async function RegisterPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const admin = createAdminClient()
  const { data: link } = await admin
    .from('enroll_links')
    .select('token, kind, class_id, expires_at, revoked_at')
    .eq('token', token).single()

  const invalid = !link || link.revoked_at || new Date(link!.expires_at).getTime() <= Date.now()
  let sections: { id: string; displayName: string }[] = []
  if (link && link.kind === 'general' && !invalid) {
    const { data } = await admin.from('classes').select('id, section_label, course:course_id(code)')
    sections = (data ?? []).map((c: any) => ({ id: c.id, displayName: `${c.course?.code ?? ''} - ${c.section_label}` }))
  }

  return (
    <>
      <header className="feu-header">
        <div className="feu-crest">T</div>
        <p className="feu-inst">Far Eastern University · Manila</p>
        <h1>Student Registration</h1>
      </header>
      <div className="feu-wrap">
        {invalid
          ? <div className="feu-card"><p className="feu-error">This registration link is invalid or has expired.</p></div>
          : <RegisterForm token={token} kind={link!.kind} sections={sections} />}
      </div>
    </>
  )
}
