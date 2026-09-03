import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { Database } from '@/types/database.types'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const next = searchParams.get('next')
  const error = searchParams.get('error')
  const error_description = searchParams.get('error_description')

  // Calculate reliable origin behind reverse proxies (Vercel, Railway, Cloudflare, etc.)
  const forwardedHost = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https'
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (forwardedHost ? `${forwardedProto}://${forwardedHost}` : origin)

  // Handle provider or OAuth errors cleanly
  if (error || error_description) {
    const errorMsg = error_description || error || 'Authentication could not be completed'
    return NextResponse.redirect(`${siteUrl}/login?error=${encodeURIComponent(errorMsg)}`)
  }

  // Handle either OAuth/PKCE `code` OR email verification `token_hash` & `type`
  if (code || (token_hash && type)) {
    const defaultTarget = next && next.startsWith('/') ? next : '/onboarding'
    const response = NextResponse.redirect(`${siteUrl}${defaultTarget}`)

    // Create a server client that directly writes Set-Cookie headers onto the redirect response
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    let authUser = null

    if (code) {
      const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
      if (!exchangeError && data.session) {
        authUser = data.session.user
      } else if (exchangeError) {
        console.error('Callback code exchange error:', exchangeError)
      }
    } else if (token_hash && type) {
      const { data, error: otpError } = await supabase.auth.verifyOtp({
        token_hash,
        type: type as any,
      })
      if (!otpError && (data.session?.user || data.user)) {
        authUser = data.session?.user || data.user
      } else if (otpError) {
        console.error('Callback token_hash verification error:', otpError)
      }
    }

    if (authUser) {
      let targetPath = defaultTarget

      try {
        // Auto-provision profile from Google OAuth or email metadata if needed
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, buddy_code, preferences')
          .eq('id', authUser.id)
          .maybeSingle()

        if (!profile) {
          const generatedCode = authUser.id.replace(/-/g, '').slice(0, 6).toUpperCase()
          const fullName =
            authUser.user_metadata?.full_name ||
            authUser.user_metadata?.name ||
            authUser.email?.split('@')[0] ||
            'Believer'
          const avatarUrl =
            authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture || null

          await supabase.from('profiles').insert({
            id: authUser.id,
            display_name: fullName,
            avatar_url: avatarUrl,
            buddy_code: generatedCode,
            church: 'Local Assembly',
          })
          targetPath = '/onboarding'
        } else if (!profile.preferences) {
          targetPath = '/onboarding'
        } else {
          targetPath = next && next !== '/' ? next : '/home'
        }
      } catch (profileErr) {
        console.error('Error handling profile in auth callback:', profileErr)
      }

      // Update Location header while preserving all Set-Cookie headers
      response.headers.set('Location', `${siteUrl}${targetPath}`)
      return response
    }
  }

  // Fallback if exchange failed
  return NextResponse.redirect(
    `${siteUrl}/login?error=${encodeURIComponent(
      'Session could not be verified. Please try signing in directly.'
    )}`
  )
}
