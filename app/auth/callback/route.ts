import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next')

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.session) {
      let targetPath = next || '/onboarding'

      if (!next || next === '/' || next === '/home') {
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, preferences')
            .eq('id', data.session.user.id)
            .maybeSingle()

          if (!profile || !profile.preferences) {
            targetPath = '/onboarding'
          } else {
            targetPath = '/home'
          }
        } catch {
          targetPath = '/onboarding'
        }
      }

      const forwardedHost = request.headers.get('x-forwarded-host')
      const isLocalEnv = process.env.NODE_ENV === 'development'

      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${targetPath}`)
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${targetPath}`)
      } else {
        return NextResponse.redirect(`${origin}${targetPath}`)
      }
    }
  }

  // Return the user to login with helpful error message
  return NextResponse.redirect(`${origin}/login?error=Could not authenticate session`)
}
