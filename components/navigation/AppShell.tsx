'use client'

import React from 'react'
import { usePathname } from 'next/navigation'
import { Header } from '@/components/navigation/Header'
import { BottomNav } from '@/components/navigation/BottomNav'
import { shouldShowAppShell } from '@/lib/navigation/shellVisibility'

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const showShell = shouldShowAppShell(pathname)
  const isSquare = pathname?.startsWith('/square')

  return (
    <div className={`min-h-full flex-1 flex flex-col ${showShell && !isSquare ? 'pb-[max(84px,calc(72px+env(safe-area-inset-bottom)))]' : ''}`}>
      <Header />
      <main className="flex-1 flex flex-col">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}

export default AppShell
