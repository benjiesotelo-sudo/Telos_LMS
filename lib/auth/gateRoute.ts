import type { UserRole, UserStatus } from '@/lib/types'

export interface GateUser {
  role: UserRole
  status: UserStatus
}

const PUBLIC_PREFIXES = ['/login', '/register', '/holding', '/reset-password']

function homeFor(role: UserRole): string {
  // Slice 1 has only /instructor and /student areas (no /admin route).
  return role === 'instructor' || role === 'admin' ? '/instructor' : '/student'
}

function isPublic(path: string): boolean {
  return PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(p + '/'))
}

/**
 * Pure routing decision. Returns the path to redirect to, or null to allow.
 * gateRoute knows ONLY the /instructor and /student protected areas.
 */
export function gateRoute(user: GateUser | null, path: string): string | null {
  // Unauthenticated.
  if (!user) {
    if (path === '/' || isPublic(path)) return null
    return '/login'
  }

  // Authenticated but not active: park on /holding (and never bounce off it).
  if (user.status !== 'active') {
    return path === '/holding' ? null : '/holding'
  }

  const home = homeFor(user.role)

  // Active user hitting the landing or login page -> their home.
  if (path === '/' || path === '/login') return home

  // Protected-area role gating.
  const inInstructor = path === '/instructor' || path.startsWith('/instructor/')
  const inStudent = path === '/student' || path.startsWith('/student/')

  if (inInstructor && home !== '/instructor') return home
  if (inStudent && home !== '/student') return home

  // On their own area or any other (public) path -> allow.
  return null
}
