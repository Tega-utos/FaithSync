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
    <nav className="modern-floating-dock">
      {/* ========================================================================= */}
      {/* 1. HOME (/home or /)                                                      */}
      {/* ========================================================================= */}
      <Link
        href="/"
        className={`modern-nav-item flex-1 ${
          isHome ? 'text-[#0E0E0E]' : 'text-[#9095A1] hover:text-[#0E0E0E]'
        }`}
      >
        <div className="relative flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/icon-home.svg"
            alt="Home"
            width={20}
            height={20}
            className={`w-5 h-5 transition-all duration-200 ${
              isHome ? 'scale-110 opacity-100' : 'opacity-65 hover:opacity-100'
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
        className={`modern-nav-item flex-1 ${
          isClockIn ? 'text-[#0E0E0E]' : 'text-[#9095A1] hover:text-[#0E0E0E]'
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
            width={20}
            height={20}
            className={`w-5 h-5 transition-all duration-200 ${
              isClockIn || session?.isActive
                ? 'scale-110 opacity-100'
                : 'opacity-65 hover:opacity-100'
            }`}
          />
          {session?.isActive && (
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-rose-500 animate-ping" />
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
        className={`modern-nav-item flex-1 ${
          isSync ? 'text-[#0E0E0E]' : 'text-[#9095A1] hover:text-[#0E0E0E]'
        }`}
      >
        <div className="relative flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={isSync ? '/assets/icon-sync-active.svg' : '/assets/icon-sync.svg'}
            alt="SynC"
            width={20}
            height={20}
            className={`w-5 h-5 transition-all duration-200 ${
              isSync ? 'scale-110 opacity-100' : 'opacity-65 hover:opacity-100'
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
    </nav>
  )
}
