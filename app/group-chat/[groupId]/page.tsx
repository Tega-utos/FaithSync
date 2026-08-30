'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  CaretLeft,
  PaperPlaneTilt,
  Users,
  Sparkle,
  Fire,
  Clock,
  Check,
  DotsThreeVertical,
  Play,
  Square,
  BookOpen,
  Info,
  Bell,
  SignOut,
  X,
  HandsPraying,
  Microphone,
  MicrophoneSlash,
  SpeakerHigh,
  Lightning,
  HandWaving,
  ThumbsUp,
  Heart,
  Crown,
  CircleNotch,
  Paperclip,
  Trash,
  UserMinus,
  CheckCircle,
  Quotes,
  CalendarCheck,
  CalendarBlank,
} from '@phosphor-icons/react'
import { createClient } from '@/lib/supabase/client'
import { useTimer } from '@/context/TimerContext'
import { playChime } from '@/components/audio/Chime'
import { getDevotionState, getElapsedSeconds, getRemainingSeconds } from '@/lib/devotionSync'

const DASH_ARRAY = 565.48

interface GroupChatMessage {
  id: string
  sender_id: string
  sender_name: string
  sender_initial: string
  content: string
  message_type: 'text' | 'system' | 'clockin_invite'
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

interface Participant {
  id: string
  name: string
  initial: string
  isHost: boolean
  isSpeaking: boolean
  isMuted: boolean
}

interface FloatingNudge {
  id: string
  senderName: string
  emoji: string
  text: string
}

import { fetchGroupMessages, sendGroupMessage } from '@/features/groups/services/groupService'

export default function GroupChatPage() {
  const params = useParams()
  const router = useRouter()
  const groupId = params?.groupId as string

  const messagesEndRef = useRef<HTMLDivElement>(null)

  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [groupName, setGroupName] = useState('Faith Group')
  const [memberCount, setMemberCount] = useState(1)
  const [isGroupLive, setIsGroupLive] = useState(false)

  const [messages, setMessages] = useState<GroupChatMessage[]>([])
  const [inputContent, setInputContent] = useState('')

  // Header Three-Dots Menu & Modals
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isNotifSheetOpen, setIsNotifSheetOpen] = useState(false)
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false)
  const [pushNotifsEnabled, setPushNotifsEnabled] = useState(true)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Clock-in Setup Modal & Scheduling
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false)
  const [inviteDiscipline, setInviteDiscipline] = useState<'prayer' | 'study'>('study')
  const [inviteDuration, setInviteDuration] = useState(30)
  const [inviteFocus, setInviteFocus] = useState('Hebrews 11 - Faith & Endurance')
  const [isScheduleEnabled, setIsScheduleEnabled] = useState(false)
  const [schedulePreset, setSchedulePreset] = useState<'tomorrow_6am' | 'tomorrow_7am' | 'today_8pm' | 'custom'>('tomorrow_6am')
  const [customScheduledTime, setCustomScheduledTime] = useState('')

  // Live Cohort Overlay State
  const [isLiveOverlayOpen, setIsLiveOverlayOpen] = useState(false)
  const [isHostUser, setIsHostUser] = useState(false)
  const [liveDiscipline, setLiveDiscipline] = useState<'prayer' | 'study'>('study')
  const [liveDurationSecs, setLiveDurationSecs] = useState(0)
  const [liveTargetMins, setLiveTargetMins] = useState(30)
  const [liveFocusText, setLiveFocusText] = useState('Hebrews 11 - Faith & Endurance')
  // Auto-Mute (Group Mode): Participants are muted by default to prevent chaotic audio feedback
  const [isMicMuted, setIsMicMuted] = useState(true)

  // Participants in Grid
  const [participants, setParticipants] = useState<Participant[]>([])

  // Real-time Floating Nudges
  const [floatingNudges, setFloatingNudges] = useState<FloatingNudge[]>([])
  const [totalNudgesCount, setTotalNudgesCount] = useState(0)

  // End Session Summary Screen
  const [isSessionCompleteScreen, setIsSessionCompleteScreen] = useState(false)

  useEffect(() => {
    async function loadGroupChat() {
      if (!groupId) return
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        setCurrentUser(user)

        // 1. Fetch real Group details
        const { data: grp } = await (supabase
          .from('groups') as any)
          .select('id, name, created_by')
          .eq('id', groupId)
          .maybeSingle()

        if (grp) {
          setGroupName(grp.name)
          if (user && grp.created_by === user.id) {
            setIsHostUser(true)
          }
        }

        // 2. Fetch real member count
        const { count } = await (supabase
          .from('group_members') as any)
          .select('*', { count: 'exact', head: true })
          .eq('group_id', groupId)

        if (count !== null) setMemberCount(count || 1)

        // 3. Fetch real messages
        const realMsgs = await fetchGroupMessages(groupId)
        setMessages(realMsgs as any)
      } catch (err) {
        console.error('Group chat error:', err)
      } finally {
        setLoading(false)
      }
    }

    loadGroupChat()
  }, [groupId])

  // Realtime subscription for group messages
  useEffect(() => {
    if (!groupId) return
    const supabase = createClient()
    const channel = supabase
      .channel(`group_messages_${groupId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'group_messages' },
        async () => {
          const updated = await fetchGroupMessages(groupId)
          setMessages(updated as any)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [groupId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Live Timer
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

  // Send Chat Message (Optimistic UI with Rollback)
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputContent.trim() || !currentUser) return

    const content = inputContent.trim()
    setInputContent('')

    const tempId = `temp-${Date.now()}`
    const optMsg: GroupChatMessage = {
      id: tempId,
      sender_id: currentUser.id,
      content,
      message_type: 'text',
      created_at: new Date().toISOString(),
      sender_name: currentUser.user_metadata?.full_name || 'Me',
      sender_initial: (currentUser.user_metadata?.full_name || 'M').charAt(0).toUpperCase(),
    }
    setMessages((prev) => [...prev, optMsg])

    try {
      const sent = await sendGroupMessage(groupId, content, 'text')
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

  // Real-time Clock Ticker for Hostless Scheduled Sessions
  const [currentTimeTick, setCurrentTimeTick] = useState(Date.now())
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTimeTick(Date.now())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Join Active Group Session from Chat Bubble (Hostless Sync)
  const handleJoinGroupSession = (msg: GroupChatMessage) => {
    const discipline = msg.meta?.discipline || 'study'
    const duration = msg.meta?.durationMins || 30
    const focus = msg.meta?.focusText || 'Hebrews 11 - Faith & Endurance'

    const targetStartTime = msg.meta?.scheduledAt
      ? new Date(msg.meta.scheduledAt).getTime()
      : msg.meta?.startedAt
      ? new Date(msg.meta.startedAt).getTime()
      : Date.now()

    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - targetStartTime) / 1000))
    const totalDurationSecs = duration * 60

    if (elapsedSeconds >= totalDurationSecs) {
      alert('This group cohort session has already ended.')
      return
    }

    setLiveDiscipline(discipline)
    setLiveTargetMins(duration)
    setLiveFocusText(focus)
    setLiveDurationSecs(elapsedSeconds)
    setIsLiveOverlayOpen(true)
    playChime()
  }

  // Setup Timer & Send Group Clock-In Invite (Instant or Scheduled)
  const handleSendGroupClockInInvite = async () => {
    setIsInviteModalOpen(false)

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

    const roomId = `group-${groupId}-${Date.now()}`
    const myName = currentUser?.user_metadata?.full_name || 'A Leader'

    const contentText = isScheduleEnabled
      ? `Scheduled a group ${inviteDuration} min ${inviteDiscipline} session for ${new Date(scheduledAtISO).toLocaleDateString([], { weekday: 'short' })} at ${new Date(scheduledAtISO).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}`
      : `Group Clock-In Invite: ${inviteDuration} min ${inviteDiscipline}`

    const metaObj = {
      discipline: inviteDiscipline,
      durationMins: inviteDuration,
      focusText: inviteFocus.trim() || 'Hebrews 11 - Faith & Endurance',
      isScheduled: isScheduleEnabled,
      scheduledAt: isScheduleEnabled ? scheduledAtISO : undefined,
      startedAt: isScheduleEnabled ? scheduledAtISO : new Date().toISOString(),
    }

    const sent = await sendGroupMessage(groupId, contentText, 'clockin_invite', metaObj)
    if (sent) {
      setMessages((prev) => [...prev, sent as any])
    }

    setToastMessage(isScheduleEnabled ? `Cohort scheduled for ${new Date(scheduledAtISO).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })} ⏱️` : `Group clock-in invite posted! ⏱️`)
    setTimeout(() => setToastMessage(null), 3000)

    try {
      await fetch('/api/session/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start',
          liveRoomId: roomId,
          discipline: inviteDiscipline,
          targetMins: inviteDuration,
          focusText: inviteFocus.trim() || 'Hebrews 11 - Faith & Endurance',
          isGroup: true,
        }),
      })

      await fetch('/api/notifications/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send',
          groupId,
          type: 'wave',
          title: `Live ${groupName} Cohort`,
          message: `${myName} ${isScheduleEnabled ? 'scheduled a session' : 'started a live session'} in ${groupName}!`,
          url: `/group-chat/${groupId}`,
        }),
      })
    } catch (err) {
      console.log('Group clockin API note:', err)
    }
  }

  // Send Floating Nudge reaction
  const handleSendLiveNudge = (emoji: string, text: string) => {
    const nudgeId = `fn-${Date.now()}`
    const newNudge: FloatingNudge = {
      id: nudgeId,
      senderName: 'Me',
      emoji,
      text,
    }

    setFloatingNudges((prev) => [...prev, newNudge])
    setTotalNudgesCount((c) => c + 1)

    setTimeout(() => {
      setFloatingNudges((prev) => prev.filter((n) => n.id !== nudgeId))
    }, 3500)
  }

  // End Live Session
  const handleEndLiveSession = async () => {
    setIsLiveOverlayOpen(false)
    setIsGroupLive(false)

    if (isHostUser) {
      setIsSessionCompleteScreen(true)
    }

    try {
      const roomId = `group-${groupId}`
      await fetch('/api/session/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'end',
          liveRoomId: roomId,
          discipline: liveDiscipline,
          elapsedSeconds: liveDurationSecs,
          targetMins: liveTargetMins,
          focusText: `Group Session: ${liveFocusText}`,
        }),
      })
    } catch (err) {
      console.error('Failed to log group session via API:', err)
    }
  }

  // Format live timer
  const m = Math.floor(liveDurationSecs / 60)
  const s = liveDurationSecs % 60
  const liveFormatted = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`

  if (loading) {
    return (
      <div className="command-center-container px-4 sm:px-6 pt-16 flex flex-col items-center justify-center space-y-2 min-h-[60vh] text-[#707070]">
        <CircleNotch size={24} className="animate-spin text-[#FBBF24]" />
        <p className="text-xs font-bold">Connecting to Group Chat...</p>
      </div>
    )
  }

  return (
    <div className="command-center-container flex flex-col min-h-screen min-h-[100dvh] h-screen h-[100dvh] max-h-[100dvh] bg-[#FAF6EE] overflow-hidden">
      {/* 1. Header (Group Stack Avatar, Name, Member Count, LIVE badge, Settings) */}
      <div className="p-4 bg-white border-b border-[#E5E7EB] flex items-center justify-between z-10 shrink-0 gap-2">
        <div className="flex items-center gap-2 truncate flex-1 min-w-0">
          <button
            type="button"
            onClick={() => router.push('/sync')}
            className="p-1.5 rounded-xl text-[#707070] hover:text-[#0E0E0E] hover:bg-[#F3F4F6] transition-colors shrink-0"
          >
            <CaretLeft size={20} />
          </button>

          {/* Clickable Group Title & Stack Avatar (Navigates to Group Info) */}
          <Link
            href={`/group-info/${groupId}`}
            className="flex items-center gap-2.5 truncate hover:opacity-90 transition-opacity flex-1 min-w-0"
          >
            <div className="w-8 h-8 rounded-full bg-[#0E0E0E] text-[#FBBF24] text-xs font-black flex items-center justify-center border-2 border-white ring-1 ring-[#E5E7EB] shadow-xs shrink-0">
              {groupName.charAt(0).toUpperCase()}
            </div>

            <div className="truncate">
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-black text-[#0E0E0E] truncate">{groupName}</h2>
                {isGroupLive && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 border border-emerald-500/30 text-[9px] font-black uppercase flex items-center gap-1 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                    LIVE
                  </span>
                )}
              </div>
              <p className="text-[10px] text-[#707070] font-medium">{memberCount} members</p>
            </div>
          </Link>
        </div>

        {/* Action Buttons: Timer Capsule Pill & Three-Dots Menu */}
        <div className="flex items-center gap-2 shrink-0">
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

          <div className="relative">
            <button
              type="button"
              onClick={() => setIsMenuOpen((s) => !s)}
              className="p-2 rounded-xl text-[#707070] hover:text-[#0E0E0E] hover:bg-[#F3F4F6] transition-colors"
              title="Group Menu"
            >
              <DotsThreeVertical size={18} weight="bold" />
            </button>

            {/* Backdrop to close menu when clicking outside */}
            {isMenuOpen && (
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsMenuOpen(false)}
              />
            )}

            {/* Three Dots Dropdown List */}
            {isMenuOpen && (
              <div className="absolute right-0 top-11 z-50 w-52 bg-white border border-[#E5E7EB] rounded-2xl shadow-xl p-1.5 space-y-0.5 text-xs font-bold text-[#0E0E0E] animate-in zoom-in-95">
                {/* 1. Send Nudge */}
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false)
                    const nudgeMsg: GroupChatMessage = {
                      id: `gmsg-${Date.now()}`,
                      sender_id: 'system',
                      sender_name: 'System',
                      sender_initial: 'FS',
                      content: 'You sent a nudge to the group: Keep showing up 👋',
                      message_type: 'system',
                      created_at: new Date().toISOString(),
                    }
                    setMessages((prev) => [...prev, nudgeMsg])
                  }}
                  className="w-full text-left p-2.5 rounded-xl hover:bg-[#FDF9F1] flex items-center gap-2.5"
                >
                  <HandWaving size={16} weight="fill" className="text-[#FBBF24]" />
                  <span>Send Nudge</span>
                </button>

                {/* 2. Group Info */}
                <Link
                  href={`/group-info/${groupId}`}
                  className="w-full text-left p-2.5 rounded-xl hover:bg-[#FAF6EE] flex items-center gap-2.5 block"
                >
                  <Info size={16} className="text-[#707070]" />
                  <span>Group Info</span>
                </Link>

                {/* 3. Manage Notifications */}
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false)
                    setIsNotifSheetOpen(true)
                  }}
                  className="w-full text-left p-2.5 rounded-xl hover:bg-[#FAF6EE] flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <Bell size={16} className="text-[#707070]" />
                    <span>Manage Notifications</span>
                  </div>
                </button>

                <div className="h-px bg-[#E5E7EB] my-1" />

                {/* 4. Leave Group */}
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false)
                    setIsLeaveModalOpen(true)
                  }}
                  className="w-full text-left p-2.5 rounded-xl hover:bg-rose-50 text-rose-600 flex items-center gap-2.5"
                >
                  <SignOut size={16} />
                  <span>Leave Group</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. The Feed (Message Types: Standard Texts with Avatars & System Updates) */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
        {messages.length === 0 && (
          <div className="py-16 text-center space-y-2 flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-white border border-[#E5E7EB] flex items-center justify-center text-[#FBBF24] shadow-xs">
              <Users size={24} weight="fill" />
            </div>
            <p className="text-xs font-bold text-[#0E0E0E]">Welcome to {groupName}</p>
            <p className="text-[11px] text-[#707070] max-w-xs">
              This cohort chat is ready. Send a message or start a group clock-in to pray and study together!
            </p>
          </div>
        )}
        {messages.map((msg) => {
          const isMe = msg.sender_id === (currentUser?.id || 'me')

          // Type 3: Clock-In Invites (Large, Premium Black Interactive Cards with Hostless Lifecycle)
          if (msg.message_type === 'clockin_invite') {
            const discipline = msg.meta?.discipline || 'study'
            const durationMins = msg.meta?.durationMins || 30
            const focusText = msg.meta?.focusText || 'Hebrews 11 - Faith & Endurance'
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
                    if (isLiveNow) handleJoinGroupSession(msg)
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
                          Group Clock-in Invite
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
                        <span>LIVE COHORT</span>
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

                  {/* Interactive Button */}
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
                        handleJoinGroupSession(msg)
                      }}
                      className="w-full py-3.5 px-4 rounded-2xl bg-[#FBBF24] text-[#0E0E0E] hover:bg-[#F59E0B] active:scale-95 transition-all text-xs font-black flex items-center justify-center gap-2 shadow-lg cursor-pointer"
                    >
                      <Play size={15} weight="fill" />
                      <span>{isLiveOverlayOpen ? 'View Active Cohort' : 'Join Cohort Room'} ({remainingMins}m left)</span>
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

          // Type 2: System Updates (Automated Centralized Blocks)
          if (msg.message_type === 'system') {
            return (
              <div key={msg.id} className="w-full flex justify-center my-2">
                <span className="px-4 py-1.5 rounded-full bg-[#E5E7EB]/80 text-[10px] font-bold text-[#374151] max-w-sm text-center shadow-xs">
                  {msg.content}
                </span>
              </div>
            )
          }

          // Type 1: Standard Texts with Sender Avatar & Name above bubble
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
            >
              {!isMe && (
                <div className="flex items-center gap-1.5 mb-1 px-1">
                  <div className="w-5 h-5 rounded-full bg-[#0E0E0E] text-white text-[9px] font-bold flex items-center justify-center">
                    {msg.sender_initial}
                  </div>
                  <span className="text-[10px] font-bold text-[#707070]">{msg.sender_name}</span>
                </div>
              )}
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
        {/* Text Input */}
        <input
          type="text"
          value={inputContent}
          onChange={(e) => setInputContent(e.target.value)}
          placeholder={`Message ${groupName}...`}
          className="flex-1 px-3.5 py-2.5 bg-[#FAF6EE] border border-[#E5E7EB] rounded-2xl text-xs text-[#0E0E0E] placeholder-[#9095A1] focus:outline-none focus:border-[#FBBF24] focus:bg-white transition-all shadow-xs"
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
          disabled={!inputContent.trim()}
          className="p-2.5 rounded-2xl bg-[#0E0E0E] text-white hover:bg-[#262626] disabled:opacity-30 transition-all shrink-0"
        >
          <PaperPlaneTilt size={16} weight="fill" />
        </button>
      </form>

      {/* ========================================================================= */}
      {/* 4. MODAL: TIMER SETUP MODAL (SLIDER, GOAL & SCHEDULE CONFIGURATION)        */}
      {/* ========================================================================= */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-sm bg-[#FAF6EE] border border-[#E5E7EB] rounded-3xl p-5 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-1 border-b border-[#E5E7EB]">
              <h3 className="text-sm font-bold text-[#0E0E0E]">Group Clock-In Setup</h3>
              <button onClick={() => setIsInviteModalOpen(false)} className="text-[#707070]">
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleSendGroupClockInInvite()
              }}
              className="space-y-4"
            >
              <div>
                <label className="text-[11px] font-bold text-[#707070] block mb-1.5">Mode</label>
                <div className="grid grid-cols-2 gap-2">
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

              {/* Focus Scripture / Intention */}
              <div>
                <label className="text-[11px] font-bold text-[#707070] block mb-1">
                  Focus Scripture / Intention
                </label>
                <input
                  type="text"
                  value={inviteFocus}
                  onChange={(e) => setInviteFocus(e.target.value)}
                  placeholder="e.g. Hebrews 11 - Faith & Endurance"
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
                    <span>Schedule Group Clock-In</span>
                  </>
                ) : (
                  <span>Send Group Clock-In Invite</span>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. NOTIFICATIONS SETTINGS SHEET                                           */}
      {/* ========================================================================= */}
      {isNotifSheetOpen && (
        <div className="fixed inset-0 z-60 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
          <div className="fixed inset-0" onClick={() => setIsNotifSheetOpen(false)} />

          <div className="relative z-10 w-full max-w-md bg-[#FAF6EE] border border-[#E5E7EB] rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 sm:p-6 space-y-4 animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between pb-2 border-b border-[#E5E7EB]">
              <h3 className="text-sm font-bold text-[#0E0E0E]">Group Notifications</h3>
              <button onClick={() => setIsNotifSheetOpen(false)} className="text-[#707070]">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3 pt-1 text-xs">
              <div className="faith-card p-3.5 flex items-center justify-between bg-white">
                <div className="flex items-center gap-2.5">
                  <Bell size={18} className="text-[#FBBF24]" />
                  <div>
                    <p className="font-bold text-[#0E0E0E]">Push Notifications</p>
                    <p className="text-[10px] text-[#707070]">Receive live group session waves</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPushNotifsEnabled((p) => !p)}
                  className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                    pushNotifsEnabled ? 'bg-[#0E0E0E]' : 'bg-[#E5E7EB]'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      pushNotifsEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsNotifSheetOpen(false)}
                className="w-full py-3.5 bg-[#0E0E0E] text-white font-bold text-xs rounded-2xl shadow-md mt-2"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leave Group Confirmation Modal */}
      {isLeaveModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-xs bg-[#FAF6EE] border border-[#E5E7EB] rounded-3xl p-5 space-y-3 shadow-2xl text-center animate-in zoom-in-95">
            <h3 className="text-sm font-black text-[#0E0E0E]">Leave Group?</h3>
            <p className="text-xs text-[#707070] leading-relaxed">
              Are you sure you want to leave {groupName}? You will no longer receive live session alerts from this room.
            </p>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsLeaveModalOpen(false)}
                className="py-2.5 px-3 rounded-xl bg-white border border-[#E5E7EB] text-xs font-bold text-[#707070]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsLeaveModalOpen(false)
                  router.push('/sync')
                }}
                className="py-2.5 px-3 rounded-xl bg-rose-600 text-white text-xs font-bold"
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. THE LIVE GROUP CLOCK-IN OVERLAY (PARTICIPANT GRID & WEBRTC VOICE)       */}
      {/* ========================================================================= */}
      {isLiveOverlayOpen && (
        <div className="fixed inset-0 z-50 bg-[#0E0E0E] text-white p-5 sm:p-6 flex flex-col justify-between animate-in slide-in-from-bottom duration-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-black flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                LIVE COHORT
              </span>
              <span className="text-xs text-slate-400 font-mono-tabular">
                {participants.length} Active
              </span>
            </div>

            <button
              type="button"
              onClick={handleEndLiveSession}
              className="py-1.5 px-3.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1 shadow-md transition-all"
            >
              <Square size={14} weight="fill" />
              <span>{isHostUser ? 'End For All' : 'Leave Early'}</span>
            </button>
          </div>

          {/* Floating Live Reactions */}
          <div className="absolute right-4 top-20 z-40 pointer-events-none space-y-2">
            {floatingNudges.map((nudge) => (
              <div
                key={nudge.id}
                className="px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-white text-xs font-bold flex items-center gap-1.5 shadow-xl animate-in slide-in-from-bottom duration-500"
              >
                <span>{nudge.emoji}</span>
                <span>{nudge.text}</span>
              </div>
            ))}
          </div>

          {/* Center: The Participant Grid & Active Speaker Highlights */}
          <div className="space-y-4 my-auto">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-lg mx-auto">
              {participants.map((p) => (
                <div
                  key={p.id}
                  className={`p-3 rounded-2xl bg-white/10 backdrop-blur-md border transition-all flex flex-col items-center text-center space-y-1.5 relative ${
                    p.isSpeaking
                      ? 'border-[#FBBF24] ring-2 ring-[#FBBF24]/60 shadow-[0_0_20px_rgba(251,191,36,0.3)]'
                      : 'border-white/10'
                  }`}
                >
                  {p.isHost && (
                    <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-[#FBBF24] text-[#0E0E0E] text-[8px] font-black uppercase flex items-center gap-0.5">
                      <Crown size={9} weight="fill" /> Host
                    </span>
                  )}

                  <div
                    className={`w-14 h-14 rounded-full flex items-center justify-center text-base font-black border-2 transition-transform ${
                      p.id === 'me'
                        ? 'bg-[#FBBF24] text-[#0E0E0E] border-white'
                        : 'bg-white text-[#0E0E0E] border-white/80'
                    } ${p.isSpeaking ? 'scale-105 animate-pulse' : ''}`}
                  >
                    <span>{p.initial}</span>
                  </div>

                  <div className="truncate w-full">
                    <p className="text-xs font-bold text-white truncate">{p.name}</p>
                    <span className="text-[9px] text-slate-300 font-medium">
                      {p.isSpeaking ? 'Speaking...' : p.isMuted ? 'Muted' : 'Listening'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col items-center justify-center pt-2">
              <span className="text-4xl font-extrabold font-mono-tabular tracking-tight">
                {liveFormatted}
              </span>
              <span className="text-xs font-black uppercase tracking-widest text-[#FBBF24] mt-0.5">
                {liveDiscipline} • Target {liveTargetMins}m
              </span>
              {liveFocusText && (
                <p className="text-xs italic text-slate-300 mt-2 max-w-xs text-center">
                  &ldquo;{liveFocusText}&rdquo;
                </p>
              )}
            </div>
          </div>

          {/* Bottom Controls & Live Nudges Action Bar */}
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => handleSendLiveNudge('🔥', 'Fervent Prayer!')}
                className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-bold flex items-center gap-1 active:scale-95 transition-all"
              >
                <span>🔥</span>
                <span>Fire</span>
              </button>

              <button
                type="button"
                onClick={() => handleSendLiveNudge('🙏', 'Amen & Agree!')}
                className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-bold flex items-center gap-1 active:scale-95 transition-all"
              >
                <span>🙏</span>
                <span>Amen</span>
              </button>

              <button
                type="button"
                onClick={() => handleSendLiveNudge('⚡', 'Keep Going!')}
                className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-bold flex items-center gap-1 active:scale-95 transition-all"
              >
                <span>⚡</span>
                <span>Nudge</span>
              </button>
            </div>

            <div className="flex items-center justify-center">
              <button
                type="button"
                onClick={() => setIsMicMuted((m) => !m)}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-xl ${
                  isMicMuted ? 'bg-rose-600 text-white' : 'bg-white text-[#0E0E0E] hover:bg-slate-200'
                }`}
                title={isMicMuted ? 'Unmute' : 'Mute'}
              >
                {isMicMuted ? <MicrophoneSlash size={24} /> : <Microphone size={24} />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. SESSION COMPLETE SUMMARY SCREEN (AFTER HOST ENDS SESSION)               */}
      {/* ========================================================================= */}
      {isSessionCompleteScreen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="w-full max-w-sm bg-[#FAF6EE] border border-[#E5E7EB] rounded-3xl p-6 space-y-4 shadow-2xl text-center animate-in zoom-in-95">
            <div className="w-14 h-14 rounded-full bg-[#FDF9F1] text-[#FBBF24] border border-[#FBBF24]/40 flex items-center justify-center mx-auto shadow-sm">
              <Sparkle size={28} weight="fill" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-black text-[#0E0E0E]">Group Session Complete!</h3>
              <p className="text-xs text-[#707070]">
                {groupName} showed up together in unity.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5 p-3 rounded-2xl bg-white border border-[#E5E7EB]">
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#707070] block">
                  Duration
                </span>
                <span className="text-xl font-black font-mono-tabular text-[#0E0E0E]">
                  {Math.floor(liveDurationSecs / 60)} Mins
                </span>
              </div>

              <div className="space-y-0.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#707070] block">
                  Encouragements
                </span>
                <span className="text-xl font-black font-mono-tabular text-[#FBBF24]">
                  {totalNudgesCount} Nudges
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsSessionCompleteScreen(false)}
              className="w-full py-3.5 px-4 bg-[#0E0E0E] text-white font-bold text-xs rounded-2xl hover:bg-[#262626] transition-all"
            >
              Return to Group Chat
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
