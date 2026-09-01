'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bell,
  BellSlash,
  Fire,
  UserPlus,
  Clock,
  Smiley,
  Check,
  Checks,
  X,
  CircleNotch,
} from '@phosphor-icons/react'
import { createClient } from '@/lib/supabase/client'

export interface NotificationItem {
  id: string
  user_id: string
  type: 'nudge' | 'buddy_request' | 'timer_invite' | 'square_reaction' | 'streak_milestone' | 'general'
  text: string
  icon_type?: string
  read: boolean
  route_url?: string
  target_id?: string
  created_at: string
}

interface NotificationDropdownProps {
  isOpen: boolean
  onClose: () => void
  onUnreadCountChange?: (count: number) => void
}

export function NotificationDropdown({
  isOpen,
  onClose,
  onUnreadCountChange,
}: NotificationDropdownProps) {
  const router = useRouter()
  const dropdownRef = useRef<HTMLDivElement>(null)

  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // Fetch real notifications for the authenticated user only
  const fetchNotifications = async () => {
    try {
      setLoading(true)
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setNotifications([])
        if (onUnreadCountChange) onUnreadCountChange(0)
        return
      }

      setCurrentUserId(user.id)

      const { data: dbNotifs, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30)

      if (error) {
        console.error('Error fetching notifications:', error)
        return
      }

      if (dbNotifs) {
        const formatted: NotificationItem[] = dbNotifs.map((n: any) => ({
          id: n.id,
          user_id: n.user_id,
          type: n.type || 'general',
          text: n.text || n.title || n.message || 'New notification',
          icon_type: n.icon_type,
          read: Boolean(n.read),
          route_url: n.route_url,
          target_id: n.target_id,
          created_at: n.created_at,
        }))

        setNotifications(formatted)
        const unread = formatted.filter((n) => !n.read).length
        if (onUnreadCountChange) onUnreadCountChange(unread)
      } else {
        setNotifications([])
        if (onUnreadCountChange) onUnreadCountChange(0)
      }
    } catch (err) {
      console.error('Failed to load notifications:', err)
    } finally {
      setLoading(false)
    }
  }

  // Load notifications initially and whenever dropdown opens
  useEffect(() => {
    fetchNotifications()
  }, [isOpen])

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  // Mark all notifications as read in Supabase and locally
  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    if (onUnreadCountChange) onUnreadCountChange(0)

    try {
      const supabase = createClient()
      if (currentUserId) {
        await (supabase.from('notifications') as any)
          .update({ read: true })
          .eq('user_id', currentUserId)
          .eq('read', false)
      }
    } catch (err) {
      console.error('Error marking all read:', err)
    }
  }

  // Mark individual notification as read and route
  const handleNotificationClick = async (notif: NotificationItem) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
    )

    const newUnread = notifications.filter((n) => n.id !== notif.id && !n.read).length
    if (onUnreadCountChange) onUnreadCountChange(newUnread)

    try {
      const supabase = createClient()
      await (supabase.from('notifications') as any)
        .update({ read: true })
        .eq('id', notif.id)
    } catch (err) {
      console.error('Error marking notification read:', err)
    }

    onClose()

    if (notif.route_url) {
      router.push(notif.route_url)
      return
    }

    if (notif.type === 'timer_invite' || notif.type === 'nudge' || notif.type === 'buddy_request') {
      router.push('/sync')
    } else if (notif.type === 'square_reaction') {
      router.push('/square')
    } else {
      router.push('/home')
    }
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  if (!isOpen) return null

  const getRelativeTime = (dateStr: string) => {
    try {
      const diffMs = Date.now() - new Date(dateStr).getTime()
      const mins = Math.floor(diffMs / 60000)
      if (mins < 1) return 'Just now'
      if (mins < 60) return `${mins}m ago`
      const hours = Math.floor(mins / 60)
      if (hours < 24) return `${hours}h ago`
      const days = Math.floor(hours / 24)
      return `${days}d ago`
    } catch {
      return 'Recently'
    }
  }

  const renderIcon = (type: NotificationItem['type'] | string, icon_type?: string) => {
    if (icon_type === 'fire' || icon_type === 'flame' || type === 'streak_milestone' || type === 'buddy_clockin_completed') {
      return <Fire size={16} weight="fill" className="text-[#EA2C26]" />
    }
    if (icon_type === 'clock' || type === 'timer_invite' || type === 'buddy_scheduled_clockin') {
      return <Clock size={16} weight="bold" className="text-[#FBBF24]" />
    }
    if (icon_type === 'timer' || type === 'buddy_clockin_started') {
      return <Clock size={16} weight="fill" className="text-[#234537]" />
    }
    if (icon_type === 'reaction' || type === 'square_reaction') {
      return <Smiley size={16} weight="bold" className="text-amber-600" />
    }
    if (type === 'buddy_request' || type === 'nudge' || icon_type === 'hand_waving') {
      return <UserPlus size={16} weight="bold" className="text-[#234537]" />
    }
    return <Bell size={16} weight="fill" className="text-[#FBBF24]" />
  }

  return (
    <>
      {/* Mobile Backdrop to prevent background touches and enable easy closing */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-xs sm:hidden animate-in fade-in duration-200"
        onClick={onClose}
      />

      <div
        ref={dropdownRef}
        className="fixed sm:absolute top-16 sm:top-12 left-4 sm:left-auto right-4 sm:right-0 z-50 w-auto sm:w-88 max-w-[calc(100vw-32px)] sm:max-w-sm bg-[#FAF6EE] border border-[#E5E7EB] rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] p-4 space-y-3 animate-in zoom-in-95 duration-200"
      >
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-[#E5E7EB]">
        <div className="flex items-center gap-2">
          <Bell size={16} weight="fill" className="text-[#FBBF24]" />
          <h3 className="text-sm font-extrabold text-[#0E0E0E]">Notifications</h3>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-[#EA2C26] text-white text-[10px] font-black">
              {unreadCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="text-[11px] font-bold text-[#707070] hover:text-[#0E0E0E] flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Checks size={14} weight="bold" />
              <span>Mark all read</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-[#9095A1] hover:text-[#0E0E0E] transition-colors cursor-pointer"
            aria-label="Close notifications"
          >
            <X size={14} weight="bold" />
          </button>
        </div>
      </div>

      {/* Notifications List */}
      <div className="max-h-80 overflow-y-auto space-y-2 pr-1 no-scrollbar">
        {loading && notifications.length === 0 ? (
          <div className="py-8 flex flex-col items-center justify-center space-y-2 text-[#707070]">
            <CircleNotch size={20} className="animate-spin text-[#FBBF24]" />
            <p className="text-xs font-bold">Checking notifications...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-8 px-4 text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-black/5 flex items-center justify-center mx-auto text-[#9095A1]">
              <BellSlash size={22} weight="bold" />
            </div>
            <p className="text-xs font-black text-[#0E0E0E]">No notifications yet</p>
            <p className="text-[11px] text-[#707070] leading-relaxed max-w-[220px] mx-auto">
              When buddies nudge you or send session invites, you will see them here.
            </p>
          </div>
        ) : (
          notifications.map((notif) => (
            <div
              key={notif.id}
              onClick={() => handleNotificationClick(notif)}
              className={`p-3 rounded-2xl transition-all cursor-pointer flex items-start gap-3 border ${
                notif.read
                  ? 'bg-white/60 border-[#E5E7EB]/60 opacity-80 hover:opacity-100 hover:bg-white'
                  : 'bg-white border-[#FBBF24]/50 shadow-2xs hover:border-[#FBBF24]'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center ${
                  notif.read ? 'bg-[#FAF6EE]' : 'bg-[#FAF6EE] ring-1 ring-[#FBBF24]/40'
                }`}
              >
                {renderIcon(notif.type, notif.icon_type)}
              </div>

              <div className="flex-1 min-w-0 space-y-1">
                <p className="text-xs text-[#0E0E0E] leading-snug font-medium">
                  {notif.text}
                </p>
                <div className="flex items-center justify-between text-[10px] text-[#9095A1] font-bold">
                  <span>{getRelativeTime(notif.created_at)}</span>
                  {!notif.read && (
                    <span className="w-2 h-2 rounded-full bg-[#EA2C26]" />
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  </>
)
}

export default NotificationDropdown
