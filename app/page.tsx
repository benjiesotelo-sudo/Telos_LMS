import Link from 'next/link'

export default function Home() {
  return (
    <>
      <header className="feu-header">
        <div className="feu-crest">T</div>
        <p className="feu-inst">Far Eastern University · Manila</p>
        <h1>Telos LMS</h1>
        <p>Learning Management System</p>
      </header>
      <div className="feu-wrap" style={{ textAlign: 'center', marginTop: 48 }}>
        <div className="feu-card" style={{ maxWidth: 400, margin: '0 auto' }}>
          <p style={{ marginBottom: 16, color: 'var(--ink)' }}>
            Sign in to access your courses and assessments.
          </p>
          <Link href="/login" className="feu-btn-green">
            Log in
          </Link>
        </div>
      </div>
    </>
  )
}
