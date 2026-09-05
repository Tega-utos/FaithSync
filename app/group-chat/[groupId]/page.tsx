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
  SpeakerSlash,
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
  Camera,
  Image as ImageIcon,
  ListNumbers,
  BookmarkSimple,
  Sliders,
} from '@phosphor-icons/react'
import { createClient } from '@/lib/supabase/client'
import { useTimer } from '@/context/TimerContext'
import { playChime, playSegmentChime } from '@/components/audio/Chime'
import { ambientSound } from '@/components/audio/AmbientSound'
import { LiveSessionBibleReader } from '@/components/bible/LiveSessionBibleReader'
import {
  PrayerFocusTimelineBuilder,
  TimelineSegment,
} from '@/components/timer/PrayerFocusTimelineBuilder'
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
  const [groupNotifClockIn, setGroupNotifClockIn] = useState(true)
  const [groupNotifNudges, setGroupNotifNudges] = useState(true)
  const [groupNotifChat, setGroupNotifChat] = useState(true)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  // Image Messaging State
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [isUploadingImage, setIsUploadingImage] = useState(false)

  // Clock-in Setup Modal & Scheduling
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false)
  const [inviteDiscipline, setInviteDiscipline] = useState<'prayer' | 'study'>('study')
  const [prayerFocusMode, setPrayerFocusMode] = useState<'plain' | 'timeline'>('plain')
  const [inviteDuration, setInviteDuration] = useState(30)
  const [inviteFocus, setInviteFocus] = useState('Praying for unity, revival and community')
  const [studyPassage, setStudyPassage] = useState('Hebrews 11 - Faith & Endurance')
  const [timelineSegments, setTimelineSegments] = useState<TimelineSegment[]>([
    {
      id: 'seg-1',
      type: 'scripture',
      durationMinutes: 5,
      reference: 'Psalm 100:1-5',
      versionId: 'web',
    },
    {
      id: 'seg-2',
      type: 'reflection',
      durationMinutes: 15,
      prompt: 'Intercession for our community, families, and city revival.',
    },
    {
      id: 'seg-3',
      type: 'reflection',
      durationMinutes: 10,
      prompt: 'Quiet stillness: Listening for the Holy Spirit in reverent silence.',
    },
  ])
  const [isTimelineBuilderOpen, setIsTimelineBuilderOpen] = useState(false)
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
  const [liveTimelineSegments, setLiveTimelineSegments] = useState<TimelineSegment[]>([])
  // Auto-Mute (Group Mode): Participants are muted by default to prevent chaotic audio feedback
  const [isMicMuted, setIsMicMuted] = useState(true)

  // In-App Bible Reader & Ambient Sound in Live Session
  const [isBibleReaderOpen, setIsBibleReaderOpen] = useState(false)
  const [isAmbientMuted, setIsAmbientMuted] = useState(false)
  const lastActiveSegRef = useRef<number>(-1)

  // Ambient sound lifecycle during live session
  useEffect(() => {
    if (isLiveOverlayOpen) {
      ambientSound.start(liveDiscipline, isAmbientMuted)
    } else {
      ambientSound.stop()
      lastActiveSegRef.current = -1
    }
    return () => {
      ambientSound.stop()
    }
  }, [isLiveOverlayOpen, liveDiscipline])

  // Segment chime trigger on timeline progression
  useEffect(() => {
    if (!isLiveOverlayOpen || liveTimelineSegments.length === 0) return

    let accum = 0
    let currIdx = 0
    for (let i = 0; i < liveTimelineSegments.length; i++) {
      const segSecs = (liveTimelineSegments[i].durationMinutes || 1) * 60
      if (liveDurationSecs < accum + segSecs) {
        currIdx = i
        break
      }
      accum += segSecs
    }

    if (lastActiveSegRef.current !== -1 && lastActiveSegRef.current !== currIdx) {
      playSegmentChime(isAmbientMuted)
    }
    lastActiveSegRef.current = currIdx
  }, [liveDurationSecs, isLiveOverlayOpen, liveTimelineSegments, isAmbientMuted])

  // Participants in Grid
  const [participants, setParticipants] = useState<Participant[]>([])

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

        // 2. Fetch membership role
        if (user) {
          const { data: myMember } = await (supabase
            .from('group_members') as any)
            .select('role')
            .eq('group_id', groupId)
            .eq('user_id', user.id)
            .maybeSingle()

          if (myMember?.role === 'owner' || myMember?.role === 'admin') {
            setIsHostUser(true)
          }
        }

        // 3. Fetch real member count
        const { count } = await (supabase
          .from('group_members') as any)
          .select('*', { count: 'exact', head: true })
          .eq('group_id', groupId)

        if (count !== null) setMemberCount(count || 1)

        // 3. Fetch real messages
        const realMsgs = await fetchGroupMessages(groupId)
        setMessages(realMsgs as any)

        // 4. Restore group-specific notification preferences from localStorage
        try {
          const saved = localStorage.getItem(`faithsync_grp_notif_${groupId}`)
          if (saved) {
            const parsed = JSON.parse(saved)
            if (typeof parsed.clockIn === 'boolean') setGroupNotifClockIn(parsed.clockIn)
            if (typeof parsed.nudges === 'boolean') setGroupNotifNudges(parsed.nudges)
            if (typeof parsed.chat === 'boolean') setGroupNotifChat(parsed.chat)
          }
        } catch (_) {}
      } catch (err) {
        console.error('Group chat error:', err)
      } finally {
        setLoading(false)
      }
    }

    loadGroupChat()
  }, [groupId])

  // Handle saving group notification preferences
  const handleToggleGroupNotif = (type: 'clockIn' | 'nudges' | 'chat', value: boolean) => {
    let nextClockIn = groupNotifClockIn
    let nextNudges = groupNotifNudges
    let nextChat = groupNotifChat

    if (type === 'clockIn') {
      nextClockIn = value
      setGroupNotifClockIn(value)
    } else if (type === 'nudges') {
      nextNudges = value
      setGroupNotifNudges(value)
    } else if (type === 'chat') {
      nextChat = value
      setGroupNotifChat(value)
    }

    try {
      localStorage.setItem(
        `faithsync_grp_notif_${groupId}`,
        JSON.stringify({ clockIn: nextClockIn, nudges: nextNudges, chat: nextChat })
      )
    } catch (_) {}

    setToastMessage('Group notification settings updated ✓')
    setTimeout(() => setToastMessage(null), 2500)
  }

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

      // Dispatch Web Push Notification to Group Members
      fetch('/api/notifications/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send',
          groupId,
          type: 'chat_message',
          title: groupName,
          message: `${currentUser.user_metadata?.full_name || 'Member'}: ${content}`,
          url: `/group-chat/${groupId}`,
        }),
      }).catch(() => {})
    } catch (err) {
      console.error('Send message error:', err)
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
      setToastMessage('Failed to send message. Please check connection.')
      setTimeout(() => setToastMessage(null), 3000)
    }
  }

  // Handle Image File Selection (PNG, JPG, WebP)
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setToastMessage('Please select an image file')
      setTimeout(() => setToastMessage(null), 3000)
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setSelectedImage(reader.result as string)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  // Send Picture via Group Chat
  const handleSendImage = async () => {
    if (!selectedImage || !currentUser) return
    setIsUploadingImage(true)
    const imgData = selectedImage
    setSelectedImage(null)

    const tempId = `temp-img-${Date.now()}`
    const optMsg: any = {
      id: tempId,
      sender_id: currentUser.id,
      content: '📷 Image',
      message_type: 'image',
      meta: { imageUrl: imgData },
      created_at: new Date().toISOString(),
      sender_name: currentUser.user_metadata?.full_name || 'Me',
      sender_initial: (currentUser.user_metadata?.full_name || 'M').charAt(0).toUpperCase(),
    }
    setMessages((prev) => [...prev, optMsg])

    try {
      const sent = await sendGroupMessage(groupId, '📷 Image', 'image' as any, { imageUrl: imgData })
      if (sent) {
        setMessages((prev) => prev.map((m) => (m.id === tempId ? (sent as any) : m)))
      }

      // Dispatch Web Push Notification for Image
      fetch('/api/notifications/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send',
          groupId,
          type: 'chat_message',
          title: groupName,
          message: `${currentUser.user_metadata?.full_name || 'Member'} sent a picture 📷`,
          url: `/group-chat/${groupId}`,
        }),
      }).catch(() => {})
    } catch (err) {
      console.error('Send image error:', err)
      setToastMessage('Failed to send image')
      setTimeout(() => setToastMessage(null), 3000)
    } finally {
      setIsUploadingImage(false)
    }
  }

  // Delete message moderation action (Accessible by sender or group host)
  const handleDeleteMessage = async (msgId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== msgId))
    try {
      const supabase = createClient()
      await (supabase.from('group_messages') as any).delete().eq('id', msgId)
    } catch (err) {
      console.error('Delete message error:', err)
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
    const segments = (msg.meta as any)?.timelineSegments || []

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
    setLiveTimelineSegments(segments)
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

    const isTimelinePrayer = inviteDiscipline === 'prayer' && prayerFocusMode === 'timeline'
    const totalDuration = isTimelinePrayer
      ? timelineSegments.reduce((sum, s) => sum + (s.durationMinutes || 1), 0)
      : inviteDuration

    const roomId = `group-${groupId}-${Date.now()}`
    const myName = currentUser?.user_metadata?.full_name || 'A Leader'

    const contentText = isScheduleEnabled
      ? `Scheduled a group ${totalDuration} min ${inviteDiscipline} session for ${new Date(scheduledAtISO).toLocaleDateString([], { weekday: 'short' })} at ${new Date(scheduledAtISO).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}`
      : `Group Clock-In Invite: ${totalDuration} min ${
          inviteDiscipline === 'prayer'
            ? isTimelinePrayer
              ? `Guided Prayer (${timelineSegments.length} Segments)`
              : 'Prayer'
            : 'Scripture Study'
        }`

    const metaObj = {
      discipline: inviteDiscipline,
      durationMins: totalDuration,
      focusText: inviteDiscipline === 'study' ? (studyPassage.trim() || 'Hebrews 11') : (inviteFocus.trim() || ''),
      isScheduled: isScheduleEnabled,
      scheduledAt: isScheduleEnabled ? scheduledAtISO : undefined,
      startedAt: isScheduleEnabled ? scheduledAtISO : new Date().toISOString(),
      timelineSegments: isTimelinePrayer ? timelineSegments : [],
    }

    // 1. Optimistic message in chat
    const tempId = `temp-grp-invite-${Date.now()}`
    const optMsg: any = {
      id: tempId,
      sender_id: currentUser.id,
      content: contentText,
      message_type: 'clockin_invite',
      meta: metaObj,
      created_at: new Date().toISOString(),
      sender_name: myName,
      sender_initial: myName.charAt(0).toUpperCase(),
    }
    setMessages((prev) => [...prev, optMsg])

    // 2. If instant live devotion, open live room overlay immediately for creator
    if (!isScheduleEnabled) {
      setLiveDiscipline(inviteDiscipline)
      setLiveTargetMins(totalDuration)
      setLiveFocusText(metaObj.focusText)
      setLiveTimelineSegments(metaObj.timelineSegments)
      setLiveDurationSecs(0)
      setIsLiveOverlayOpen(true)
      playChime()
    }

    setToastMessage(
      isScheduleEnabled
        ? `Cohort scheduled for ${new Date(scheduledAtISO).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })} ⏱️`
        : `Live group clock-in session started! ⏱️`
    )
    setTimeout(() => setToastMessage(null), 3000)

    try {
      const sent = await sendGroupMessage(groupId, contentText, 'clockin_invite', metaObj)
      if (sent) {
        setMessages((prev) => prev.map((m) => (m.id === tempId ? (sent as any) : m)))
      }
    } catch (err) {
      console.log('Send group invite note:', err)
    }

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

  // End Live Session & Log to Personal Targets
  const handleEndLiveSession = async () => {
    setIsLiveOverlayOpen(false)
    setIsGroupLive(false)

    if (isHostUser) {
      setIsSessionCompleteScreen(true)
    }

    try {
      const roomId = `group-${groupId}`
      // 1. Live Signal End
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

      // 2. Persist to Personal Targets & Stats (Prayer / Study Minutes)
      await fetch('/api/session/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: liveDiscipline,
          durationSeconds: liveDurationSecs,
          targetDurationSeconds: liveTargetMins * 60,
          startedAt: new Date(Date.now() - liveDurationSecs * 1000).toISOString(),
          focusText: `Group Devotion: ${groupName} - ${liveFocusText}`,
          sharedToSquare: false,
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
      <div className="command-center-container px-4 sm:px-6 pt-16 flex flex-col items-center justify-center space-y-2 min-h-[60vh] text-text-secondary">
        <CircleNotch size={24} className="animate-spin text-[#FBBF24]" />
        <p className="text-xs font-bold">Connecting to Group Chat...</p>
      </div>
    )
  }

  return (
    <div className="command-center-container flex flex-col min-h-screen min-h-[100dvh] h-screen h-[100dvh] max-h-[100dvh] bg-surface overflow-hidden">
      {/* 1. Header (Group Stack Avatar, Name, Member Count, LIVE badge, Settings) */}
      <div className="p-4 bg-card border-b border-border flex items-center justify-between z-10 shrink-0 gap-2">
        <div className="flex items-center gap-2 truncate flex-1 min-w-0">
          <button
            type="button"
            onClick={() => router.push('/sync')}
            className="p-1.5 rounded-xl text-text-secondary hover:text-text-primary hover:bg-subtle transition-colors shrink-0"
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
                <h2 className="text-sm font-black text-text-primary truncate">{groupName}</h2>
                {isGroupLive && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/300/20 text-emerald-600 border border-emerald-500/30 text-[9px] font-black uppercase flex items-center gap-1 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/300 animate-ping" />
                    LIVE
                  </span>
                )}
              </div>
              <p className="text-[10px] text-text-secondary font-medium">{memberCount} members</p>
            </div>
          </Link>
        </div>

        {/* Action Buttons: Timer Capsule Pill & Three-Dots Menu */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsInviteModalOpen(true)}
            className="flex items-center gap-1.5 bg-[#0E0E0E] dark:bg-[#1E1B16] text-white dark:text-[#F5F1E8] px-3.5 py-1.5 rounded-full shadow-sm border border-white/15 dark:border-[#FBBF24]/50 hover:bg-[#262626] dark:hover:bg-[#2A241C] active:scale-95 transition-all text-xs font-black shrink-0 cursor-pointer"
            title="Clock-In Together"
          >
            <span className="w-2 h-2 rounded-full bg-[#FBBF24] animate-pulse shrink-0 shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
            <Clock size={15} weight="bold" className="text-[#FBBF24] shrink-0" />
            <span>Clock-In</span>
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setIsMenuOpen((s) => !s)}
              className="p-2 rounded-xl text-text-secondary hover:text-text-primary hover:bg-subtle transition-colors"
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
              <div className="absolute right-0 top-11 z-50 w-52 bg-card border border-border rounded-2xl shadow-xl p-1.5 space-y-0.5 text-xs font-bold text-text-primary animate-in zoom-in-95">
                {/* 1. Send Nudge */}
                <button
                  type="button"
                  onClick={async () => {
                    setIsMenuOpen(false)
                    const myName = currentUser?.user_metadata?.full_name || 'A member'
                    const nudgeText = `${myName} sent a nudge to the group: Keep showing up 👋`
                    const sent = await sendGroupMessage(groupId, nudgeText, 'system')
                    if (sent) {
                      setMessages((prev) => [...prev, sent as any])
                    }
                    try {
                      await fetch('/api/notifications/push', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          action: 'send',
                          groupId,
                          type: 'group_nudge',
                          title: `${groupName} Nudge`,
                          message: `${myName} nudged the group: "Keep showing up!" 👋`,
                          url: `/group-chat/${groupId}`,
                        }),
                      })
                    } catch (err) {
                      console.error('Group nudge push error:', err)
                    }
                    setToastMessage('Group nudge sent! 👋')
                    setTimeout(() => setToastMessage(null), 3000)
                  }}
                  className="w-full text-left p-2.5 rounded-xl hover:bg-[#FDF9F1] dark:bg-amber-950/30 flex items-center gap-2.5"
                >
                  <HandWaving size={16} weight="fill" className="text-[#FBBF24]" />
                  <span>Send Nudge</span>
                </button>

                {/* 2. Group Info */}
                <Link
                  href={`/group-info/${groupId}`}
                  className="w-full text-left p-2.5 rounded-xl hover:bg-surface flex items-center gap-2.5 block"
                >
                  <Info size={16} className="text-text-secondary" />
                  <span>Group Info</span>
                </Link>

                {/* 3. Manage Notifications */}
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false)
                    setIsNotifSheetOpen(true)
                  }}
                  className="w-full text-left p-2.5 rounded-xl hover:bg-surface flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <Bell size={16} className="text-text-secondary" />
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
                  className="w-full text-left p-2.5 rounded-xl hover:bg-rose-50 dark:bg-red-950/30 text-rose-600 flex items-center gap-2.5"
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
            <div className="w-12 h-12 rounded-full bg-card border border-border flex items-center justify-center text-[#FBBF24] shadow-xs">
              <Users size={24} weight="fill" />
            </div>
            <p className="text-xs font-bold text-text-primary">Welcome to {groupName}</p>
            <p className="text-[11px] text-text-secondary max-w-xs">
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
                  className={`w-full max-w-sm rounded-3xl bg-card border p-5 shadow-lg space-y-3.5 animate-in zoom-in-95 transition-all ${
                    isLiveNow
                      ? 'border-[#FBBF24] dark:border-amber-400 cursor-pointer shadow-[0_10px_30px_rgba(251,191,36,0.15)]'
                      : isScheduledInFuture
                      ? 'border-[#FBBF24]/50 dark:border-amber-400/40'
                      : 'border-border opacity-80'
                  }`}
                >
                  {/* Top: Gold Icon Badge & Details */}
                  <div className="flex items-center justify-between pb-1">
                    <div className="flex items-center gap-3">
                      {/* Distinct Gold Circle Badge */}
                      <div className="w-11 h-11 rounded-full bg-[#FBBF24] text-[#1A1610] flex items-center justify-center font-bold shadow-md shrink-0">
                        {discipline === 'prayer' ? (
                          <HandsPraying size={22} weight="fill" />
                        ) : (
                          <BookOpen size={22} weight="bold" />
                        )}
                      </div>

                      {/* Header Titles */}
                      <div>
                        <h4 className="text-sm font-black text-text-primary tracking-tight">
                          Group Clock-in Invite
                        </h4>
                        <span className="text-xs text-text-secondary font-mono-tabular">
                          {durationMins} mins • {discipline}
                        </span>
                      </div>
                    </div>

                    {/* Dynamic Status Pill */}
                    {isScheduledInFuture ? (
                      <span className="px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-[#FBBF24]/50 dark:border-amber-400/50 text-[9px] font-black uppercase tracking-wider flex items-center gap-1">
                        <CalendarCheck size={11} weight="bold" />
                        <span>{datePrefix} {timeDisplay}</span>
                      </span>
                    ) : isLiveNow ? (
                      <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                        <span>LIVE COHORT</span>
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full bg-subtle dark:bg-neutral-800 text-text-muted dark:text-neutral-300 border border-transparent dark:border-neutral-700/50 text-[9px] font-black uppercase tracking-wider">
                        COMPLETED
                      </span>
                    )}
                  </div>

                  {/* Shared Focus Intention: Translucent Frosted-Glass Block */}
                  {focusText && (
                    <div className="p-3.5 rounded-2xl bg-surface border border-border text-xs text-text-primary italic flex items-start gap-2 shadow-2xs">
                      <Quotes size={15} className="text-[#FBBF24] shrink-0 mt-0.5" />
                      <span className="leading-relaxed">&ldquo;{focusText}&rdquo;</span>
                    </div>
                  )}

                  {/* Interactive Button */}
                  {isScheduledInFuture ? (
                    <div className="w-full py-3 px-4 rounded-2xl bg-surface border border-border text-text-primary font-bold text-xs flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock size={16} weight="bold" className="text-[#FBBF24] shrink-0" />
                        <span className="text-text-primary font-medium">Starts at {timeDisplay}</span>
                      </div>
                      <span className="text-[11px] text-[#FBBF24] font-mono-tabular font-bold">
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
                      className="w-full py-3.5 px-4 rounded-2xl bg-[#FBBF24] text-[#1A1610] hover:bg-[#F59E0B] active:scale-95 transition-all text-xs font-black flex items-center justify-center gap-2 shadow-md cursor-pointer"
                    >
                      <Play size={15} weight="fill" className="text-[#1A1610]" />
                      <span>{isLiveOverlayOpen ? 'View Active Cohort' : 'Join Cohort Room'} ({remainingMins}m left)</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="w-full py-3 px-4 rounded-2xl bg-subtle dark:bg-neutral-800 text-text-muted dark:text-neutral-400 border border-transparent dark:border-neutral-700/50 font-bold text-xs cursor-not-allowed text-center"
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
                <span className="px-4 py-1.5 rounded-full bg-[#E5E7EB]/80 dark:bg-neutral-800 text-[10px] font-bold text-text-primary dark:text-neutral-200 border border-transparent dark:border-white/10 max-w-sm text-center shadow-xs">
                  {msg.content}
                </span>
              </div>
            )
          }

          // Type 3: Image / Picture Messages
          if (msg.message_type === 'image' || (msg as any).meta?.imageUrl) {
            const imgUrl = (msg as any).meta?.imageUrl || msg.content
            return (
              <div
                key={msg.id}
                className={`flex flex-col group ${isMe ? 'items-end' : 'items-start'}`}
              >
                {!isMe && (
                  <div className="flex items-center gap-1.5 mb-1 px-1">
                    <div className="w-5 h-5 rounded-full bg-neutral-200 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-border/80 dark:border-white/15 text-[9px] font-bold flex items-center justify-center">
                      {msg.sender_initial}
                    </div>
                    <span className="text-[10px] font-bold text-text-secondary">{msg.sender_name}</span>
                  </div>
                )}
                <div className="flex items-center gap-1 max-w-[85%]">
                  {isMe && (
                    <button
                      type="button"
                      onClick={() => handleDeleteMessage(msg.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-text-muted hover:text-rose-500 transition-opacity cursor-pointer"
                      title="Delete message"
                    >
                      <Trash size={12} />
                    </button>
                  )}
                  <div
                    className={`rounded-2xl overflow-hidden border shadow-xs ${
                      isMe
                        ? 'border-[#0E0E0E] dark:border-white/15 bg-[#0E0E0E] dark:bg-neutral-800 text-white rounded-br-xs'
                        : 'border-border dark:border-white/10 bg-card text-text-primary rounded-bl-xs'
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imgUrl}
                      alt="Shared picture"
                      className="w-full max-h-72 object-cover rounded-2xl cursor-pointer hover:opacity-95 transition-opacity"
                      onClick={() => {
                        if (typeof window !== 'undefined') {
                          window.open(imgUrl, '_blank')
                        }
                      }}
                    />
                  </div>
                  {!isMe && isHostUser && (
                    <button
                      type="button"
                      onClick={() => handleDeleteMessage(msg.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-text-muted hover:text-rose-500 transition-opacity cursor-pointer"
                      title="Moderate & delete message (Admin)"
                    >
                      <Trash size={12} />
                    </button>
                  )}
                </div>
                <span className="text-[9px] text-text-muted mt-0.5 px-1 font-mono-tabular">
                  {new Date(msg.created_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            )
          }

          // Type 1: Standard Texts with Sender Avatar & Name above bubble
          return (
            <div
              key={msg.id}
              className={`flex flex-col group ${isMe ? 'items-end' : 'items-start'}`}
            >
              {!isMe && (
                <div className="flex items-center gap-1.5 mb-1 px-1">
                  <div className="w-5 h-5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 border border-neutral-300 dark:border-neutral-700 text-[9px] font-bold flex items-center justify-center">
                    {msg.sender_initial}
                  </div>
                  <span className="text-[10px] font-bold text-text-secondary dark:text-neutral-400">{msg.sender_name}</span>
                </div>
              )}
              <div className="flex items-center gap-1 max-w-[85%]">
                {isMe && (
                  <button
                    type="button"
                    onClick={() => handleDeleteMessage(msg.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-text-muted hover:text-rose-500 transition-opacity cursor-pointer"
                    title="Delete message"
                  >
                    <Trash size={12} />
                  </button>
                )}
                <div
                  className={`px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed shadow-xs ${
                    isMe
                      ? 'bg-[#0E0E0E] text-white dark:bg-neutral-800 dark:text-neutral-100 border border-transparent dark:border-neutral-700 rounded-br-xs'
                      : 'bg-card text-text-primary dark:text-neutral-100 border border-border dark:border-neutral-700/80 rounded-bl-xs'
                  }`}
                >
                  <p className="whitespace-pre-line">{msg.content}</p>
                </div>
                {!isMe && isHostUser && (
                  <button
                    type="button"
                    onClick={() => handleDeleteMessage(msg.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-text-muted hover:text-rose-500 transition-opacity cursor-pointer"
                    title="Moderate & delete message (Admin)"
                  >
                    <Trash size={12} />
                  </button>
                )}
              </div>
              <span className="text-[10px] text-text-muted dark:text-neutral-400 mt-0.5 px-1 font-mono-tabular">
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
        className="p-3 bg-card border-t border-border flex items-center gap-2 shrink-0 pb-6 sm:pb-3"
      >
        {/* Text Input */}
        <input
          type="text"
          value={inputContent}
          onChange={(e) => setInputContent(e.target.value)}
          placeholder={`Message ${groupName}...`}
          className="flex-1 px-3.5 py-2.5 bg-surface/80 dark:bg-neutral-900/80 border border-border/80 dark:border-white/15 rounded-2xl text-[13.5px] font-normal text-text-primary placeholder:text-text-muted/60 placeholder:font-normal focus:outline-none focus:border-border focus:ring-2 focus:ring-black/5 dark:focus:ring-white/10 transition-all shadow-xs"
        />

        {/* Picture / Image Picker Input & Button */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageSelect}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="p-2 rounded-xl text-text-secondary hover:text-text-primary hover:bg-subtle transition-colors shrink-0 cursor-pointer"
          title="Send a picture"
        >
          <Camera size={20} weight="bold" />
        </button>

        {/* Send Button */}
        <button
          type="submit"
          disabled={!inputContent.trim() || isSubmitting}
          className={`p-2.5 rounded-2xl transition-all shrink-0 ${
            inputContent.trim() && !isSubmitting
              ? 'bg-[#FBBF24] hover:bg-[#F59E0B] text-[#1A1610] shadow-md shadow-[#FBBF24]/20 border border-[#D97706]/40 active:scale-95 cursor-pointer'
              : 'bg-neutral-200/80 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 border border-neutral-300/40 dark:border-white/10 cursor-not-allowed opacity-70'
          }`}
          title={inputContent.trim() ? 'Send message' : 'Type a message to send'}
        >
          <PaperPlaneTilt size={16} weight="fill" />
        </button>
      </form>

      {/* Picture Preview Confirmation Modal */}
      {selectedImage && (
        <div
          role="dialog"
          aria-modal="true"
          data-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in"
        >
          <div className="w-full max-w-sm bg-surface border border-border rounded-3xl p-5 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h3 className="text-sm font-extrabold text-text-primary">Send Picture to Group</h3>
              <button
                type="button"
                onClick={() => setSelectedImage(null)}
                className="text-text-secondary hover:text-text-primary p-1 rounded-xl hover:bg-card"
              >
                <X size={18} />
              </button>
            </div>

            <div className="rounded-2xl overflow-hidden max-h-64 border border-border bg-black/5 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={selectedImage} alt="Preview" className="max-h-64 object-contain w-full" />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setSelectedImage(null)}
                className="py-3 px-4 rounded-2xl bg-card border border-border text-xs font-bold text-text-secondary hover:text-text-primary"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isUploadingImage}
                onClick={handleSendImage}
                className="py-3 px-4 rounded-2xl bg-[#0E0E0E] dark:bg-[#1E1B16] text-white dark:text-[#F5F1E8] border border-transparent dark:border-white/15 text-xs font-bold hover:bg-[#262626] dark:hover:bg-[#2A241C] transition-all flex items-center justify-center gap-1.5"
              >
                {isUploadingImage ? (
                  <>
                    <CircleNotch size={14} className="animate-spin text-[#FBBF24]" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <PaperPlaneTilt size={14} weight="fill" className="text-[#FBBF24]" />
                    <span>Send Picture</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. MODAL: GROUP TIMER SETUP MODAL (SPACIOUS & UNCLUSTERED)                */}
      {/* ========================================================================= */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="relative w-full max-w-md bg-surface border border-border rounded-3xl p-6 space-y-5 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <h3 className="text-base font-black text-text-primary tracking-tight">
                  Start Group Devotion
                </h3>
                <p className="text-xs text-text-secondary">
                  Host a shared devotion with {groupName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsInviteModalOpen(false)}
                className="p-1.5 rounded-full text-text-secondary hover:text-text-primary hover:bg-card transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleSendGroupClockInInvite()
              }}
              className="space-y-4"
            >
              {/* 1. Discipline Mode Tabs */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider block">
                  Discipline
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setInviteDiscipline('study')}
                    className={`py-3 px-4 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      inviteDiscipline === 'study'
                        ? 'bg-[#0E0E0E] dark:bg-[#2A241C] text-white dark:text-[#F5F1E8] border border-[#0E0E0E] dark:border-[#FBBF24]/50 shadow-md'
                        : 'bg-card border border-border text-text-secondary dark:text-neutral-400 hover:border-[#FBBF24]'
                    }`}
                  >
                    <BookOpen size={16} weight="bold" className={inviteDiscipline === 'study' ? 'text-[#FBBF24]' : ''} />
                    <span className={inviteDiscipline === 'study' ? 'text-white dark:text-[#F5F1E8] font-black' : ''}>Scripture Study</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setInviteDiscipline('prayer')}
                    className={`py-3 px-4 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      inviteDiscipline === 'prayer'
                        ? 'bg-[#0E0E0E] dark:bg-[#2A241C] text-white dark:text-[#F5F1E8] border border-[#0E0E0E] dark:border-[#FBBF24]/50 shadow-md'
                        : 'bg-card border border-border text-text-secondary dark:text-neutral-400 hover:border-[#FBBF24]'
                    }`}
                  >
                    <HandsPraying size={16} weight="fill" className={inviteDiscipline === 'prayer' ? 'text-[#FBBF24]' : ''} />
                    <span className={inviteDiscipline === 'prayer' ? 'text-white dark:text-[#F5F1E8] font-black' : ''}>Prayer</span>
                  </button>
                </div>
              </div>

              {/* 2. Prayer Mode Options: Plain Focus vs. Timeline */}
              {inviteDiscipline === 'prayer' && (
                <div className="space-y-2 p-3.5 bg-card border border-border rounded-2xl shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">
                      Prayer Structure
                    </span>
                    <div className="flex items-center bg-surface p-0.5 rounded-xl border border-border">
                      <button
                        type="button"
                        onClick={() => setPrayerFocusMode('plain')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          prayerFocusMode === 'plain'
                            ? 'bg-[#0E0E0E] dark:bg-[#2A241C] text-white dark:text-[#F5F1E8] shadow-2xs border border-transparent dark:border-[#FBBF24]/40'
                            : 'text-text-secondary'
                        }`}
                      >
                        Plain Focus
                      </button>
                      <button
                        type="button"
                        onClick={() => setPrayerFocusMode('timeline')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                          prayerFocusMode === 'timeline'
                            ? 'bg-[#0E0E0E] dark:bg-[#2A241C] text-white dark:text-[#F5F1E8] shadow-2xs border border-transparent dark:border-[#FBBF24]/40'
                            : 'text-text-secondary'
                        }`}
                      >
                        <ListNumbers size={13} weight="bold" />
                        <span>Timeline</span>
                      </button>
                    </div>
                  </div>

                  {prayerFocusMode === 'timeline' ? (
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-text-secondary">Guided Segments:</span>
                        <span className="font-bold text-text-primary">
                          {timelineSegments.length} Phases • {timelineSegments.reduce((s, x) => s + (x.durationMinutes || 1), 0)} mins total
                        </span>
                      </div>
                      <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                        {timelineSegments.map((seg, idx) => (
                          <div
                            key={seg.id || idx}
                            className="p-2 rounded-xl bg-surface border border-border text-[11px] flex items-center justify-between"
                          >
                            <span className="font-medium text-text-primary truncate max-w-[200px]">
                              {idx + 1}. {seg.type === 'scripture' ? seg.reference : seg.prompt}
                            </span>
                            <span className="font-mono-tabular font-bold text-[#FBBF24] bg-[#0E0E0E] px-1.5 py-0.5 rounded text-[10px]">
                              {seg.durationMinutes}m
                            </span>
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsTimelineBuilderOpen(true)}
                        className="w-full py-2.5 px-3 rounded-xl bg-[#0E0E0E] dark:bg-[#1E1B16] text-white dark:text-[#F5F1E8] text-xs font-bold hover:bg-[#262626] dark:hover:bg-[#2A241C] border border-white/10 dark:border-[#FBBF24]/40 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Sliders size={14} weight="bold" className="text-[#FBBF24]" />
                        <span>Customize Guided Timeline</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1 pt-1">
                      <label className="text-[10px] font-bold text-text-secondary block">
                        Focus Theme (Optional)
                      </label>
                      <input
                        type="text"
                        value={inviteFocus}
                        onChange={(e) => setInviteFocus(e.target.value)}
                        placeholder="e.g. Praying for unity, revival and community"
                        className="w-full px-3.5 py-2 bg-surface border border-border rounded-xl text-xs text-text-primary focus:outline-none focus:border-[#FBBF24]"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* 3. Study Mode Passage Input & Preset Chips */}
              {inviteDiscipline === 'study' && (
                <div className="space-y-2 p-3.5 bg-card border border-border rounded-2xl shadow-xs">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider block">
                      Scripture Study Passage
                    </label>
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-md">
                      In-App Bible Ready
                    </span>
                  </div>
                  <input
                    type="text"
                    value={studyPassage}
                    onChange={(e) => setStudyPassage(e.target.value)}
                    placeholder="e.g. Hebrews 11 - Faith & Endurance"
                    className="w-full px-3.5 py-2.5 bg-surface border border-border rounded-xl text-xs text-text-primary focus:outline-none focus:border-[#FBBF24] font-medium"
                  />
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                    {['Hebrews 11', 'Romans 8', 'Psalm 23', 'John 15', 'Ephesians 6'].map((ref) => (
                      <button
                        key={ref}
                        type="button"
                        onClick={() => setStudyPassage(ref)}
                        className="px-2 py-0.5 rounded-lg bg-surface hover:bg-subtle border border-border text-[10px] font-bold text-text-secondary hover:text-text-primary whitespace-nowrap cursor-pointer"
                      >
                        {ref}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 4. Target Duration (Shown if not in custom timeline mode) */}
              {(inviteDiscipline === 'study' || prayerFocusMode === 'plain') && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">
                      Cohort Duration
                    </label>
                    <span className="text-xs font-black font-mono text-[#FBBF24] bg-[#0E0E0E] dark:bg-[#1E1B16] border border-transparent dark:border-[#FBBF24]/30 px-2.5 py-0.5 rounded-lg">
                      {inviteDuration} mins
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-1.5">
                    {[15, 30, 45, 60].map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => setInviteDuration(mins)}
                        className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          inviteDuration === mins
                            ? 'bg-[#FBBF24] text-text-primary shadow-sm'
                            : 'bg-card border border-border text-text-secondary hover:border-[#FBBF24]'
                        }`}
                      >
                        {mins}m
                      </button>
                    ))}
                  </div>

                  <input
                    type="range"
                    min={5}
                    max={120}
                    step={5}
                    value={inviteDuration}
                    onChange={(e) => setInviteDuration(Number(e.target.value))}
                    className="w-full accent-[#FBBF24] cursor-pointer"
                  />
                </div>
              )}

              {/* 5. Automated Schedule Accordion */}
              <div className="pt-2 border-t border-border space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                      <CalendarCheck size={15} className="text-[#FBBF24]" weight="bold" />
                      <span>Schedule for Later</span>
                    </label>
                    <p className="text-[10px] text-text-secondary">
                      Synchronizes start time automatically
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsScheduleEnabled((s) => !s)}
                    className={`w-11 h-6 rounded-full transition-colors relative p-1 cursor-pointer ${
                      isScheduleEnabled ? 'bg-[#FBBF24]' : 'bg-[#E5E7EB] dark:bg-neutral-700'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white dark:bg-[#12100D] shadow-md transition-transform ${
                        isScheduleEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {isScheduleEnabled && (
                  <div className="space-y-2 pt-1 animate-in fade-in">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => setSchedulePreset('tomorrow_6am')}
                        className={`p-2.5 rounded-2xl text-left border transition-all cursor-pointer ${
                          schedulePreset === 'tomorrow_6am'
                            ? 'bg-[#0E0E0E] dark:bg-[#2A241C] text-white dark:text-[#F5F1E8] border-[#0E0E0E] dark:border-[#FBBF24]/50 font-bold shadow-xs'
                            : 'bg-card border-border text-text-secondary hover:border-[#FBBF24]'
                        }`}
                      >
                        <p className="text-[9px] uppercase tracking-wider opacity-70">Tomorrow</p>
                        <p className="font-mono-tabular font-black">6:00 AM</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSchedulePreset('tomorrow_7am')}
                        className={`p-2.5 rounded-2xl text-left border transition-all cursor-pointer ${
                          schedulePreset === 'tomorrow_7am'
                            ? 'bg-[#0E0E0E] dark:bg-[#2A241C] text-white dark:text-[#F5F1E8] border-[#0E0E0E] dark:border-[#FBBF24]/50 font-bold shadow-xs'
                            : 'bg-card border-border text-text-secondary hover:border-[#FBBF24]'
                        }`}
                      >
                        <p className="text-[9px] uppercase tracking-wider opacity-70">Tomorrow</p>
                        <p className="font-mono-tabular font-black">7:00 AM</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSchedulePreset('today_8pm')}
                        className={`p-2.5 rounded-2xl text-left border transition-all cursor-pointer ${
                          schedulePreset === 'today_8pm'
                            ? 'bg-[#0E0E0E] dark:bg-[#2A241C] text-white dark:text-[#F5F1E8] border-[#0E0E0E] dark:border-[#FBBF24]/50 font-bold shadow-xs'
                            : 'bg-card border-border text-text-secondary hover:border-[#FBBF24]'
                        }`}
                      >
                        <p className="text-[9px] uppercase tracking-wider opacity-70">Today</p>
                        <p className="font-mono-tabular font-black">8:00 PM</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSchedulePreset('custom')}
                        className={`p-2.5 rounded-2xl text-left border transition-all cursor-pointer ${
                          schedulePreset === 'custom'
                            ? 'bg-[#0E0E0E] dark:bg-[#2A241C] text-white dark:text-[#F5F1E8] border-[#0E0E0E] dark:border-[#FBBF24]/50 font-bold shadow-xs'
                            : 'bg-card border-border text-text-secondary hover:border-[#FBBF24]'
                        }`}
                      >
                        <p className="text-[9px] uppercase tracking-wider opacity-70">Custom</p>
                        <p className="font-mono-tabular font-black">Specific Time</p>
                      </button>
                    </div>

                    {schedulePreset === 'custom' && (
                      <input
                        type="time"
                        value={customScheduledTime}
                        onChange={(e) => setCustomScheduledTime(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-card border border-border rounded-2xl text-xs font-mono-tabular focus:outline-none focus:border-[#FBBF24]"
                      />
                    )}
                  </div>
                )}
              </div>

              {/* Submit CTA */}
              <button
                type="submit"
                className="w-full bg-[#0E0E0E] dark:bg-[#1E1B16] text-white dark:text-[#F5F1E8] border border-white/10 dark:border-[#FBBF24]/50 py-4 rounded-2xl font-black text-sm shadow-xl shadow-black/15 hover:bg-[#262626] dark:hover:bg-[#2A241C] active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isScheduleEnabled ? (
                  <>
                    <CalendarCheck size={18} className="text-[#FBBF24]" weight="bold" />
                    <span>Schedule Cohort Clock-In</span>
                  </>
                ) : (
                  <>
                    <Play size={18} weight="fill" className="text-[#FBBF24]" />
                    <span>Start Live Cohort Room</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Notifications Settings Sheet */}
      {isNotifSheetOpen && (
        <div className="fixed inset-0 z-60 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
          <div className="fixed inset-0" onClick={() => setIsNotifSheetOpen(false)} />

          <div className="relative z-10 w-full max-w-md bg-surface border border-border rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 sm:p-6 space-y-4 animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h3 className="text-sm font-bold text-text-primary">Group Notifications</h3>
              <button onClick={() => setIsNotifSheetOpen(false)} className="text-text-secondary cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3 pt-1 text-xs">
              <div className="faith-card p-3.5 flex items-center justify-between bg-card">
                <div className="flex items-center gap-2.5">
                  <Bell size={18} className="text-[#FBBF24]" />
                  <div>
                    <p className="font-bold text-text-primary">Cohort Clock-In Alerts</p>
                    <p className="text-[10px] text-text-secondary">Receive live group devotion alerts</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setGroupNotifClockIn((p) => !p)}
                  className={`w-11 h-6 rounded-full transition-colors relative p-0.5 cursor-pointer ${
                    groupNotifClockIn ? 'bg-[#0E0E0E]' : 'bg-[#E5E7EB]'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-card transition-transform ${
                      groupNotifClockIn ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsNotifSheetOpen(false)}
                className="w-full py-3.5 bg-[#0E0E0E] dark:bg-[#1E1B16] text-white dark:text-[#F5F1E8] border border-transparent dark:border-white/15 font-bold text-xs rounded-2xl shadow-md mt-2 hover:bg-[#262626] dark:hover:bg-[#2A241C] cursor-pointer transition-colors"
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
          <div className="w-full max-w-xs bg-surface border border-border rounded-3xl p-5 space-y-3 shadow-2xl text-center animate-in zoom-in-95">
            <h3 className="text-sm font-black text-text-primary">Leave Group?</h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              Are you sure you want to leave {groupName}? You will no longer receive live session alerts from this room.
            </p>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsLeaveModalOpen(false)}
                className="py-2.5 px-3 rounded-xl bg-card border border-border text-xs font-bold text-text-secondary cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsLeaveModalOpen(false)
                  router.push('/sync')
                }}
                className="py-2.5 px-3 rounded-xl bg-rose-600 text-white text-xs font-bold cursor-pointer"
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Embedded Prayer Timeline Builder Sub-Modal */}
      <PrayerFocusTimelineBuilder
        isOpen={isTimelineBuilderOpen}
        onClose={() => setIsTimelineBuilderOpen(false)}
        initialSegments={timelineSegments}
        onApplyTimeline={(newSegs, totalMins) => {
          setTimelineSegments(newSegs)
          setInviteDuration(totalMins)
          setIsTimelineBuilderOpen(false)
        }}
      />

      {/* Embedded Live Session In-App Bible Reader */}
      <LiveSessionBibleReader
        isOpen={isBibleReaderOpen}
        onClose={() => setIsBibleReaderOpen(false)}
        initialReference={studyPassage || liveFocusText || 'Hebrews 11'}
      />

      {/* ========================================================================= */}
      {/* 5. THE LIVE GROUP CLOCK-IN OVERLAY (PARTICIPANT GRID & WEBRTC VOICE)       */}
      {/* ========================================================================= */}
      {isLiveOverlayOpen && (() => {
        // Active timeline segment computation
        let accumulatedSecs = 0
        let activeSegIndex = 0
        let activeSeg: TimelineSegment | null = null
        let activeSegSecsLeft = 0

        if (liveTimelineSegments && liveTimelineSegments.length > 0) {
          for (let i = 0; i < liveTimelineSegments.length; i++) {
            const segDurationSecs = (liveTimelineSegments[i].durationMinutes || 1) * 60
            if (liveDurationSecs < accumulatedSecs + segDurationSecs) {
              activeSegIndex = i
              activeSeg = liveTimelineSegments[i]
              activeSegSecsLeft = Math.max(0, accumulatedSecs + segDurationSecs - liveDurationSecs)
              break
            }
            accumulatedSecs += segDurationSecs
          }
          if (!activeSeg && liveTimelineSegments.length > 0) {
            activeSeg = liveTimelineSegments[liveTimelineSegments.length - 1]
          }
        }

        return (
          <div className="fixed inset-0 z-50 bg-[#0E0E0E] text-white p-5 sm:p-6 flex flex-col justify-between animate-in slide-in-from-bottom duration-300">
            {/* Top Bar: Sync Badge, Audio Control, Avatars & Exit */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-black flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>LIVE COHORT</span>
                </span>

                {/* Ambient Sound Mute/Unmute Toggle Button */}
                <button
                  type="button"
                  onClick={() => {
                    const nextMuted = ambientSound.toggleMute()
                    setIsAmbientMuted(nextMuted)
                  }}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    !isAmbientMuted
                      ? 'bg-[#FBBF24]/20 border-[#FBBF24]/40 dark:border-amber-500/30 text-[#FBBF24]'
                      : 'bg-card/10 border-white/20 text-white/50 hover:text-white'
                  }`}
                  title={!isAmbientMuted ? 'Mute Ambient Sound' : 'Enable Ambient Sound'}
                >
                  {!isAmbientMuted ? <SpeakerHigh size={15} weight="bold" /> : <SpeakerSlash size={15} />}
                  <span className="hidden sm:inline">{!isAmbientMuted ? 'Ambient: On' : 'Ambient: Muted'}</span>
                </button>
              </div>

              {/* Present Avatars & Exit */}
              <div className="flex items-center gap-3">
                <div className="flex items-center -space-x-2">
                  <div
                    className="w-8 h-8 rounded-full bg-[#FBBF24] text-text-primary font-black text-xs flex items-center justify-center border-2 border-[#0E0E0E] dark:border-white/20 ring-2 ring-emerald-400 shadow-md"
                    title="You (Present)"
                  >
                    Me
                  </div>
                  {participants
                    .filter((p) => p.id !== 'me')
                    .slice(0, 3)
                    .map((p) => (
                      <div
                        key={p.id}
                        className="w-8 h-8 rounded-full bg-card text-text-primary font-black text-xs flex items-center justify-center border-2 border-[#0E0E0E] dark:border-white/20 ring-2 ring-emerald-400 shadow-md"
                        title={`${p.name} (Present)`}
                      >
                        {p.initial}
                      </div>
                    ))}
                  {participants.length > 4 && (
                    <div className="w-8 h-8 rounded-full bg-[#262626] text-white font-black text-[10px] flex items-center justify-center border-2 border-[#0E0E0E] dark:border-white/20">
                      +{participants.length - 4}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleEndLiveSession}
                  className="py-1.5 px-3.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1 shadow-md transition-all cursor-pointer"
                >
                  <Square size={14} weight="fill" />
                  <span>{isHostUser ? 'End For All' : 'Leave Early'}</span>
                </button>
              </div>
            </div>

            {/* Middle Section: Circular Stopwatch & Contextual Study / Prayer Phase Card */}
            <div className="flex flex-col items-center justify-center space-y-4 my-auto">
              <div className="relative w-56 h-56 sm:w-64 sm:h-64 flex items-center justify-center">
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

                <div className="absolute flex flex-col items-center text-center">
                  <span className="text-3xl sm:text-4xl font-extrabold font-mono-tabular tracking-tight">
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

              {/* Study Mode: In-App Bible Reader Action Bar */}
              {liveDiscipline === 'study' && (
                <div className="flex flex-col items-center space-y-2 max-w-sm w-full">
                  <button
                    type="button"
                    onClick={() => setIsBibleReaderOpen(true)}
                    className="w-full py-3 px-4 rounded-2xl bg-[#FBBF24] text-text-primary hover:bg-[#f5b81b] active:scale-95 transition-all font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#FBBF24]/20 cursor-pointer"
                  >
                    <BookOpen size={18} weight="bold" />
                    <span>Open In-App Bible Reader</span>
                  </button>
                  <p className="text-[11px] text-slate-400 text-center">
                    Reading: <span className="font-bold text-white">{studyPassage || liveFocusText || 'Hebrews 11'}</span>
                  </p>
                </div>
              )}

              {/* Prayer Mode: Guided Timeline Phase Card or Plain Focus */}
              {liveDiscipline === 'prayer' && (
                liveTimelineSegments.length > 0 && activeSeg ? (
                  <div className="p-4 rounded-3xl bg-card/10 backdrop-blur-md border border-white/20 text-center max-w-sm w-full space-y-2 shadow-xl animate-in fade-in">
                    <div className="flex items-center justify-between text-[11px] font-bold text-[#FBBF24] uppercase tracking-wider">
                      <span>Phase {activeSegIndex + 1} of {liveTimelineSegments.length}</span>
                      <span className="font-mono-tabular">
                        {Math.floor(activeSegSecsLeft / 60)}:{(activeSegSecsLeft % 60).toString().padStart(2, '0')} left
                      </span>
                    </div>
                    <p className="text-sm font-bold text-white leading-snug">
                      {activeSeg.type === 'scripture' ? `📖 ${activeSeg.reference}` : activeSeg.prompt}
                    </p>
                  </div>
                ) : liveFocusText ? (
                  <div className="p-3.5 rounded-2xl bg-card/10 backdrop-blur-md border border-white/20 text-xs italic text-slate-200 max-w-xs text-center shadow-lg">
                    &ldquo;{liveFocusText}&rdquo;
                  </div>
                ) : null
              )}
            </div>

            {/* Bottom Bar: Microphone Control */}
            <div className="flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => setIsMicMuted((m) => !m)}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-xl cursor-pointer ${
                  isMicMuted ? 'bg-rose-600 text-white' : 'bg-card text-text-primary hover:bg-slate-200'
                }`}
                title={isMicMuted ? 'Unmute' : 'Mute'}
              >
                {isMicMuted ? <MicrophoneSlash size={24} /> : <Microphone size={24} />}
              </button>
            </div>
          </div>
        )
      })()}

      {/* ========================================================================= */}
      {/* 6. SESSION COMPLETE SUMMARY SCREEN (AFTER HOST ENDS SESSION)               */}
      {/* ========================================================================= */}
      {isSessionCompleteScreen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="w-full max-w-sm bg-surface border border-border rounded-3xl p-6 space-y-4 shadow-2xl text-center animate-in zoom-in-95">
            <div className="w-14 h-14 rounded-full bg-[#FDF9F1] dark:bg-amber-950/30 text-[#FBBF24] border border-[#FBBF24]/40 dark:border-amber-500/30 flex items-center justify-center mx-auto shadow-sm">
              <Sparkle size={28} weight="fill" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-black text-text-primary">Group Session Complete!</h3>
              <p className="text-xs text-text-secondary">
                {groupName} showed up together in unity.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5 p-3 rounded-2xl bg-card border border-border">
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary block">
                  Duration
                </span>
                <span className="text-xl font-black font-mono-tabular text-text-primary">
                  {Math.floor(liveDurationSecs / 60)} Mins
                </span>
              </div>

              <div className="space-y-0.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary block">
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
              className="w-full py-3.5 px-4 bg-[#0E0E0E] dark:bg-[#1E1B16] text-white dark:text-[#F5F1E8] border border-transparent dark:border-white/15 font-bold text-xs rounded-2xl hover:bg-[#262626] dark:hover:bg-[#2A241C] transition-all cursor-pointer"
            >
              Return to Group Chat
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. MANAGE GROUP NOTIFICATIONS MODAL                                       */}
      {/* ========================================================================= */}
      {isNotifSheetOpen && (
        <div
          role="dialog"
          aria-modal="true"
          data-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in"
        >
          <div className="w-full max-w-sm max-h-[88vh] overflow-y-auto bg-surface border border-border rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xl animate-in zoom-in-95 no-scrollbar">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div>
                <h3 className="text-sm font-extrabold text-text-primary">Manage Group Notifications</h3>
                <p className="text-[11px] text-text-secondary font-medium">{groupName}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsNotifSheetOpen(false)}
                className="text-text-secondary hover:text-text-primary p-1.5 rounded-xl hover:bg-card transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 pt-1">
              {/* 1. Ongoing Group Clock-In Alerts */}
              <div className="p-3.5 rounded-2xl bg-card border border-border flex items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="w-8 h-8 rounded-full bg-surface text-[#FBBF24] flex items-center justify-center shrink-0 border border-border">
                    <Clock size={16} weight="fill" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-text-primary">Ongoing Group Clock-Ins</p>
                    <p className="text-[10px] text-text-secondary leading-tight">
                      Alerts when a group prayer or study session is ongoing or starts
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={groupNotifClockIn}
                  onClick={() => handleToggleGroupNotif('clockIn', !groupNotifClockIn)}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ease-in-out cursor-pointer shrink-0 ${
                    groupNotifClockIn ? 'bg-[#0E0E0E]' : 'bg-[#E5E7EB]'
                  }`}
                >
                  <div
                    className={`bg-card w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                      groupNotifClockIn ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* 2. Group Nudge Alerts */}
              <div className="p-3.5 rounded-2xl bg-card border border-border flex items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="w-8 h-8 rounded-full bg-surface text-[#234537] dark:text-emerald-400 flex items-center justify-center shrink-0 border border-border">
                    <HandWaving size={16} weight="fill" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-text-primary">Group Nudge Alerts</p>
                    <p className="text-[10px] text-text-secondary leading-tight">
                      Receive encouragement nudges sent to the group
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={groupNotifNudges}
                  onClick={() => handleToggleGroupNotif('nudges', !groupNotifNudges)}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ease-in-out cursor-pointer shrink-0 ${
                    groupNotifNudges ? 'bg-[#0E0E0E]' : 'bg-[#E5E7EB]'
                  }`}
                >
                  <div
                    className={`bg-card w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                      groupNotifNudges ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* 3. Group Chat Messages */}
              <div className="p-3.5 rounded-2xl bg-card border border-border flex items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="w-8 h-8 rounded-full bg-surface text-text-secondary flex items-center justify-center shrink-0 border border-border">
                    <Quotes size={16} weight="bold" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-text-primary">Group Chat Messages</p>
                    <p className="text-[10px] text-text-secondary leading-tight">
                      Alerts for new messages in this group
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={groupNotifChat}
                  onClick={() => handleToggleGroupNotif('chat', !groupNotifChat)}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ease-in-out cursor-pointer shrink-0 ${
                    groupNotifChat ? 'bg-[#0E0E0E]' : 'bg-[#E5E7EB]'
                  }`}
                >
                  <div
                    className={`bg-card w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                      groupNotifChat ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsNotifSheetOpen(false)}
              className="w-full py-3.5 px-4 bg-[#0E0E0E] dark:bg-[#1E1B16] text-white dark:text-[#F5F1E8] border border-transparent dark:border-white/15 font-bold text-xs rounded-2xl hover:bg-[#262626] dark:hover:bg-[#2A241C] transition-all cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
