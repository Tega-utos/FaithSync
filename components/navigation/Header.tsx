'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bell, Fire } from '@phosphor-icons/react'
import { createClient } from '@/lib/supabase/client'
import { useTimer } from '@/context/TimerContext'
import { NotificationDropdown } from '@/components/notifications/NotificationDropdown'
import { shouldShowAppShell } from '@/lib/navigation/shellVisibility'
import { Logo } from '@/components/Logo'
import { calculateUserStreak } from '@/lib/utils/streak'
import { ThemeToggle } from '@/components/theme/ThemeToggle'

export function Header() {
  const pathname = usePathname()
  const { session, formattedTime } = useTimer()

  const [user, setUser] = useState<{ id: string; email?: string; user_metadata?: any } | null>(null)
  const [unreadCount, setUnreadCount] = useState<number>(0)
  const [streak, setStreak] = useState<number>(0)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)

  const isVisible = shouldShowAppShell(pathname)

  useEffect(() => {
    async function loadHeaderData() {
      try {
        const supabase = createClient()
        const {
          data: { user: currentUser },
        } = await supabase.auth.getUser()

        if (currentUser) {
          setUser(currentUser)

          // Fetch authentic real-database streak
          const realStreak = await calculateUserStreak(currentUser.id, supabase)
          setStreak(realStreak)

          // Fetch unread notifications count
          const { count } = await supabase
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', currentUser.id)
            .eq('read', false)

          if (count !== null) setUnreadCount(count)
        }
      } catch (err) {
        console.error('Header data error:', err)
      }
    }

    loadHeaderData()
  }, [pathname])

  if (!isVisible) {
    return null
  }

  const initial =
    user?.user_metadata?.display_name?.charAt(0) ||
    user?.user_metadata?.full_name?.charAt(0) ||
    user?.email?.charAt(0)?.toUpperCase() ||
    'M'

  const isHome = pathname === '/' || pathname === '/home'
  const isClockIn = pathname === '/clock-in'
  const isSync = pathname?.startsWith('/sync') || pathname?.startsWith('/accountability') || pathname?.startsWith('/find-buddy')
  const isSquare = pathname?.startsWith('/square')
  const isBible = pathname?.startsWith('/bible')
  const isMilestones = pathname?.startsWith('/milestones')

  return (
    <header className="sticky top-0 z-40 w-full bg-surface/90 backdrop-blur-md px-4 sm:px-6 md:px-8 pt-[max(12px,env(safe-area-inset-top))] pb-3 border-b border-border/70">
      <div className="max-w-[1280px] 2xl:max-w-[1600px] mx-auto flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <Link href="/home" className="flex items-center gap-2 shrink-0">
          <Logo height={20} />
        </Link>

        {/* Desktop & Tablet Navigation Links (md+) */}
        <nav className="hidden md:flex items-center gap-1 lg:gap-2">
          <Link
            href="/home"
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
              isHome
                ? 'bg-black/5 dark:bg-white/10 text-text-primary dark:text-[#F5F1E8]'
                : 'text-text-secondary hover:text-text-primary hover:bg-subtle/50'
            }`}
          >
            Dashboard
          </Link>
          <Link
            href="/clock-in"
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${
              isClockIn
                ? 'bg-[#FBBF24]/20 text-[#B38F24] dark:text-amber-400 font-extrabold'
                : 'text-text-secondary hover:text-text-primary hover:bg-subtle/50'
            }`}
          >
            <span>Clock-In</span>
            {session?.isActive && (
              <span className="w-2 h-2 rounded-full bg-[#FBBF24] animate-ping" />
            )}
          </Link>
          <Link
            href="/sync"
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
              isSync
                ? 'bg-black/5 dark:bg-white/10 text-text-primary dark:text-[#F5F1E8]'
                : 'text-text-secondary hover:text-text-primary hover:bg-subtle/50'
            }`}
          >
            SynC Buddies
          </Link>
          <Link
            href="/square"
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
              isSquare
                ? 'bg-black/5 dark:bg-white/10 text-text-primary dark:text-[#F5F1E8]'
                : 'text-text-secondary hover:text-text-primary hover:bg-subtle/50'
            }`}
          >
            Square
          </Link>
          <Link
            href="/bible"
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
              isBible
                ? 'bg-black/5 dark:bg-white/10 text-text-primary dark:text-[#F5F1E8]'
                : 'text-text-secondary hover:text-text-primary hover:bg-subtle/50'
            }`}
          >
            Bible
          </Link>
          <Link
            href="/milestones"
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
              isMilestones
                ? 'bg-black/5 dark:bg-white/10 text-text-primary dark:text-[#F5F1E8]'
                : 'text-text-secondary hover:text-text-primary hover:bg-subtle/50'
            }`}
          >
            Milestones
          </Link>
        </nav>

        {/* Center / Active Timer Pill (Mobile only, on desktop it's in nav) */}
        {session?.isActive && (
          <Link
            href="/clock-in"
            className="md:hidden flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FBBF24]/15 dark:bg-amber-500/20 border border-[#FBBF24]/40 dark:border-amber-500/30 text-[#B38F24] dark:text-amber-400 animate-pulse"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#FBBF24] animate-ping" />
            <span className="text-xs font-mono font-bold">{formattedTime}</span>
            <span className="text-[10px] uppercase font-bold capitalize">{session.discipline}</span>
          </Link>
        )}

        {/* Right Section: Streak, Notification Bell & User Avatar */}
        <div className="flex items-center gap-2.5 relative">
          {streak > 0 && (
            <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#EBF3EE] dark:bg-emerald-950/30 border border-[#234537]/25 dark:border-emerald-700/30 text-[#234537] dark:text-emerald-400 text-xs font-bold shadow-2xs">
              <Fire size={14} weight="fill" className="text-[#234537] dark:text-emerald-400" />
              <span>{streak}</span>
            </div>
          )}

          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Notification Bell Trigger Button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsNotificationsOpen((prev) => !prev)}
              className="relative p-1.5 rounded-full hover:bg-subtle/50 transition-colors text-text-primary"
              aria-label="Toggle notifications"
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-[#EA2C26] text-white text-[9px] font-black rounded-full flex items-center justify-center ring-2 ring-surface shadow-sm">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Floating Notification Dropdown Panel */}
            <NotificationDropdown
              isOpen={isNotificationsOpen}
              onClose={() => setIsNotificationsOpen(false)}
              onUnreadCountChange={setUnreadCount}
            />
          </div>

          {/* User Avatar */}
          <Link
            href="/profile"
            className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 border border-neutral-300 dark:border-neutral-600 ring-1 ring-black/5 dark:ring-white/20 flex items-center justify-center font-bold text-xs shadow-sm hover:scale-105 transition-transform"
          >
            {initial}
          </Link>
        </div>
      </div>
    </header>
  )
}
