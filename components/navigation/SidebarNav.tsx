'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  House,
  Timer,
  Users,
  Globe,
  BookOpen,
  Trophy,
  FileText,
  User,
  Fire,
  Bell,
} from '@phosphor-icons/react'
import { createClient } from '@/lib/supabase/client'
import { useTimer } from '@/context/TimerContext'
import { shouldShowAppShell } from '@/lib/navigation/shellVisibility'
import { Logo } from '@/components/Logo'
import { calculateUserStreak } from '@/lib/utils/streak'
import { ThemeToggle } from '@/components/theme/ThemeToggle'
import { NotificationDropdown } from '@/components/notifications/NotificationDropdown'

export function SidebarNav() {
  const pathname = usePathname()
  const { session, formattedTime } = useTimer()

  const [user, setUser] = useState<{ id: string; email?: string; user_metadata?: any } | null>(null)
  const [unreadCount, setUnreadCount] = useState<number>(0)
  const [streak, setStreak] = useState<number>(0)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)

  const isVisible = shouldShowAppShell(pathname)

  useEffect(() => {
    async function loadSidebarData() {
      try {
        const supabase = createClient()
        const {
          data: { user: currentUser },
        } = await supabase.auth.getUser()

        if (currentUser) {
          setUser(currentUser)

          const realStreak = await calculateUserStreak(currentUser.id, supabase)
          setStreak(realStreak)

          const { count } = await supabase
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', currentUser.id)
            .eq('read', false)

          if (count !== null) setUnreadCount(count)
        }
      } catch (err) {
        console.error('Sidebar data error:', err)
      }
    }

    loadSidebarData()
  }, [pathname])

  if (!isVisible) {
    return null
  }

  const initial =
    user?.user_metadata?.display_name?.charAt(0) ||
    user?.user_metadata?.full_name?.charAt(0) ||
    user?.email?.charAt(0)?.toUpperCase() ||
    'B'

  const displayName =
    user?.user_metadata?.display_name ||
    user?.user_metadata?.full_name ||
    'Believer'

  const navItems = [
    {
      href: '/home',
      label: 'Dashboard',
      icon: House,
      isActive: pathname === '/' || pathname === '/home',
    },
    {
      href: '/clock-in',
      label: 'Clock-In Altar',
      icon: Timer,
      isActive: pathname === '/clock-in',
      badge: session?.isActive ? formattedTime : null,
      isPulsing: session?.isActive,
    },
    {
      href: '/sync',
      label: 'SynC Buddies',
      icon: Users,
      isActive:
        pathname?.startsWith('/sync') ||
        pathname?.startsWith('/accountability') ||
        pathname?.startsWith('/find-buddy') ||
        pathname?.startsWith('/buddy-chat'),
    },
    {
      href: '/square',
      label: 'Community Square',
      icon: Globe,
      isActive: pathname?.startsWith('/square'),
    },
    {
      href: '/bible',
      label: 'Bible Reader',
      icon: BookOpen,
      isActive: pathname?.startsWith('/bible'),
    },
    {
      href: '/milestones',
      label: 'Records & Badges',
      icon: Trophy,
      isActive: pathname?.startsWith('/milestones'),
    },
    {
      href: '/history',
      label: 'Devotion Ledger',
      icon: FileText,
      isActive: pathname?.startsWith('/history') || pathname?.startsWith('/session-details'),
    },
    {
      href: '/profile',
      label: 'My Profile',
      icon: User,
      isActive: pathname === '/profile',
    },
  ]

  return (
    <aside className="hidden md:flex flex-col w-64 lg:w-72 bg-card border-r border-border h-screen sticky top-0 z-40 shrink-0 select-none shadow-xs">
      {/* Top Header / Brand Logo */}
      <div className="p-5 lg:p-6 border-b border-border/70 flex items-center justify-between">
        <Link href="/home" className="flex items-center gap-2.5 group">
          <Logo height={24} />
        </Link>
        <ThemeToggle />
      </div>

      {/* Active Timer Banner (when active) */}
      {session?.isActive && (
        <div className="mx-4 mt-3 p-3 rounded-2xl bg-[#0E0E0E] dark:bg-[#1C1813] border border-[#FBBF24]/40 text-white dark:text-[#F5F1E8] shadow-md animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#FBBF24] animate-ping" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#FBBF24]">
                Session Live
              </span>
            </div>
            <span className="text-xs font-mono font-black text-[#FBBF24]">
              {formattedTime}
            </span>
          </div>
          <Link
            href="/clock-in"
            className="mt-2 block text-center py-1.5 px-3 rounded-xl bg-[#FBBF24] text-[#1A1610] text-xs font-extrabold hover:bg-amber-400 transition-colors"
          >
            Resume Altar
          </Link>
        </div>
      )}

      {/* Main Navigation Links */}
      <div className="flex-1 overflow-y-auto px-3.5 py-4 space-y-1.5 no-scrollbar">
        <div className="px-3 pb-1 text-[10px] font-black uppercase tracking-widest text-text-muted">
          Navigation
        </div>

        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all group ${
                item.isActive
                  ? 'bg-[#0E0E0E] text-white dark:bg-white dark:text-[#0E0E0E] shadow-sm'
                  : 'text-text-secondary hover:text-text-primary hover:bg-subtle'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon
                  size={18}
                  weight={item.isActive ? 'fill' : 'bold'}
                  className={
                    item.isActive
                      ? 'text-[#FBBF24] dark:text-[#B38F24]'
                      : 'text-text-muted group-hover:text-text-primary transition-colors'
                  }
                />
                <span className="tracking-tight">{item.label}</span>
              </div>

              {item.badge ? (
                <span className="px-2 py-0.5 rounded-full bg-[#FBBF24] text-[#1A1610] text-[10px] font-mono font-black animate-pulse">
                  {item.badge}
                </span>
              ) : item.isPulsing ? (
                <span className="w-2 h-2 rounded-full bg-[#FBBF24] animate-ping" />
              ) : null}
            </Link>
          )
        })}
      </div>

      {/* Bottom Footer Section: Streak + Notifications + Profile */}
      <div className="p-4 border-t border-border space-y-3 bg-surface/50">
        {/* Streak Pill */}
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#EBF3EE] dark:bg-emerald-950/30 border border-[#234537]/25 dark:border-emerald-700/30 text-[#234537] dark:text-emerald-400">
          <div className="flex items-center gap-1.5 text-xs font-bold">
            <Fire size={16} weight="fill" />
            <span>Spiritual Streak</span>
          </div>
          <span className="text-xs font-mono font-black">
            {streak} {streak === 1 ? 'Day' : 'Days'}
          </span>
        </div>

        {/* User Profile Card with Notification Bell */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <Link
            href="/profile"
            className="flex items-center gap-2.5 min-w-0 flex-1 hover:opacity-85 transition-opacity group"
          >
            <div className="w-9 h-9 rounded-full bg-[#0E0E0E] dark:bg-white text-white dark:text-[#0E0E0E] font-bold text-xs flex items-center justify-center shrink-0 shadow-xs border border-white/20">
              {initial}
            </div>
            <div className="min-w-0 flex-1 truncate">
              <p className="text-xs font-bold text-text-primary group-hover:text-[#FBBF24] transition-colors truncate">
                {displayName}
              </p>
              <p className="text-[10px] text-text-secondary truncate">
                View Account
              </p>
            </div>
          </Link>

          {/* Notification Bell */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsNotificationsOpen((prev) => !prev)}
              className="p-2 rounded-xl text-text-secondary hover:text-text-primary hover:bg-subtle transition-colors relative cursor-pointer"
              title="Notifications"
            >
              <Bell size={18} weight="bold" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#EA2C26] ring-2 ring-card" />
              )}
            </button>

            <NotificationDropdown
              isOpen={isNotificationsOpen}
              onClose={() => setIsNotificationsOpen(false)}
              onUpdateCount={(count) => setUnreadCount(count)}
            />
          </div>
        </div>
      </div>
    </aside>
  )
}
