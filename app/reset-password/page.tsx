import { ResetPasswordForm } from './ResetPasswordForm'

export default function ResetPasswordPage() {
  return (
    <>
      <header className="feu-header">
        <div className="feu-crest">FEU</div>
        <p className="feu-inst">Far Eastern University · Manila</p>
        <h1>Reset Password</h1>
      </header>
      <div style={{ maxWidth: 400, margin: '0 auto', padding: '24px 20px' }}>
        <ResetPasswordForm />
      </div>
    </>
  )
}
