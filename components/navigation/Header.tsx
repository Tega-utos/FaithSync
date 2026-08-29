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

          // Fetch streak
          const { data: streakData } = await (supabase.rpc as any)('get_user_streak', {
            p_user_id: currentUser.id,
          })
          if (streakData) setStreak(Number(streakData))

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

  return (
    <header className="sticky top-0 z-40 w-full bg-[#FAF6EE]/90 backdrop-blur-md px-4 sm:px-6 pt-[max(12px,env(safe-area-inset-top))] pb-3 border-b border-[#E5E7EB]/70">
      <div className="max-w-[480px] mx-auto flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/home" className="flex items-center gap-2">
          <Logo height={24} />
        </Link>

        {/* Center / Active Timer Pill */}
        {session?.isActive && (
          <Link
            href="/clock-in"
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FBBF24]/15 border border-[#FBBF24]/40 text-[#B38F24] animate-pulse"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#FBBF24] animate-ping" />
            <span className="text-xs font-mono font-bold">{formattedTime}</span>
            <span className="text-[10px] uppercase font-bold capitalize">{session.discipline}</span>
          </Link>
        )}

        {/* Right Section: Streak, Notification Bell & User Avatar */}
        <div className="flex items-center gap-2.5 relative">
          {streak > 0 && (
            <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#EBF3EE] border border-[#234537]/25 text-[#234537] text-xs font-bold shadow-2xs">
              <Fire size={14} weight="fill" className="text-[#234537]" />
              <span>{streak}</span>
            </div>
          )}

          {/* Notification Bell Trigger Button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsNotificationsOpen((prev) => !prev)}
              className="relative p-1.5 rounded-full hover:bg-[#F3F4F6]/50 transition-colors text-[#374151]"
              aria-label="Toggle notifications"
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-[#EA2C26] text-white text-[9px] font-black rounded-full flex items-center justify-center ring-2 ring-[#FAF6EE] shadow-sm">
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
            className="w-8 h-8 rounded-full bg-[#0E0E0E] text-white flex items-center justify-center font-bold text-xs shadow-sm hover:scale-105 transition-transform"
          >
            {initial}
          </Link>
        </div>
      </div>
    </header>
  )
}
