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

      // 3. Await both concurrently: routes as soon as auth check resolves past the minimum 800ms
      const [_, currentUser] = await Promise.all([minDisplayPromise, authCheckPromise])

      if (isMounted) {
        if (currentUser) {
          router.replace('/home')
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
