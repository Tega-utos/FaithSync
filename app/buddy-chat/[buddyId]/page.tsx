'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  CaretLeft,
  PaperPlaneTilt,
  Fire,
  BookOpen,
  Clock,
  Microphone,
  MicrophoneSlash,
  DotsThreeVertical,
  Play,
  Square,
  Sparkle,
  ShieldWarning,
  Flag,
  User,
  SpeakerHigh,
  Check,
  X,
  HandsPraying,
  Lightning,
  HandWaving,
  CalendarCheck,
  CalendarBlank,
  BellRinging,
  CircleNotch,
  Quotes,
  Paperclip,
  Trash,
  UserMinus,
  Sliders,
  Globe,
} from '@phosphor-icons/react'
import { createClient } from '@/lib/supabase/client'
import { useTimer } from '@/context/TimerContext'
import { playChime } from '@/components/audio/Chime'
import { fetchBuddyMessages, sendBuddyMessage } from '@/features/buddies/services/buddyService'
import { getLocalDateKey } from '@/lib/utils/date'
import { getDevotionState, getElapsedSeconds, getRemainingSeconds } from '@/lib/devotionSync'

const DASH_ARRAY = 565.48

interface ChatMessage {
  id: string
  sender_id: string
  content: string
  message_type: 'text' | 'clockin_invite' | 'nudge' | 'system'
  meta?: {
    discipline?: 'prayer' | 'study'
    durationMins?: number
    focusText?: string
    scheduledAt?: string
    isScheduled?: boolean
    startedAt?: string
  }
  created_at: string
}

export default function BuddyChatPage() {
  const params = useParams()
  const router = useRouter()
  const buddyId = params?.buddyId as string

  const messagesEndRef = useRef<HTMLDivElement>(null)

  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [buddyName, setBuddyName] = useState('Accountability Buddy')
  const [buddyInitial, setBuddyInitial] = useState('A')
  const [buddyChurch, setBuddyChurch] = useState('Assembly of Christ')
  const [buddyStreak, setBuddyStreak] = useState(7)
  const [buddyStatus, setBuddyStatus] = useState<'online' | 'offline'>('online')
  const [buddyLastSeen, setBuddyLastSeen] = useState('Active now')
  const [isSquareConnection, setIsSquareConnection] = useState(false)

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputContent, setInputContent] = useState('')

  // Real-time Clock Ticker for Hostless Scheduled Sessions
  const [currentTimeTick, setCurrentTimeTick] = useState<number>(Date.now())

  // Header Dropdown Menu & Modals
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isRemoveBuddyModalOpen, setIsRemoveBuddyModalOpen] = useState(false)
  const [isRemoveBuddyConfirmOpen, setIsRemoveBuddyConfirmOpen] = useState(false)
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [isReportModalOpen, setIsReportModalOpen] = useState(false)

  // Permissions in Settings Modal
  const [shareHistory, setShareHistory] = useState(true)
  const [allowNudge, setAllowNudge] = useState(true)
  const [shareLiveSession, setShareLiveSession] = useState(true)

  // Clock-in Setup Modal State & Scheduling
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false)
  const [inviteDiscipline, setInviteDiscipline] = useState<'prayer' | 'study'>('prayer')
  const [inviteDuration, setInviteDuration] = useState(15)
  const [inviteFocus, setInviteFocus] = useState('Praying for family, work and spiritual growth')
  const [isScheduleEnabled, setIsScheduleEnabled] = useState(false)
  const [schedulePreset, setSchedulePreset] = useState<'tomorrow_6am' | 'tomorrow_7am' | 'today_8pm' | 'custom'>('tomorrow_6am')
  const [customScheduledTime, setCustomScheduledTime] = useState('')

  // Live Devotion Room (WebRTC + Realtime Synced Stopwatch)
  // Auto-Unmute (Buddy Mode): Microphone is unmuted by default in 1-on-1 sessions
  const [isLiveOverlayOpen, setIsLiveOverlayOpen] = useState(false)
  const [liveDiscipline, setLiveDiscipline] = useState<'prayer' | 'study'>('prayer')
  const [liveDurationSecs, setLiveDurationSecs] = useState(0)
  const [liveTargetMins, setLiveTargetMins] = useState(15)
  const [liveFocusText, setLiveFocusText] = useState('')
  const [isMicMuted, setIsMicMuted] = useState(false)
  const [isBuddySpeaking, setIsBuddySpeaking] = useState(false)
  const [showEndConfirm, setShowEndConfirm] = useState(false)

  useEffect(() => {
    async function loadChatContext() {
      if (!buddyId) return

      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        setCurrentUser(user)

        // 1. Fetch Genuine Buddy Profile & Real Streak
        const { data: partnerProfile } = await supabase
          .from('profiles')
          .select('display_name, church, preferences, avatar_url')
          .eq('id', buddyId)
          .single()

        if (partnerProfile) {
          const name = partnerProfile.display_name || 'Accountability Buddy'
          setBuddyName(name)
          setBuddyInitial(name.charAt(0).toUpperCase())
          setBuddyChurch(partnerProfile.church || 'Local Assembly')
        }

        // 2. Fetch Genuine Buddy Streak from Database
        const { data: bStats } = await (supabase
          .from('user_stats') as any)
          .select('streak_days')
          .eq('user_id', buddyId)
          .maybeSingle()

        setBuddyStreak(bStats?.streak_days || 0)

        if (user) {
          // Check connection type (Square Connection vs True Buddy)
          const { data: conn } = await (supabase
            .from('buddies') as any)
            .select('id, status, connection_type')
            .or(`and(user_id.eq.${user.id},buddy_id.eq.${buddyId}),and(user_id.eq.${buddyId},buddy_id.eq.${user.id})`)
            .maybeSingle()

          if (conn?.connection_type === 'square') {
            setIsSquareConnection(true)
          }

          const realMessages = await fetchBuddyMessages(buddyId, user.id)
          setMessages(realMessages as any)
        }
      } catch (err) {
        console.error('Chat load error:', err)
      } finally {
        setLoading(false)
      }
    }

    loadChatContext()
  }, [buddyId])

  // Realtime messages subscription
  useEffect(() => {
    if (!buddyId || !currentUser) return

    const supabase = createClient()
    const channel = supabase
      .channel(`buddy_messages_${buddyId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        async () => {
          const updated = await fetchBuddyMessages(buddyId, currentUser.id)
          setMessages(updated as any)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [buddyId, currentUser])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Live Timer Interval inside Overlay
  useEffect(() => {
    let interval: any = null
    if (isLiveOverlayOpen) {
      interval = setInterval(() => {
        setLiveDurationSecs((prev) => prev + 1)
      }, 1000)
    } else {
      clearInterval(interval)
    }
    return () => clearInterval(interval)
  }, [isLiveOverlayOpen])

  // Real-time Clock Ticker for Hostless Scheduled Sessions
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTimeTick(Date.now())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Message counting for Square Connections (3-Message Limit)
  const todayDateKey = getLocalDateKey()
  const sentTodayCount = messages.filter(
    (m) =>
      m.sender_id === currentUser?.id &&
      getLocalDateKey(m.created_at) === todayDateKey &&
      m.message_type === 'text'
  ).length
  const remainingSquareMessages = Math.max(0, 3 - sentTodayCount)

  // Send Standard Text Message (Optimistic UI with Rollback & 3-Message Cap)
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputContent.trim() || !currentUser) return

    if (isSquareConnection && remainingSquareMessages <= 0) {
      setToastMessage('Square Connection daily limit reached (3/3 messages today).')
      setTimeout(() => setToastMessage(null), 3000)
      return
    }

    const text = inputContent.trim()
    setInputContent('')

    const tempId = `temp-${Date.now()}`
    const optMsg: ChatMessage = {
      id: tempId,
      sender_id: currentUser.id,
      content: text,
      message_type: 'text',
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optMsg])

    try {
      const sent = await sendBuddyMessage(buddyId, currentUser.id, text, 'text')
      if (sent) {
        setMessages((prev) => prev.map((m) => (m.id === tempId ? (sent as any) : m)))
      }
    } catch (err) {
      console.error('Send message error:', err)
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
      setToastMessage('Failed to send message. Please check connection.')
      setTimeout(() => setToastMessage(null), 3000)
    }
  }

  // Setup Timer & Send Clock-in Invite to Chat (Instant or Scheduled)
  const handleSendClockInInvite = async () => {
    setIsInviteModalOpen(false)
    if (!currentUser) return

    let scheduledAtISO = new Date().toISOString()
    if (isScheduleEnabled) {
      const targetDate = new Date()
      if (schedulePreset === 'tomorrow_6am') {
        targetDate.setDate(targetDate.getDate() + 1)
        targetDate.setHours(6, 0, 0, 0)
      } else if (schedulePreset === 'tomorrow_7am') {
        targetDate.setDate(targetDate.getDate() + 1)
        targetDate.setHours(7, 0, 0, 0)
      } else if (schedulePreset === 'today_8pm') {
        targetDate.setHours(20, 0, 0, 0)
      } else if (schedulePreset === 'custom' && customScheduledTime) {
        const [hours, mins] = customScheduledTime.split(':').map(Number)
        targetDate.setDate(targetDate.getDate() + 1)
        targetDate.setHours(hours, mins, 0, 0)
      }
      scheduledAtISO = targetDate.toISOString()
    }

    try {
      await fetch('/api/notifications/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send',
          targetUserId: buddyId,
          type: 'clockin_invite',
          title: `Clock-In ${isScheduleEnabled ? 'Scheduled' : 'Invite'} from ${currentUser?.user_metadata?.full_name || 'Your Buddy'}`,
          message: `${isScheduleEnabled ? 'Scheduled for tomorrow 6:00 AM' : 'Join now'}: ${inviteDuration} min ${inviteDiscipline}`,
          url: `/buddy-chat/${currentUser?.id || 'partner'}`,
        }),
      })
    } catch (err) {
      console.log('Push invite notification note:', err)
    }

    const contentText = isScheduleEnabled
      ? `Scheduled a ${inviteDuration} min ${inviteDiscipline} session for ${new Date(scheduledAtISO).toLocaleDateString([], { weekday: 'short' })} at ${new Date(scheduledAtISO).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}`
      : `Sent an invitation for a ${inviteDuration} min ${
          inviteDiscipline === 'prayer' ? 'Prayer' : 'Scripture Study'
        } session!`

    const metaObj = {
      discipline: inviteDiscipline,
      durationMins: inviteDuration,
      focusText: inviteFocus.trim() || '',
      isScheduled: isScheduleEnabled,
      scheduledAt: isScheduleEnabled ? scheduledAtISO : undefined,
      startedAt: isScheduleEnabled ? scheduledAtISO : new Date().toISOString(),
    }

    const sent = await sendBuddyMessage(buddyId, currentUser.id, contentText, 'clockin_invite', metaObj)
    if (sent) {
      setMessages((prev) => [...prev, sent as any])
    }

    setToastMessage(isScheduleEnabled ? `Clock-in scheduled for ${new Date(scheduledAtISO).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })} ⏱️` : `Clock-in invite sent to ${buddyName} ⏱️`)
    setTimeout(() => setToastMessage(null), 3000)
  }

  // Instant Clock-In Trigger (Header Pill)
  const handleInstantBuddyClockIn = async () => {
    if (!currentUser) return

    const contentText = `Sent an invitation for a 15 min Prayer session!`
    const metaObj = {
      discipline: 'prayer',
      durationMins: 15,
      focusText: 'Daily accountability prayer together',
      startedAt: new Date().toISOString(),
    }

    const sent = await sendBuddyMessage(buddyId, currentUser.id, contentText, 'clockin_invite', metaObj)
    if (sent) {
      setMessages((prev) => [...prev, sent as any])
    }

    setToastMessage(`Clock-in invite sent to ${buddyName} ⏱️`)
    setTimeout(() => setToastMessage(null), 3000)

    try {
      await fetch('/api/notifications/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send',
          targetUserId: buddyId,
          type: 'clockin_invite',
          title: `Clock-In Invite from ${currentUser?.user_metadata?.full_name || 'Your Buddy'}`,
          message: `Join a 15 min prayer session!`,
          url: `/buddy-chat/${currentUser?.id || 'partner'}`,
        }),
      })
    } catch {}
  }

  // Join Active Session from Chat Bubble (Hostless Sync)
  const handleJoinSession = async (msg: ChatMessage) => {
    const discipline = msg.meta?.discipline || 'prayer'
    const duration = msg.meta?.durationMins || 15
    const focus = msg.meta?.focusText || ''

    const targetStartTime = msg.meta?.scheduledAt
      ? new Date(msg.meta.scheduledAt).getTime()
      : msg.meta?.startedAt
      ? new Date(msg.meta.startedAt).getTime()
      : Date.now()

    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - targetStartTime) / 1000))
    const totalDurationSecs = duration * 60

    if (elapsedSeconds >= totalDurationSecs) {
      setToastMessage('This session has already ended.')
      setTimeout(() => setToastMessage(null), 3000)
      return
    }

    setLiveDiscipline(discipline)
    setLiveTargetMins(duration)
    setLiveFocusText(focus)
    setLiveDurationSecs(elapsedSeconds)
    setIsLiveOverlayOpen(true)
    playChime()

    try {
      fetch('/api/webrtc/ice-servers').catch(() => {})
      const roomId = `buddy-${buddyId}`
      const syncRes = await fetch('/api/session/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync', liveRoomId: roomId }),
      })
      const syncData = await syncRes.json()
      if (syncData.elapsedSeconds && syncData.elapsedSeconds > elapsedSeconds) {
        setLiveDurationSecs(syncData.elapsedSeconds)
      }
    } catch {}
  }

  // Send Nudge (Throttled for Square Connections)
  const handleSendNudge = async () => {
    setIsMenuOpen(false)

    if (isSquareConnection) {
      setToastMessage('Nudges are disabled for Square Connections to focus purely on prayer.')
      setTimeout(() => setToastMessage(null), 3500)
      return
    }

    const nudgeMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender_id: 'system',
      content: 'You sent a nudge: Keep showing up 👋',
      message_type: 'system',
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, nudgeMsg])
    setToastMessage(`Nudge sent: Keep showing up 👋`)
    setTimeout(() => setToastMessage(null), 3000)

    try {
      await fetch('/api/buddy/nudge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buddyId }),
      })
      await fetch('/api/notifications/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send',
          targetUserId: buddyId,
          type: 'nudge',
          title: `${currentUser?.user_metadata?.full_name || 'Your Buddy'} sent you a nudge!`,
          message: 'Keep showing up in prayer & study.',
          url: `/buddy-chat/${currentUser?.id || 'partner'}`,
        }),
      })
    } catch {}
  }

  // Remove Buddy Action
  const handleRemoveBuddy = async () => {
    setIsRemoveBuddyConfirmOpen(false)
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        await supabase
          .from('buddies')
          .delete()
          .or(
            `and(user_id.eq.${user.id},buddy_id.eq.${buddyId}),and(user_id.eq.${buddyId},buddy_id.eq.${user.id})`
          )
      }
      router.push('/sync')
    } catch (err) {
      console.error('Remove buddy error:', err)
      router.push('/sync')
    }
  }

  // End Live Session & Log to Database
  const handleConfirmEndSession = async () => {
    setShowEndConfirm(false)
    setIsLiveOverlayOpen(false)

    try {
      const roomId = `buddy-${buddyId}`
      // 1. Terminate Live Room Signal
      await fetch('/api/session/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'end',
          liveRoomId: roomId,
          discipline: liveDiscipline,
          elapsedSeconds: liveDurationSecs,
          targetMins: liveTargetMins,
          focusText: liveFocusText,
        }),
      })

      // 2. Persist Completed Devotion Session to Database & User Stats
      await fetch('/api/session/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: liveDiscipline,
          durationSeconds: liveDurationSecs,
          targetDurationSeconds: liveTargetMins * 60,
          startedAt: new Date(Date.now() - liveDurationSecs * 1000).toISOString(),
          focusText: liveFocusText || `Buddy Session with ${buddyName}`,
          sharedToSquare: false,
        }),
      })
    } catch (err) {
      console.error('Failed to log live session via API:', err)
    }

    const endMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender_id: 'system',
      content: `Session ended: Logged ${Math.floor(liveDurationSecs / 60)}m of ${liveDiscipline}. Credited to daily targets! ✓`,
      message_type: 'system',
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, endMsg])
  }

  // Format live timer display
  const m = Math.floor(liveDurationSecs / 60)
  const s = liveDurationSecs % 60
  const liveFormatted = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`

  if (loading) {
    return (
      <div className="command-center-container px-4 sm:px-6 pt-16 flex flex-col items-center justify-center space-y-2 min-h-[60vh] text-[#707070]">
        <CircleNotch size={24} className="animate-spin text-[#FBBF24]" />
        <p className="text-xs font-bold">Connecting to SynC chat...</p>
      </div>
    )
  }

  return (
    <div className="command-center-container flex flex-col min-h-screen min-h-[100dvh] h-screen h-[100dvh] max-h-[100dvh] bg-[#FAF6EE] overflow-hidden">
      {/* 1. The Header */}
      <div className="p-4 bg-white border-b border-[#E5E7EB] flex items-center justify-between z-10 shrink-0 gap-2">
        <div className="flex items-center gap-2.5 truncate flex-1 min-w-0">
          <button
            type="button"
            onClick={() => router.push('/sync')}
            className="p-1.5 rounded-xl text-[#707070] hover:text-[#0E0E0E] hover:bg-[#F3F4F6] transition-colors shrink-0"
          >
            <CaretLeft size={20} />
          </button>

          {/* Clickable Buddy Avatar & Name (Navigates to Public Profile) */}
          <Link
            href={`/profile/${buddyId}`}
            className="flex items-center gap-2.5 truncate hover:opacity-90 transition-opacity flex-1 min-w-0"
          >
            {/* Circular Avatar */}
            <div className="relative shrink-0">
              <div className="w-10 h-10 rounded-full bg-[#0E0E0E] text-white font-black text-sm flex items-center justify-center border-2 border-white ring-1 ring-[#E5E7EB] shadow-xs">
                {buddyInitial}
              </div>
              {buddyStatus === 'online' && (
                <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white" />
              )}
            </div>

            <div className="truncate">
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-black text-[#0E0E0E] truncate max-w-[140px] sm:max-w-[200px]">
                  {buddyName}
                </h2>
                <span className="flex items-center gap-0.5 text-[10px] font-black font-mono-tabular text-[#234537] bg-[#EBF3EE] px-1.5 py-0.5 rounded-md border border-[#234537]/25 shrink-0">
                  <Fire size={11} weight="fill" className="text-[#234537]" />
                  {buddyStreak}
                </span>
              </div>
              {/* Real-time Status Indicator */}
              <p className="text-[10px] text-[#707070] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>{buddyLastSeen}</span>
                <span>•</span>
                <span className="truncate max-w-[100px]">{buddyChurch}</span>
              </p>
            </div>
          </Link>
        </div>

        {/* Action Buttons: Timer Capsule Pill (Hidden for Square Connections) & Three-Dots Menu */}
        <div className="flex items-center gap-2 shrink-0">
          {isSquareConnection ? (
            <span className="px-2.5 py-1 rounded-full bg-[#EBF3EE] text-[#234537] text-[10px] font-extrabold border border-[#234537]/20 shrink-0">
              Square Connection
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setIsInviteModalOpen(true)}
              className="flex items-center gap-1.5 bg-[#0E0E0E] text-white px-3.5 py-1.5 rounded-full shadow-sm border border-white/15 hover:bg-[#262626] active:scale-95 transition-all text-xs font-black shrink-0 cursor-pointer"
              title="Clock-In Together"
            >
              <span className="w-2 h-2 rounded-full bg-[#FBBF24] animate-pulse shrink-0" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/assets/icon-timer-active.svg"
                alt="Clock-In"
                width={16}
                height={16}
                className="w-4 h-4 object-contain shrink-0"
              />
              <span>Clock-In</span>
            </button>
          )}

          <div className="relative">
            <button
              type="button"
              onClick={() => setIsMenuOpen((m) => !m)}
              className="p-2 rounded-xl text-[#707070] hover:text-[#0E0E0E] hover:bg-[#F3F4F6] transition-colors"
            >
              <DotsThreeVertical size={18} weight="bold" />
            </button>

            {/* Backdrop to close menu on outside click */}
            {isMenuOpen && (
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsMenuOpen(false)}
              />
            )}

            {isMenuOpen && (
              <div className="absolute right-0 top-11 z-50 w-52 bg-white border border-[#E5E7EB] rounded-2xl shadow-xl p-1.5 space-y-0.5 text-xs font-bold text-[#0E0E0E] animate-in zoom-in-95">
                {/* 1. Send Nudge (Disabled/Hidden for Square Connections) */}
                {!isSquareConnection && (
                  <button
                    type="button"
                    onClick={handleSendNudge}
                    className="w-full text-left p-2.5 rounded-xl hover:bg-[#FDF9F1] flex items-center gap-2.5"
                  >
                    <HandWaving size={16} weight="fill" className="text-[#FBBF24]" />
                    <span>Send Nudge</span>
                  </button>
                )}

                {/* 2. View Profile */}
                <Link
                  href={`/profile/${buddyId}`}
                  className="w-full text-left p-2.5 rounded-xl hover:bg-[#FAF6EE] flex items-center gap-2.5 block"
                >
                  <User size={16} className="text-[#707070]" />
                  <span>View Profile</span>
                </Link>

                {/* 3. Manage Permissions */}
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false)
                    setIsPermissionsModalOpen(true)
                  }}
                  className="w-full text-left p-2.5 rounded-xl hover:bg-[#FAF6EE] flex items-center gap-2.5"
                >
                  <ShieldWarning size={16} className="text-[#707070]" />
                  <span>Manage Permissions</span>
                </button>

                <div className="h-px bg-[#E5E7EB] my-1" />

                {/* 4. Remove Buddy */}
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false)
                    setIsRemoveBuddyConfirmOpen(true)
                  }}
                  className="w-full text-left p-2.5 rounded-xl hover:bg-rose-50 text-rose-600 flex items-center gap-2.5"
                >
                  <UserMinus size={16} />
                  <span>Remove Buddy</span>
                </button>

                {/* 5. Report User */}
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false)
                    setIsReportModalOpen(true)
                  }}
                  className="w-full text-left p-2.5 rounded-xl hover:bg-rose-50 text-rose-600 flex items-center gap-2.5"
                >
                  <Flag size={16} />
                  <span>Report User</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Anchored Banner for Square Connections */}
      {isSquareConnection && (
        <div className="bg-[#EBF3EE] border-b border-[#234537]/20 px-4 py-2 flex items-center justify-between text-xs text-[#234537] font-semibold shrink-0">
          <div className="flex items-center gap-1.5">
            <Globe size={14} className="text-[#234537] shrink-0" />
            <span>
              Square Connection • {remainingSquareMessages} message{remainingSquareMessages === 1 ? '' : 's'} remaining today
            </span>
          </div>
          <span className="text-[10px] uppercase font-bold tracking-wider opacity-75">3 msgs/day</span>
        </div>
      )}

      {/* Top Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-[#0E0E0E] text-white border border-[#FBBF24]/40 shadow-xl text-xs font-bold flex items-center gap-2 animate-in slide-in-from-top duration-200">
          <HandWaving size={15} weight="fill" className="text-[#FBBF24]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 2. The Feed (3 Distinct Message Types) */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="py-16 text-center space-y-2 flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-white border border-[#E5E7EB] flex items-center justify-center text-[#FBBF24] shadow-xs">
              <HandsPraying size={24} weight="fill" />
            </div>
            <p className="text-xs font-bold text-[#0E0E0E]">No messages yet</p>
            <p className="text-[11px] text-[#707070] max-w-xs">
              Send a greeting or tap the timer icon below to invite {buddyName} to a shared prayer or study clock-in!
            </p>
          </div>
        )}
        {messages.map((msg) => {
          const isMe = msg.sender_id === (currentUser?.id || 'me')

          // Type 3: Timer Invites (Large, Premium Black Interactive Cards with Hostless Lifecycle)
          if (msg.message_type === 'clockin_invite') {
            const discipline = msg.meta?.discipline || 'prayer'
            const durationMins = msg.meta?.durationMins || 15
            const focusText = msg.meta?.focusText
            const targetStartTime = msg.meta?.scheduledAt
              ? new Date(msg.meta.scheduledAt).getTime()
              : msg.meta?.startedAt
              ? new Date(msg.meta.startedAt).getTime()
              : 0

            const durationMs = durationMins * 60 * 1000
            const now = currentTimeTick

            // Single source of truth devotion state
            const devotionState = getDevotionState(targetStartTime, durationMins)
            const isScheduledInFuture = devotionState === 'scheduled'
            const isLiveNow = devotionState === 'live'
            const isExpired = devotionState === 'completed'

            const targetDateObj = targetStartTime > 0 ? new Date(targetStartTime) : new Date()
            const timeDisplay = targetDateObj.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })
            const isTomorrow = targetDateObj.getDate() !== new Date(now).getDate()
            const datePrefix = isTomorrow ? 'Tomorrow' : 'Today'

            // Countdown for scheduled
            const msUntilStart = Math.max(0, targetStartTime - now)
            const minsUntilStart = Math.max(1, Math.round(msUntilStart / 60000))
            const hoursUntilStart = Math.floor(minsUntilStart / 60)

            // Remaining time for live
            const remainingMins = Math.max(1, Math.ceil(getRemainingSeconds(targetStartTime, durationMins) / 60))

            return (
              <div key={msg.id} className="w-full flex justify-center my-3">
                <div
                  onClick={() => {
                    if (isLiveNow) handleJoinSession(msg)
                  }}
                  className={`w-full max-w-sm rounded-3xl bg-[#0E0E0E] text-white border p-5 shadow-2xl space-y-3.5 animate-in zoom-in-95 transition-all ${
                    isLiveNow
                      ? 'border-[#FBBF24]/50 cursor-pointer shadow-[0_10px_30px_rgba(251,191,36,0.15)]'
                      : isScheduledInFuture
                      ? 'border-[#FBBF24]/30'
                      : 'border-white/10 opacity-75'
                  }`}
                >
                  {/* Top: Gold Icon Badge & Details */}
                  <div className="flex items-center justify-between pb-1">
                    <div className="flex items-center gap-3">
                      {/* Distinct Gold Circle Badge */}
                      <div className="w-11 h-11 rounded-full bg-[#FBBF24] text-[#0E0E0E] flex items-center justify-center font-bold shadow-md shrink-0">
                        {discipline === 'prayer' ? (
                          <HandsPraying size={22} weight="fill" />
                        ) : (
                          <BookOpen size={22} weight="bold" />
                        )}
                      </div>

                      {/* Header Titles */}
                      <div>
                        <h4 className="text-sm font-black text-white tracking-tight">
                          Clock-in Invite
                        </h4>
                        <span className="text-xs text-white/60 font-mono-tabular">
                          {durationMins} mins • {discipline}
                        </span>
                      </div>
                    </div>

                    {/* Dynamic Status Pill */}
                    {isScheduledInFuture ? (
                      <span className="px-2.5 py-1 rounded-full bg-[#FBBF24]/15 text-[#FBBF24] border border-[#FBBF24]/30 text-[9px] font-black uppercase tracking-wider flex items-center gap-1">
                        <CalendarCheck size={11} weight="bold" />
                        <span>{datePrefix} {timeDisplay}</span>
                      </span>
                    ) : isLiveNow ? (
                      <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                        <span>LIVE NOW</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/40 text-[9px] font-black uppercase tracking-wider">
                        COMPLETED
                      </span>
                    )}
                  </div>

                  {/* Shared Focus Intention: Translucent Frosted-Glass Block */}
                  {focusText && (
                    <div className="p-3.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 text-xs text-white/90 italic flex items-start gap-2 shadow-inner">
                      <Quotes size={15} className="text-[#FBBF24] shrink-0 mt-0.5" />
                      <span className="leading-relaxed">&ldquo;{focusText}&rdquo;</span>
                    </div>
                  )}

                  {/* Interactive Button Based on Real-Time State */}
                  {isScheduledInFuture ? (
                    <div className="w-full py-3 px-4 rounded-2xl bg-white/5 border border-white/15 text-[#FBBF24] font-bold text-xs flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock size={15} weight="bold" />
                        <span>Starts at {timeDisplay}</span>
                      </div>
                      <span className="text-[10px] text-white/50 font-mono-tabular">
                        in {hoursUntilStart > 0 ? `${hoursUntilStart}h ` : ''}{minsUntilStart % 60}m
                      </span>
                    </div>
                  ) : isLiveNow ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleJoinSession(msg)
                      }}
                      className="w-full py-3.5 px-4 rounded-2xl bg-white text-[#0E0E0E] hover:bg-slate-100 active:scale-95 transition-all text-xs font-black flex items-center justify-center gap-2 shadow-lg cursor-pointer"
                    >
                      <Play size={15} weight="fill" className="text-[#FBBF24]" />
                      <span>{isLiveOverlayOpen ? 'View Active Session' : 'Join Now'} ({remainingMins}m left)</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="w-full py-3 px-4 rounded-2xl bg-white/10 text-white/40 font-bold text-xs cursor-not-allowed text-center"
                    >
                      Session Ended
                    </button>
                  )}
                </div>
              </div>
            )
          }

          // Type 2: System Updates (Centralized Gray Text Blocks)
          if (msg.message_type === 'system') {
            return (
              <div key={msg.id} className="w-full flex justify-center my-1.5">
                <span className="px-3.5 py-1.5 rounded-full bg-[#E5E7EB]/80 text-[10px] font-bold text-[#374151] max-w-xs text-center shadow-xs">
                  {msg.content}
                </span>
              </div>
            )
          }

          // Type 1: Standard Texts (Sent Gold/Onyx vs Received Gray/White)
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[78%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed shadow-xs ${
                  isMe
                    ? 'bg-[#0E0E0E] text-white rounded-br-xs'
                    : 'bg-white text-[#0E0E0E] border border-[#E5E7EB] rounded-bl-xs'
                }`}
              >
                <p className="whitespace-pre-line">{msg.content}</p>
              </div>
              <span className="text-[9px] text-[#9095A1] mt-0.5 px-1 font-mono-tabular">
                {new Date(msg.created_at).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* 3. The Action Bar (Bottom) */}
      <form
        onSubmit={handleSendMessage}
        className="p-3 bg-white border-t border-[#E5E7EB] flex items-center gap-2 shrink-0 pb-6 sm:pb-3"
      >
        {/* Prominent Timer Button on the Far Left (Hidden for Square Connections) */}
        {!isSquareConnection && (
          <button
            type="button"
            onClick={() => setIsInviteModalOpen(true)}
            className="p-2.5 rounded-2xl bg-[#FDF9F1] border border-[#FBBF24]/50 text-[#FBBF24] hover:bg-[#FBBF24] hover:text-white transition-all shadow-xs shrink-0"
            title="Setup Clock-In Timer"
          >
            <Clock size={20} weight="bold" />
          </button>
        )}

        {/* Text Input Field */}
        <input
          type="text"
          disabled={isSquareConnection && remainingSquareMessages <= 0}
          value={inputContent}
          onChange={(e) => setInputContent(e.target.value)}
          placeholder={
            isSquareConnection && remainingSquareMessages <= 0
              ? 'Daily limit reached (3/3 messages for Square Connections)'
              : `Message ${buddyName}...`
          }
          className="flex-1 px-3.5 py-2.5 bg-[#FAF6EE] border border-[#E5E7EB] rounded-2xl text-xs text-[#0E0E0E] placeholder-[#9095A1] focus:outline-none focus:border-[#FBBF24] focus:bg-white transition-all shadow-xs disabled:opacity-50"
        />

        {/* Attachment (Paperclip) Icon */}
        <button
          type="button"
          onClick={() => alert('Attachment upload ready')}
          className="p-2 rounded-xl text-[#707070] hover:text-[#0E0E0E] hover:bg-[#F3F4F6] transition-colors shrink-0"
          title="Attach file"
        >
          <Paperclip size={18} />
        </button>

        {/* Voice-Note (Microphone) Icon */}
        <button
          type="button"
          onClick={() => alert('Hold to record voice note')}
          className="p-2 rounded-xl text-[#707070] hover:text-[#0E0E0E] hover:bg-[#F3F4F6] transition-colors shrink-0"
          title="Record voice note"
        >
          <Microphone size={18} />
        </button>

        {/* Send Button */}
        <button
          type="submit"
          disabled={!inputContent.trim() || (isSquareConnection && remainingSquareMessages <= 0)}
          className="p-2.5 rounded-2xl bg-[#0E0E0E] text-white hover:bg-[#262626] disabled:opacity-30 transition-all shrink-0"
        >
          <PaperPlaneTilt size={16} weight="fill" />
        </button>
      </form>

      {/* ========================================================================= */}
      {/* 4. MODAL: TIMER SETUP MODAL (SLIDER & GOAL CONFIGURATION)                  */}
      {/* ========================================================================= */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-sm bg-[#FAF6EE] border border-[#E5E7EB] rounded-3xl p-5 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-1 border-b border-[#E5E7EB]">
              <h3 className="text-sm font-bold text-[#0E0E0E]">Timer Setup</h3>
              <button onClick={() => setIsInviteModalOpen(false)} className="text-[#707070]">
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleSendClockInInvite()
              }}
              className="space-y-4"
            >
              <div>
                <label className="text-[11px] font-bold text-[#707070] block mb-1.5">Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setInviteDiscipline('prayer')}
                    className={`py-2.5 px-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                      inviteDiscipline === 'prayer'
                        ? 'bg-[#0E0E0E] text-white shadow-xs'
                        : 'bg-white border border-[#E5E7EB] text-[#707070]'
                    }`}
                  >
                    <HandsPraying size={15} weight="fill" />
                    <span>Prayer</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setInviteDiscipline('study')}
                    className={`py-2.5 px-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                      inviteDiscipline === 'study'
                        ? 'bg-[#0E0E0E] text-white shadow-xs'
                        : 'bg-white border border-[#E5E7EB] text-[#707070]'
                    }`}
                  >
                    <BookOpen size={15} />
                    <span>Study</span>
                  </button>
                </div>
              </div>

              {/* Duration Slider & Clickable Direct Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-[#707070]">Duration</label>
                  <div className="flex items-center gap-1 bg-white border border-[#E5E7EB] rounded-xl px-2.5 py-0.5 shadow-xs focus-within:border-[#FBBF24] focus-within:ring-1 focus-within:ring-[#FBBF24]">
                    <input
                      type="number"
                      min={1}
                      max={300}
                      value={inviteDuration || ''}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10)
                        setInviteDuration(isNaN(val) ? 1 : Math.max(1, Math.min(300, val)))
                      }}
                      className="w-10 text-xs font-black font-mono-tabular text-[#0E0E0E] text-center focus:outline-none bg-transparent"
                    />
                    <span className="text-[10px] font-bold text-[#707070]">min</span>
                  </div>
                </div>
                <input
                  type="range"
                  min={1}
                  max={120}
                  step={1}
                  value={Math.min(120, inviteDuration)}
                  onChange={(e) => setInviteDuration(Number(e.target.value))}
                  className="w-full accent-[#FBBF24] cursor-pointer"
                />
                <div className="flex justify-between text-[9px] text-[#9095A1] font-mono-tabular">
                  <span>1m</span>
                  <span>30m</span>
                  <span>60m</span>
                  <span>120m</span>
                </div>
              </div>

              {/* Optional Focus Intention */}
              <div>
                <label className="text-[11px] font-bold text-[#707070] block mb-1">
                  Focus Intention (Optional)
                </label>
                <input
                  type="text"
                  value={inviteFocus}
                  onChange={(e) => setInviteFocus(e.target.value)}
                  placeholder="e.g. Surrender & Divine Peace"
                  className="w-full px-3.5 py-2.5 bg-white border border-[#E5E7EB] rounded-2xl text-xs text-[#0E0E0E] focus:outline-none focus:border-[#FBBF24]"
                />
              </div>

              {/* Automated Schedule Option (Hostless Sync) */}
              <div className="pt-2 border-t border-[#E5E7EB] space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-bold text-[#0E0E0E] flex items-center gap-1.5">
                      <CalendarCheck size={14} className="text-[#FBBF24]" weight="bold" />
                      <span>Schedule for Later</span>
                    </label>
                    <p className="text-[10px] text-[#707070]">
                      Hostless Sync: Starts automatically at set time
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsScheduleEnabled((s) => !s)}
                    className={`w-10 h-5 rounded-full transition-colors relative p-0.5 ${
                      isScheduleEnabled ? 'bg-[#0E0E0E]' : 'bg-[#E5E7EB]'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white transition-transform ${
                        isScheduleEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {isScheduleEnabled && (
                  <div className="space-y-2 animate-in fade-in-50">
                    <label className="text-[10px] font-bold text-[#707070] block">
                      Target Start Time
                    </label>
                    <div className="grid grid-cols-2 gap-1.5 text-xs">
                      <button
                        type="button"
                        onClick={() => setSchedulePreset('tomorrow_6am')}
                        className={`p-2 rounded-xl text-left border transition-all ${
                          schedulePreset === 'tomorrow_6am'
                            ? 'bg-[#0E0E0E] text-white border-[#0E0E0E] font-bold'
                            : 'bg-white border-[#E5E7EB] text-[#707070]'
                        }`}
                      >
                        <p className="text-[9px] uppercase tracking-wider opacity-70">Tomorrow</p>
                        <p className="font-mono-tabular font-bold">6:00 AM</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSchedulePreset('tomorrow_7am')}
                        className={`p-2 rounded-xl text-left border transition-all ${
                          schedulePreset === 'tomorrow_7am'
                            ? 'bg-[#0E0E0E] text-white border-[#0E0E0E] font-bold'
                            : 'bg-white border-[#E5E7EB] text-[#707070]'
                        }`}
                      >
                        <p className="text-[9px] uppercase tracking-wider opacity-70">Tomorrow</p>
                        <p className="font-mono-tabular font-bold">7:00 AM</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSchedulePreset('today_8pm')}
                        className={`p-2 rounded-xl text-left border transition-all ${
                          schedulePreset === 'today_8pm'
                            ? 'bg-[#0E0E0E] text-white border-[#0E0E0E] font-bold'
                            : 'bg-white border-[#E5E7EB] text-[#707070]'
                        }`}
                      >
                        <p className="text-[9px] uppercase tracking-wider opacity-70">Today</p>
                        <p className="font-mono-tabular font-bold">8:00 PM</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSchedulePreset('custom')}
                        className={`p-2 rounded-xl text-left border transition-all ${
                          schedulePreset === 'custom'
                            ? 'bg-[#0E0E0E] text-white border-[#0E0E0E] font-bold'
                            : 'bg-white border-[#E5E7EB] text-[#707070]'
                        }`}
                      >
                        <p className="text-[9px] uppercase tracking-wider opacity-70">Custom</p>
                        <p className="font-mono-tabular font-bold">Specific Time</p>
                      </button>
                    </div>

                    {schedulePreset === 'custom' && (
                      <input
                        type="time"
                        value={customScheduledTime}
                        onChange={(e) => setCustomScheduledTime(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-[#E5E7EB] rounded-xl text-xs font-mono-tabular"
                      />
                    )}
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="w-full bg-[#0E0E0E] text-white py-3.5 rounded-2xl font-bold text-xs shadow-md hover:bg-[#262626] transition-all flex items-center justify-center gap-2"
              >
                {isScheduleEnabled ? (
                  <>
                    <CalendarCheck size={16} className="text-[#FBBF24]" weight="bold" />
                    <span>Schedule Clock-In (Hostless Sync)</span>
                  </>
                ) : (
                  <span>Send Clock-In Invite</span>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Manage Permissions Modal */}
      {isPermissionsModalOpen && (
        <div className="fixed inset-0 z-60 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
          <div className="fixed inset-0" onClick={() => setIsPermissionsModalOpen(false)} />

          <div className="relative z-10 w-full max-w-md bg-[#FAF6EE] border border-[#E5E7EB] rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 sm:p-6 space-y-4 animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between pb-2 border-b border-[#E5E7EB]">
              <h3 className="text-sm font-bold text-[#0E0E0E]">Manage Buddy Permissions</h3>
              <button onClick={() => setIsPermissionsModalOpen(false)} className="text-[#707070]">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3 pt-1 text-xs">
              {/* Share History Toggle */}
              <div className="faith-card p-3.5 flex items-center justify-between bg-white">
                <div>
                  <p className="font-bold text-[#0E0E0E]">Share Session History</p>
                  <p className="text-[10px] text-[#707070]">Allow {buddyName} to see your completed clock-ins</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShareHistory((s) => !s)}
                  className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                    shareHistory ? 'bg-[#0E0E0E]' : 'bg-[#E5E7EB]'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      shareHistory ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Allow Nudges Toggle */}
              <div className="faith-card p-3.5 flex items-center justify-between bg-white">
                <div>
                  <p className="font-bold text-[#0E0E0E]">Allow Encouragement Nudges</p>
                  <p className="text-[10px] text-[#707070]">Receive spiritual reminders from {buddyName}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setAllowNudge((s) => !s)}
                  className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                    allowNudge ? 'bg-[#0E0E0E]' : 'bg-[#E5E7EB]'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      allowNudge ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Share Live Sessions Toggle */}
              <div className="faith-card p-3.5 flex items-center justify-between bg-white">
                <div>
                  <p className="font-bold text-[#0E0E0E]">Live 2-Way Clock-In Invites</p>
                  <p className="text-[10px] text-[#707070]">Allow synchronized devotion rooms & audio</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShareLiveSession((s) => !s)}
                  className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                    shareLiveSession ? 'bg-[#0E0E0E]' : 'bg-[#E5E7EB]'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      shareLiveSession ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsPermissionsModalOpen(false)}
                className="w-full py-3.5 bg-[#0E0E0E] text-white font-bold text-xs rounded-2xl shadow-md mt-2"
              >
                Save Permissions
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Buddy Confirmation Modal */}
      {isRemoveBuddyConfirmOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-xs bg-[#FAF6EE] border border-[#E5E7EB] rounded-3xl p-5 space-y-3 shadow-2xl text-center animate-in zoom-in-95">
            <h3 className="text-sm font-black text-[#0E0E0E]">Remove Buddy?</h3>
            <p className="text-xs text-[#707070] leading-relaxed">
              This will remove {buddyName} from your accountability list and delete your shared
              chat history.
            </p>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsRemoveBuddyConfirmOpen(false)}
                className="py-2.5 px-3 rounded-xl bg-white border border-[#E5E7EB] text-xs font-bold text-[#707070]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRemoveBuddy}
                className="py-2.5 px-3 rounded-xl bg-rose-600 text-white text-xs font-bold"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report User Modal */}
      {isReportModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-xs bg-[#FAF6EE] border border-[#E5E7EB] rounded-3xl p-5 space-y-3 shadow-2xl text-center animate-in zoom-in-95">
            <h3 className="text-sm font-black text-[#0E0E0E]">Report User</h3>
            <p className="text-xs text-[#707070] leading-relaxed">
              Thank you for keeping our community safe. Our team will review this user&apos;s activity.
            </p>
            <button
              type="button"
              onClick={() => setIsReportModalOpen(false)}
              className="w-full py-2.5 px-3 rounded-xl bg-[#0E0E0E] text-white text-xs font-bold"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. THE LIVE 1-ON-1 OVERLAY UI                                             */}
      {/* ========================================================================= */}
      {isLiveOverlayOpen && (
        <div className="fixed inset-0 z-50 bg-[#0E0E0E] text-white p-6 flex flex-col justify-between animate-in slide-in-from-bottom duration-300">
          <div className="flex items-center justify-between">
            <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-black flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              LIVE 2-WAY SYNC
            </span>

            <button
              type="button"
              onClick={() => setShowEndConfirm(true)}
              className="py-1.5 px-3 rounded-xl bg-white/10 hover:bg-rose-600 text-white font-bold text-xs flex items-center gap-1 transition-all"
            >
              <X size={16} />
              <span>Exit</span>
            </button>
          </div>

          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="relative flex items-center justify-center">
              <div
                className={`w-20 h-20 rounded-full bg-[#FBBF24] text-white font-black text-xl flex items-center justify-center border-4 border-white shadow-2xl relative z-10 ${
                  !isMicMuted ? 'ring-4 ring-emerald-500/60' : ''
                }`}
              >
                <span>Me</span>
                <button
                  type="button"
                  onClick={() => setIsMicMuted((m) => !m)}
                  className={`absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center border-2 border-white shadow-md ${
                    isMicMuted ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'
                  }`}
                  title={isMicMuted ? 'Unmute Mic' : 'Mute Mic'}
                >
                  {isMicMuted ? <MicrophoneSlash size={14} /> : <Microphone size={14} />}
                </button>
              </div>

              <div
                className={`w-20 h-20 rounded-full bg-white text-[#0E0E0E] font-black text-xl flex items-center justify-center border-4 border-white shadow-2xl -ml-6 relative z-0 ${
                  isBuddySpeaking ? 'ring-4 ring-[#FBBF24] animate-pulse' : ''
                }`}
              >
                <span>{buddyInitial}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-3.5 py-1.5 rounded-full text-xs font-medium border border-white/10">
              <SpeakerHigh size={15} className="text-[#FBBF24]" />
              <span>
                {isBuddySpeaking
                  ? `${buddyName} is speaking...`
                  : isMicMuted
                  ? 'Your Mic is Muted (Tap mic to speak)'
                  : 'WebRTC 2-Way Audio Connected'}
              </span>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="relative w-60 h-60 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 200 200">
                <circle
                  cx="100"
                  cy="100"
                  r="90"
                  stroke="rgba(255,255,255,0.1)"
                  strokeWidth="8"
                  fill="transparent"
                />
                <circle
                  cx="100"
                  cy="100"
                  r="90"
                  stroke="#FBBF24"
                  className="transition-all duration-1000"
                  strokeWidth="8"
                  strokeDasharray={DASH_ARRAY}
                  strokeDashoffset={
                    DASH_ARRAY - ((liveDurationSecs % (liveTargetMins * 60)) / (liveTargetMins * 60)) * DASH_ARRAY
                  }
                  strokeLinecap="round"
                  fill="transparent"
                />
              </svg>

              <div className="absolute flex flex-col items-center">
                <span className="text-4xl font-extrabold font-mono-tabular tracking-tight">
                  {liveFormatted}
                </span>
                <span className="text-xs font-black uppercase tracking-widest text-[#FBBF24] mt-1 capitalize">
                  {liveDiscipline}
                </span>
                <span className="text-[10px] text-slate-400 font-mono-tabular">
                  Target: {liveTargetMins}m
                </span>
              </div>
            </div>

            {liveFocusText && (
              <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-xs italic text-slate-200 max-w-xs text-center shadow-lg">
                &ldquo;{liveFocusText}&rdquo;
              </div>
            )}
          </div>

          <div className="flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => setShowEndConfirm(true)}
              className="py-3 px-6 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-2 shadow-lg active:scale-95 transition-all"
            >
              <Square size={16} weight="fill" />
              <span>Finish & Credit Target</span>
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Modal to End Session */}
      {showEndConfirm && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-xs bg-[#FAF6EE] border border-[#E5E7EB] rounded-3xl p-5 space-y-3 shadow-2xl text-center animate-in zoom-in-95">
            <h3 className="text-sm font-black text-[#0E0E0E]">End Live Clock-In?</h3>
            <p className="text-xs text-[#707070] leading-relaxed">
              Your {Math.floor(liveDurationSecs / 60)} minute session will be saved and credited
              toward your daily goals.
            </p>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowEndConfirm(false)}
                className="py-2.5 px-3 rounded-xl bg-white border border-[#E5E7EB] text-xs font-bold text-[#707070]"
              >
                Keep Going
              </button>
              <button
                type="button"
                onClick={handleConfirmEndSession}
                className="py-2.5 px-3 rounded-xl bg-[#0E0E0E] text-white text-xs font-bold"
              >
                End & Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
