import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { Database } from '@/types/database.types'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const pathname = request.nextUrl.pathname

  // Skip static assets, internal Next.js files, and API endpoints
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/assets') ||
    pathname.startsWith('/api') ||
    pathname.includes('.') ||
    pathname === '/favicon.ico'
  ) {
    return supabaseResponse
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return supabaseResponse
  }

  const supabase = createServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Do NOT rely on raw cookie string checks. Verify actual user session.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isPublicAuthRoute =
    pathname === '/' ||
    pathname === '/welcome' ||
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname === '/register' ||
    pathname === '/forgot-password' ||
    pathname === '/reset-password'

  // If user is already authenticated and visits login/signup, redirect to /home
  if (user && (pathname === '/login' || pathname === '/signup' || pathname === '/register')) {
    const url = request.nextUrl.clone()
    url.pathname = '/home'
    return NextResponse.redirect(url)
  }

  // If user is NOT authenticated and attempts to access protected in-app routes
  if (!user && !isPublicAuthRoute && pathname !== '/onboarding') {
    const url = request.nextUrl.clone()
    url.pathname = '/welcome'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
