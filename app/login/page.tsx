import { signIn } from './actions'
import { ForgotPasswordForm } from './ForgotPasswordForm'
import { RequestResetPanel } from './RequestResetPanel'
import { PasswordInput } from '@/app/components/PasswordInput'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  return (
    <>
      <header className="feu-header">
        <div className="feu-crest">FEU</div>
        <p className="feu-inst">Far Eastern University · Manila</p>
        <h1>Sign In</h1>
      </header>
      <div style={{ maxWidth: 400, margin: '0 auto', padding: '24px 20px' }}>
        <div className="feu-card">
          <form action={signIn}>
            <div style={{ marginBottom: 16 }}>
              <label className="feu-label" htmlFor="email">Email</label>
              <input
                id="email"
                className="feu-input"
                name="email"
                type="email"
                required
                autoComplete="email"
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label className="feu-label" htmlFor="password">Password</label>
              <PasswordInput
                id="password"
                name="password"
                required
                autoComplete="current-password"
              />
            </div>
            <button
              type="submit"
              className="feu-btn-gold"
              style={{ width: '100%', marginTop: 16 }}
            >
              Sign in
            </button>
            {error ? <p className="feu-error">Invalid email or password.</p> : null}
          </form>
        </div>
        {/* Primary, email-free recovery: student chooses a new password, instructor approves.
            Auto-opens after a failed sign-in. */}
        <RequestResetPanel defaultOpen={!!error} />
        {/* Secondary: email-based reset (kept for instructors/admins). */}
        <ForgotPasswordForm />
      </div>
    </>
  )
}
