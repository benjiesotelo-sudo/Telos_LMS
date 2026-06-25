import Link from 'next/link'

export default function Home() {
  return (
    <main style={{ maxWidth: 640, margin: '4rem auto', padding: '0 1rem' }}>
      <h1>Telos LMS</h1>
      <p>
        <Link href="/login">Log in</Link>
      </p>
    </main>
  )
}
