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
      const user = data.session.user
      let targetPath = next || '/onboarding'

      try {
        // 1. Check or auto-provision profile from Google OAuth metadata
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, buddy_code, preferences')
          .eq('id', user.id)
          .maybeSingle()

        if (!profile) {
          const generatedCode = user.id.replace(/-/g, '').slice(0, 6).toUpperCase()
          const fullName =
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            user.email?.split('@')[0] ||
            'Believer'
          const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture || null

          await supabase.from('profiles').insert({
            id: user.id,
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
        console.error('Error auto-provisioning OAuth profile:', profileErr)
      }

      // Always redirect to the application's clean origin URL
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || origin
      return NextResponse.redirect(`${siteUrl}${targetPath}`)
    }
  }

  // Return the user to login with helpful error message
  const fallbackOrigin = process.env.NEXT_PUBLIC_SITE_URL || origin
  return NextResponse.redirect(`${fallbackOrigin}/login?error=Could not authenticate session`)
}
