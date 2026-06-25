import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { gateRoute, type GateUser } from '@/lib/auth/gateRoute'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // Refresh the session (required: getUser revalidates the cookie).
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname

  let gateUser: GateUser | null = null
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, status')
      .eq('id', user.id)
      .single()
    if (profile) gateUser = { role: profile.role, status: profile.status }
  }

  const redirectTo = gateRoute(gateUser, path)
  if (redirectTo && redirectTo !== path) {
    const url = request.nextUrl.clone()
    url.pathname = redirectTo
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  // Run on everything except Next internals + static assets.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
