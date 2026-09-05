'use client'

import React from 'react'
import { usePathname } from 'next/navigation'
import { Header } from '@/components/navigation/Header'
import { SidebarNav } from '@/components/navigation/SidebarNav'
import { BottomNav } from '@/components/navigation/BottomNav'
import { shouldShowAppShell } from '@/lib/navigation/shellVisibility'

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const showShell = shouldShowAppShell(pathname)
  const isSquare = pathname?.startsWith('/square')

  return (
    <div className="min-h-full flex-1 flex flex-row">
      {/* Persistent Left Sidebar Menu on Tablets, Desktops & TVs */}
      {showShell && <SidebarNav />}

      <div
        className={`flex-1 flex flex-col min-w-0 ${
          showShell && !isSquare
            ? 'pb-[max(84px,calc(72px+env(safe-area-inset-bottom)))] md:pb-0'
            : ''
        }`}
      >
        {/* Top Header (Mobile only, as Sidebar handles tablet/desktop/TV) */}
        <div className="md:hidden">
          <Header />
        </div>

        <main className="flex-1 flex flex-col min-w-0">
          {children}
        </main>

        {/* Bottom Nav Bar (Mobile only) */}
        <BottomNav />
      </div>
    </div>
  )
}

export default AppShell
