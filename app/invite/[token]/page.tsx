import { redirect } from 'next/navigation'
import { acceptInvite } from '@/app/actions/acceptInvite'

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  async function accept(formData: FormData): Promise<void> {
    'use server'
    const password = String(formData.get('password') ?? '')
    await acceptInvite({ token, password })
    redirect('/login')
  }

  return (
    <main style={{ maxWidth: 360, margin: '4rem auto', fontFamily: 'system-ui' }}>
      <h1>Accept your invitation</h1>
      <p>Set a password to activate your student account.</p>
      <form action={accept}>
        <label>
          Password
          <input name="password" type="password" required autoComplete="new-password" minLength={8} />
        </label>
        <button type="submit">Create account</button>
      </form>
    </main>
  )
}
