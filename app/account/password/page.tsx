import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ChangePasswordForm } from './ChangePasswordForm'

export default async function ChangePasswordPage() {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) redirect('/login')

  return (
    <div className="feu-page">
      <h1>Change Password</h1>
      <p className="feu-page-sub">Update your account password.</p>
      <ChangePasswordForm />
    </div>
  )
}
