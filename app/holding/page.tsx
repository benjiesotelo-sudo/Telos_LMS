import { signOut } from '@/app/login/actions'

export default function HoldingPage() {
  return (
    <>
      <header className="feu-header">
        <div className="feu-crest">T</div>
        <p className="feu-inst">Far Eastern University · Manila</p>
        <h1>Account Pending</h1>
      </header>
      <div className="feu-wrap">
        <div className="feu-card" style={{ maxWidth: 520, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 18, marginBottom: 10 }}>Your account is not active yet</h2>
          <p style={{ color: 'var(--gray)', marginBottom: 20, fontSize: 15 }}>
            Your account exists but is not active. An instructor or administrator needs to
            activate it before you can continue. Please check back later.
          </p>
          <form action={signOut}>
            <button type="submit" className="feu-btn-outline">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </>
  )
}
