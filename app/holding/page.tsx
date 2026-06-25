import { signOut } from '@/app/login/actions'

export default function HoldingPage() {
  return (
    <main style={{ maxWidth: 480, margin: '4rem auto', fontFamily: 'system-ui' }}>
      <h1>Your account is not active yet</h1>
      <p>
        Your account exists but is not active. An instructor or administrator needs to
        activate it before you can continue. Please check back later.
      </p>
      <form action={signOut}>
        <button type="submit">Sign out</button>
      </form>
    </main>
  )
}
