'use client'

import React, { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Logo } from '@/components/Logo'

export default function SplashPage() {
  const router = useRouter()

  useEffect(() => {
    let isMounted = true

    async function checkAuthAndRoute() {
      // 1. Set minimum perceptual display duration (800ms) for smooth polish
      const minDisplayPromise = new Promise((resolve) => setTimeout(resolve, 800))

      // 2. Perform real Supabase session verification
      const authCheckPromise = (async () => {
        try {
          const supabase = createClient()
          const { data } = await supabase.auth.getSession()
          return data?.session?.user || null
        } catch {
          return null
        }
      })()

      // 3. Await both concurrently
      const [_, currentUser] = await Promise.all([minDisplayPromise, authCheckPromise])

      if (isMounted) {
        if (currentUser) {
          // Check if the user has completed onboarding
          try {
            const supabase = createClient()
            const { data: profile } = await supabase
              .from('profiles')
              .select('preferences')
              .eq('id', currentUser.id)
              .maybeSingle()

            const localDone =
              typeof window !== 'undefined' &&
              (localStorage.getItem('faithsync_onboarding_completed') === 'true' ||
                localStorage.getItem(`faithsync_onboarding_${currentUser.id}`) === 'true')

            const hasCompletedOnboarding =
              localDone ||
              currentUser.user_metadata?.onboarding_completed === true ||
              profile?.preferences?.onboarding_completed === true ||
              Boolean(profile?.preferences?.targets?.prayer || profile?.preferences?.targets?.study)

            if (hasCompletedOnboarding) {
              router.replace('/home')
            } else {
              router.replace('/onboarding')
            }
          } catch {
            router.replace('/onboarding')
          }
        } else {
          router.replace('/welcome')
        }
      }
    }

    checkAuthAndRoute()

    return () => {
      isMounted = false
    }
  }, [router])

  return (
    <div className="bg-card min-h-screen min-h-[100dvh] h-screen h-[100dvh] max-h-[100dvh] w-full flex flex-col items-center justify-center relative overflow-hidden select-none">
      {/* Dead-Center Primary Logo with 1s fadeInScale Animation */}
      <div className="flex flex-col items-center justify-center space-y-3 animate-fade-in-scale">
        <Logo height={48} priority />
        <p className="text-[11px] font-bold text-text-secondary tracking-widest uppercase">
          Walk in Step
        </p>
      </div>
    </div>
  )
}
