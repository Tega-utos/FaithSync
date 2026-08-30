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

  // Hide BottomNav in Community Square (/square) as navigation is via Back to SynC
  if (!isVisible || pathname?.startsWith('/square')) {
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
    <nav className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none flex justify-center pb-[max(10px,env(safe-area-inset-bottom))] px-3">
      <div className="w-full max-w-[min(340px,calc(100vw-32px))] pointer-events-auto bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.06)] p-1 grid grid-cols-3 gap-1 items-center">
        {/* ========================================================================= */}
        {/* 1. HOME (/home or /)                                                      */}
        {/* ========================================================================= */}
        <Link
          href="/"
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all duration-200 group ${
            isHome
              ? 'bg-[#FAF6EE] border border-[#E5E7EB] shadow-2xs text-[#0E0E0E]'
              : 'border border-transparent text-[#9095A1] hover:text-[#0E0E0E]'
          }`}
        >
          <div className="relative flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/assets/icon-home.svg"
              alt="Home"
              width={18}
              height={18}
              className={`w-[18px] h-[18px] transition-transform duration-200 ${
                isHome ? 'scale-110' : 'opacity-70 group-hover:opacity-100'
              }`}
            />
          </div>
          <span
            className={`text-[10px] mt-0.5 tracking-tight ${
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
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all duration-200 group ${
            isClockIn
              ? 'bg-[#FAF6EE] border border-[#E5E7EB] shadow-2xs text-[#0E0E0E]'
              : 'border border-transparent text-[#9095A1] hover:text-[#0E0E0E]'
          }`}
        >
          <div className="relative flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={
                isClockIn || session?.isActive
                  ? '/assets/icon-timer-active.svg'
                  : '/assets/icon-timer.svg'
              }
              alt="Clock-In"
              width={18}
              height={18}
              className={`w-[18px] h-[18px] transition-transform duration-200 ${
                isClockIn || session?.isActive
                  ? 'scale-110'
                  : 'opacity-70 group-hover:opacity-100'
              }`}
            />
            {session?.isActive && (
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
            )}
          </div>
          <span
            className={`text-[10px] mt-0.5 tracking-tight ${
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
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all duration-200 group ${
            isSync
              ? 'bg-[#FAF6EE] border border-[#E5E7EB] shadow-2xs text-[#0E0E0E]'
              : 'border border-transparent text-[#9095A1] hover:text-[#0E0E0E]'
          }`}
        >
          <div className="relative flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={isSync ? '/assets/icon-sync-active.svg' : '/assets/icon-sync.svg'}
              alt="SynC"
              width={18}
              height={18}
              className={`w-[18px] h-[18px] transition-transform duration-200 ${
                isSync ? 'scale-110' : 'opacity-70 group-hover:opacity-100'
              }`}
            />
          </div>
          <span
            className={`text-[10px] mt-0.5 tracking-tight ${
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
