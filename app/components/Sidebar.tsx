'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from '@/app/login/actions'

export function Sidebar({ title, items, userLabel }: {
  title: string; items: { href: string; label: string }[]; userLabel?: string
}) {
  const pathname = usePathname()
  const isActive = (href: string) =>
    href === pathname || (href !== '/instructor' && href !== '/student' && pathname.startsWith(href))
  return (
    <aside className="feu-sidebar">
      <div className="feu-sidebar-brand">{title}</div>
      <nav className="feu-nav">
        {items.map((it) => (
          <Link key={it.href} href={it.href} className={`feu-nav-link${isActive(it.href) ? ' active' : ''}`}>
            {it.label}
          </Link>
        ))}
      </nav>
      <div className="feu-sidebar-foot">
        {userLabel && <p style={{ fontSize: 12, color: '#d6ebdd', marginBottom: 8 }}>{userLabel}</p>}
        <form action={signOut}>
          <button type="submit" className="feu-btn-outline" style={{ width: '100%', background: 'transparent', color: '#fff', borderColor: 'rgba(255,255,255,.5)' }}>
            Log out
          </button>
        </form>
      </div>
    </aside>
  )
}
