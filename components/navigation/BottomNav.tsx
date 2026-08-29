'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTimer } from '@/context/TimerContext'
import { shouldShowAppShell } from '@/lib/navigation/shellVisibility'

export function BottomNav() {
  const pathname = usePathname()
  const { session } = useTimer()

  const isVisible = shouldShowAppShell(pathname)

  if (!isVisible) {
    return null
  }

  const isHome = pathname === '/' || pathname === '/home'
  const isClockIn = pathname === '/clock-in'
  const isSync =
    pathname.startsWith('/sync') ||
    pathname.startsWith('/buddy-chat') ||
    pathname.startsWith('/group-chat') ||
    pathname.startsWith('/find-buddy') ||
    pathname.startsWith('/accountability')

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none flex justify-center pb-[max(12px,env(safe-area-inset-bottom))] px-3 sm:px-4">
      <div className="w-full max-w-[min(420px,calc(100vw-24px))] pointer-events-auto bg-[#FFFFFF]/95 backdrop-blur-xl border border-[#E5E7EB] rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] px-2 py-2 grid grid-cols-3 items-center">
        {/* ========================================================================= */}
        {/* 1. HOME (/home or /)                                                      */}
        {/* ========================================================================= */}
        <Link
          href="/"
          className={`flex flex-col items-center justify-center py-1 rounded-2xl transition-all group ${
            isHome ? 'text-[#0E0E0E]' : 'text-[#9095A1] hover:text-[#0E0E0E]'
          }`}
        >
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/assets/icon-home.svg"
              alt="Home"
              width={22}
              height={22}
              className={`transition-transform duration-200 ${
                isHome ? 'scale-110' : 'opacity-70 group-hover:opacity-100'
              }`}
            />
          </div>
          <span
            className={`text-[11px] mt-1 tracking-tight ${
              isHome ? 'font-black text-[#0E0E0E]' : 'font-medium text-[#9095A1]'
            }`}
          >
            Home
          </span>
        </Link>

        {/* ========================================================================= */}
        {/* 2. CLOCK-IN (/clock-in - Dead-Center Core Mechanic)                       */}
        {/* ========================================================================= */}
        <Link
          href="/clock-in"
          className={`flex flex-col items-center justify-center py-1 rounded-2xl transition-all group ${
            isClockIn ? 'text-[#0E0E0E]' : 'text-[#9095A1] hover:text-[#0E0E0E]'
          }`}
        >
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={
                isClockIn || session?.isActive
                  ? '/assets/icon-timer-active.svg'
                  : '/assets/icon-timer.svg'
              }
              alt="Clock-In"
              width={22}
              height={22}
              className={`transition-transform duration-200 ${
                isClockIn || session?.isActive
                  ? 'scale-110'
                  : 'opacity-70 group-hover:opacity-100'
              }`}
            />
            {session?.isActive && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            )}
          </div>
          <span
            className={`text-[11px] mt-1 tracking-tight ${
              isClockIn ? 'font-black text-[#0E0E0E]' : 'font-medium text-[#9095A1]'
            }`}
          >
            {session?.isActive ? 'Timing' : 'Clock-In'}
          </span>
        </Link>

        {/* ========================================================================= */}
        {/* 3. SYNC (/sync - Social & Community Hub)                                  */}
        {/* ========================================================================= */}
        <Link
          href="/sync"
          className={`flex flex-col items-center justify-center py-1 rounded-2xl transition-all group ${
            isSync ? 'text-[#0E0E0E]' : 'text-[#9095A1] hover:text-[#0E0E0E]'
          }`}
        >
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={isSync ? '/assets/icon-sync-active.svg' : '/assets/icon-sync.svg'}
              alt="SynC"
              width={22}
              height={22}
              className={`transition-transform duration-200 ${
                isSync ? 'scale-110' : 'opacity-70 group-hover:opacity-100'
              }`}
            />
          </div>
          <span
            className={`text-[11px] mt-1 tracking-tight ${
              isSync ? 'font-black text-[#0E0E0E]' : 'font-medium text-[#9095A1]'
            }`}
          >
            SynC
          </span>
        </Link>
      </div>
    </nav>
  )
}
