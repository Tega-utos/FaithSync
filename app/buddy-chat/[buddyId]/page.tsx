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
  SpeakerSlash,
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
  Camera,
  Image as ImageIcon,
  ListNumbers,
  BookmarkSimple,
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
import { fetchBuddyMessages, sendBuddyMessage } from '@/features/buddies/services/buddyService'
import { getLocalDateKey } from '@/lib/utils/date'
import { getDevotionState, getElapsedSeconds, getRemainingSeconds } from '@/lib/devotionSync'
import { calculateUserStreak } from '@/lib/utils/streak'

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
  // Image Messaging State
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [isUploadingImage, setIsUploadingImage] = useState(false)

  // Permissions in Settings Modal
  const [shareHistory, setShareHistory] = useState(true)
  const [allowNudge, setAllowNudge] = useState(true)
  const [shareLiveSession, setShareLiveSession] = useState(true)

  // Clock-in Setup Modal State & Scheduling
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false)
  const [inviteDiscipline, setInviteDiscipline] = useState<'prayer' | 'study'>('prayer')
  const [prayerFocusMode, setPrayerFocusMode] = useState<'plain' | 'timeline'>('plain')
  const [inviteDuration, setInviteDuration] = useState(15)
  const [inviteFocus, setInviteFocus] = useState('Praying for family, work and spiritual growth')
  const [studyPassage, setStudyPassage] = useState('Hebrews 11 - Faith & Endurance')
  const [timelineSegments, setTimelineSegments] = useState<TimelineSegment[]>([
    {
      id: 'seg-1',
      type: 'scripture',
      durationMinutes: 3,
      reference: 'Psalm 23:1-3',
      versionId: 'web',
    },
    {
      id: 'seg-2',
      type: 'reflection',
      durationMinutes: 7,
      prompt: 'Surrender one specific anxiety or burden to Jesus right now.',
    },
    {
      id: 'seg-3',
      type: 'reflection',
      durationMinutes: 5,
      prompt: 'Intercede for your family, accountability partner, and community.',
    },
  ])
  const [isTimelineBuilderOpen, setIsTimelineBuilderOpen] = useState(false)
  const [isScheduleEnabled, setIsScheduleEnabled] = useState(false)
  const [schedulePreset, setSchedulePreset] = useState<'tomorrow_6am' | 'tomorrow_7am' | 'today_8pm' | 'custom'>('tomorrow_6am')
  const [customScheduledTime, setCustomScheduledTime] = useState('')

  // Live Devotion Room (WebRTC + Realtime Synced Stopwatch)
  const [isLiveOverlayOpen, setIsLiveOverlayOpen] = useState(false)
  const [liveDiscipline, setLiveDiscipline] = useState<'prayer' | 'study'>('prayer')
  const [liveDurationSecs, setLiveDurationSecs] = useState(0)
  const [liveTargetMins, setLiveTargetMins] = useState(15)
  const [liveFocusText, setLiveFocusText] = useState('')
  const [liveTimelineSegments, setLiveTimelineSegments] = useState<TimelineSegment[]>([])
  const [isMicMuted, setIsMicMuted] = useState(false)
  const [isBuddySpeaking, setIsBuddySpeaking] = useState(false)
  const [showEndConfirm, setShowEndConfirm] = useState(false)

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
        const realBuddyStreak = await calculateUserStreak(buddyId, supabase)
        setBuddyStreak(realBuddyStreak)

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

      // Dispatch Web Push Notification to Buddy
      fetch('/api/notifications/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send',
          targetUserId: buddyId,
          type: 'chat_message',
          title: currentUser?.user_metadata?.full_name || 'Accountability Buddy',
          message: text,
          url: `/buddy-chat/${currentUser.id}`,
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
    // Reset file input value so same file can be re-selected if cancelled
    e.target.value = ''
  }

  // Send Picture via Chat
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
    }
    setMessages((prev) => [...prev, optMsg])

    try {
      const sent = await sendBuddyMessage(buddyId, currentUser.id, '📷 Image', 'image', { imageUrl: imgData })
      if (sent) {
        setMessages((prev) => prev.map((m) => (m.id === tempId ? (sent as any) : m)))
      }

      // Dispatch Web Push Notification for Image
      fetch('/api/notifications/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send',
          targetUserId: buddyId,
          type: 'chat_message',
          title: currentUser?.user_metadata?.full_name || 'Accountability Buddy',
          message: 'Sent a picture 📷',
          url: `/buddy-chat/${currentUser.id}`,
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

    const isTimelinePrayer = inviteDiscipline === 'prayer' && prayerFocusMode === 'timeline'
    const totalDuration = isTimelinePrayer
      ? timelineSegments.reduce((sum, s) => sum + (s.durationMinutes || 1), 0)
      : inviteDuration

    const contentText = isScheduleEnabled
      ? `Scheduled a ${totalDuration} min ${inviteDiscipline} session for ${new Date(scheduledAtISO).toLocaleDateString([], { weekday: 'short' })} at ${new Date(scheduledAtISO).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}`
      : `Sent an invitation for a ${totalDuration} min ${
          inviteDiscipline === 'prayer'
            ? isTimelinePrayer
              ? `Guided Prayer (${timelineSegments.length} Segments)`
              : 'Prayer'
            : 'Scripture Study'
        } session!`

    const metaObj = {
      discipline: inviteDiscipline,
      durationMins: totalDuration,
      focusText: inviteDiscipline === 'study' ? (studyPassage.trim() || 'Hebrews 11') : (inviteFocus.trim() || ''),
      isScheduled: isScheduleEnabled,
      scheduledAt: isScheduleEnabled ? scheduledAtISO : undefined,
      startedAt: isScheduleEnabled ? scheduledAtISO : new Date().toISOString(),
      timelineSegments: isTimelinePrayer ? timelineSegments : [],
    }

    // 1. Optimistic in-chat bubble for instant creator visibility
    const tempId = `temp-invite-${Date.now()}`
    const optMsg: any = {
      id: tempId,
      sender_id: currentUser.id,
      content: contentText,
      message_type: 'clockin_invite',
      meta: metaObj,
      created_at: new Date().toISOString(),
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
        ? `Clock-in scheduled for ${new Date(scheduledAtISO).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })} ⏱️`
        : `Live clock-in session started with ${buddyName}! ⏱️`
    )
    setTimeout(() => setToastMessage(null), 3000)

    try {
      const sent = await sendBuddyMessage(buddyId, currentUser.id, contentText, 'clockin_invite', metaObj)
      if (sent) {
        setMessages((prev) => prev.map((m) => (m.id === tempId ? (sent as any) : m)))
      }

      // Dispatch Web Push Notification to Buddy
      fetch('/api/notifications/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send',
          targetUserId: buddyId,
          type: 'clockin_invite',
          title: `Clock-In ${isScheduleEnabled ? 'Scheduled' : 'Invite'} from ${currentUser?.user_metadata?.full_name || 'Your Buddy'}`,
          message: `${isScheduleEnabled ? 'Scheduled for tomorrow 6:00 AM' : 'Join now'}: ${totalDuration} min ${inviteDiscipline}`,
          url: `/buddy-chat/${currentUser?.id || 'partner'}`,
        }),
      }).catch(() => {})
    } catch (err) {
      console.log('Send invite note:', err)
    }
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
      timelineSegments: [],
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
    const segments = (msg.meta as any)?.timelineSegments || []

    const targetStartTime = msg.meta?.scheduledAt
      ? new Date(msg.meta.scheduledAt).getTime()
      : msg.meta?.startedAt
      ? new Date(msg.meta.startedAt).getTime()
      : msg.created_at
      ? new Date(msg.created_at).getTime()
      : Date.now()

    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - targetStartTime) / 1000))
    const totalDurationSecs = duration * 60

    if (elapsedSeconds >= totalDurationSecs) {
      alert('This clock-in session has already ended.')
      return
    }

    setLiveDiscipline(discipline)
    setLiveTargetMins(duration)
    setLiveFocusText(focus)
    setLiveTimelineSegments(segments)
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

          // Type 3: Image / Picture Messages
          if (msg.message_type === 'image' || (msg as any).meta?.imageUrl) {
            const imgUrl = (msg as any).meta?.imageUrl || msg.content
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[78%] rounded-2xl overflow-hidden border shadow-xs ${
                    isMe
                      ? 'border-[#0E0E0E] bg-[#0E0E0E] text-white rounded-br-xs'
                      : 'border-[#E5E7EB] bg-white text-[#0E0E0E] rounded-bl-xs'
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
                <span className="text-[9px] text-[#9095A1] mt-0.5 px-1 font-mono-tabular">
                  {new Date(msg.created_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
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
            className="p-2.5 rounded-2xl bg-[#FDF9F1] border border-[#FBBF24]/50 text-[#FBBF24] hover:bg-[#FBBF24] hover:text-white transition-all shadow-xs shrink-0 cursor-pointer"
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
          className="p-2 rounded-xl text-[#707070] hover:text-[#0E0E0E] hover:bg-[#F3F4F6] transition-colors shrink-0 cursor-pointer"
          title="Send a picture"
        >
          <Camera size={20} weight="bold" />
        </button>

        {/* Send Button */}
        <button
          type="submit"
          disabled={!inputContent.trim() || (isSquareConnection && remainingSquareMessages <= 0)}
          className="p-2.5 rounded-2xl bg-[#0E0E0E] text-white hover:bg-[#262626] disabled:opacity-30 transition-all shrink-0 cursor-pointer"
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
          <div className="w-full max-w-sm bg-[#FAF6EE] border border-[#E5E7EB] rounded-3xl p-5 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-[#E5E7EB]">
              <h3 className="text-sm font-extrabold text-[#0E0E0E]">Send Picture</h3>
              <button
                type="button"
                onClick={() => setSelectedImage(null)}
                className="text-[#707070] hover:text-[#0E0E0E] p-1 rounded-xl hover:bg-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="rounded-2xl overflow-hidden max-h-64 border border-[#E5E7EB] bg-black/5 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={selectedImage} alt="Preview" className="max-h-64 object-contain w-full" />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setSelectedImage(null)}
                className="py-3 px-4 rounded-2xl bg-white border border-[#E5E7EB] text-xs font-bold text-[#707070] hover:text-[#0E0E0E]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isUploadingImage}
                onClick={handleSendImage}
                className="py-3 px-4 rounded-2xl bg-[#0E0E0E] text-white text-xs font-bold hover:bg-[#262626] transition-all flex items-center justify-center gap-1.5"
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
      {/* 4. MODAL: TIMER SETUP MODAL (SPACIOUS & UNCLUSTERED)                      */}
      {/* ========================================================================= */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="relative w-full max-w-md bg-[#FAF6EE] border border-[#E5E7EB] rounded-3xl p-6 space-y-5 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB]">
              <div>
                <h3 className="text-base font-black text-[#0E0E0E] tracking-tight">
                  Start Devotion Clock-In
                </h3>
                <p className="text-xs text-[#707070]">
                  Invite {buddyName} to sync devotion
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsInviteModalOpen(false)}
                className="p-1.5 rounded-full text-[#707070] hover:text-[#0E0E0E] hover:bg-white transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleSendClockInInvite()
              }}
              className="space-y-4"
            >
              {/* 1. Discipline Mode Tabs */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-[#707070] uppercase tracking-wider block">
                  Discipline
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setInviteDiscipline('prayer')}
                    className={`py-3 px-4 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      inviteDiscipline === 'prayer'
                        ? 'bg-[#0E0E0E] text-white shadow-md'
                        : 'bg-white border border-[#E5E7EB] text-[#707070] hover:border-[#FBBF24]'
                    }`}
                  >
                    <HandsPraying size={16} weight="fill" className={inviteDiscipline === 'prayer' ? 'text-[#FBBF24]' : ''} />
                    <span>Prayer</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setInviteDiscipline('study')}
                    className={`py-3 px-4 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      inviteDiscipline === 'study'
                        ? 'bg-[#0E0E0E] text-white shadow-md'
                        : 'bg-white border border-[#E5E7EB] text-[#707070] hover:border-[#FBBF24]'
                    }`}
                  >
                    <BookOpen size={16} weight="bold" className={inviteDiscipline === 'study' ? 'text-[#FBBF24]' : ''} />
                    <span>Scripture Study</span>
                  </button>
                </div>
              </div>

              {/* 2. Prayer Mode Options: Plain Focus vs. Timeline */}
              {inviteDiscipline === 'prayer' && (
                <div className="space-y-2 p-3.5 bg-white border border-[#E5E7EB] rounded-2xl shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#707070] uppercase tracking-wider">
                      Prayer Structure
                    </span>
                    <div className="flex items-center bg-[#FAF6EE] p-0.5 rounded-xl border border-[#E5E7EB]">
                      <button
                        type="button"
                        onClick={() => setPrayerFocusMode('plain')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          prayerFocusMode === 'plain'
                            ? 'bg-[#0E0E0E] text-white shadow-2xs'
                            : 'text-[#707070]'
                        }`}
                      >
                        Plain Focus
                      </button>
                      <button
                        type="button"
                        onClick={() => setPrayerFocusMode('timeline')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                          prayerFocusMode === 'timeline'
                            ? 'bg-[#0E0E0E] text-white shadow-2xs'
                            : 'text-[#707070]'
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
                        <span className="text-[#707070]">Guided Segments:</span>
                        <span className="font-bold text-[#0E0E0E]">
                          {timelineSegments.length} Phases • {timelineSegments.reduce((s, x) => s + (x.durationMinutes || 1), 0)} mins total
                        </span>
                      </div>
                      <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                        {timelineSegments.map((seg, idx) => (
                          <div
                            key={seg.id || idx}
                            className="p-2 rounded-xl bg-[#FAF6EE] border border-[#E5E7EB] text-[11px] flex items-center justify-between"
                          >
                            <span className="font-medium text-[#0E0E0E] truncate max-w-[200px]">
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
                        className="w-full py-2.5 px-3 rounded-xl bg-[#0E0E0E] text-white text-xs font-bold hover:bg-[#262626] transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Sliders size={14} weight="bold" className="text-[#FBBF24]" />
                        <span>Customize Guided Timeline</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1 pt-1">
                      <label className="text-[10px] font-bold text-[#707070] block">
                        Focus Theme (Optional)
                      </label>
                      <input
                        type="text"
                        value={inviteFocus}
                        onChange={(e) => setInviteFocus(e.target.value)}
                        placeholder="e.g. Surrender & Divine Peace"
                        className="w-full px-3.5 py-2 bg-[#FAF6EE] border border-[#E5E7EB] rounded-xl text-xs text-[#0E0E0E] focus:outline-none focus:border-[#FBBF24]"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* 3. Study Mode Passage Input & Preset Chips */}
              {inviteDiscipline === 'study' && (
                <div className="space-y-2 p-3.5 bg-white border border-[#E5E7EB] rounded-2xl shadow-xs">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-[#707070] uppercase tracking-wider block">
                      Scripture Study Passage
                    </label>
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                      In-App Bible Ready
                    </span>
                  </div>
                  <input
                    type="text"
                    value={studyPassage}
                    onChange={(e) => setStudyPassage(e.target.value)}
                    placeholder="e.g. Hebrews 11 - Faith & Endurance"
                    className="w-full px-3.5 py-2.5 bg-[#FAF6EE] border border-[#E5E7EB] rounded-xl text-xs text-[#0E0E0E] focus:outline-none focus:border-[#FBBF24] font-medium"
                  />
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                    {['Hebrews 11', 'Romans 8', 'Psalm 23', 'John 15', 'Ephesians 6'].map((ref) => (
                      <button
                        key={ref}
                        type="button"
                        onClick={() => setStudyPassage(ref)}
                        className="px-2 py-0.5 rounded-lg bg-[#FAF6EE] hover:bg-[#F3F4F6] border border-[#E5E7EB] text-[10px] font-bold text-[#707070] hover:text-[#0E0E0E] whitespace-nowrap cursor-pointer"
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
                    <label className="text-[11px] font-bold text-[#707070] uppercase tracking-wider">
                      Target Duration
                    </label>
                    <span className="text-xs font-black font-mono text-[#FBBF24] bg-[#0E0E0E] px-2.5 py-0.5 rounded-lg">
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
                            ? 'bg-[#FBBF24] text-[#0E0E0E] shadow-sm'
                            : 'bg-white border border-[#E5E7EB] text-[#707070] hover:border-[#FBBF24]'
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
              <div className="pt-2 border-t border-[#E5E7EB] space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-bold text-[#0E0E0E] flex items-center gap-1.5">
                      <CalendarCheck size={15} className="text-[#FBBF24]" weight="bold" />
                      <span>Schedule for Later</span>
                    </label>
                    <p className="text-[10px] text-[#707070]">
                      Synchronizes start time automatically
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsScheduleEnabled((s) => !s)}
                    className={`w-11 h-6 rounded-full transition-colors relative p-1 cursor-pointer ${
                      isScheduleEnabled ? 'bg-[#0E0E0E]' : 'bg-[#E5E7EB]'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white shadow-md transition-transform ${
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
                            ? 'bg-[#0E0E0E] text-white border-[#0E0E0E] font-bold shadow-xs'
                            : 'bg-white border-[#E5E7EB] text-[#707070] hover:border-[#FBBF24]'
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
                            ? 'bg-[#0E0E0E] text-white border-[#0E0E0E] font-bold shadow-xs'
                            : 'bg-white border-[#E5E7EB] text-[#707070] hover:border-[#FBBF24]'
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
                            ? 'bg-[#0E0E0E] text-white border-[#0E0E0E] font-bold shadow-xs'
                            : 'bg-white border-[#E5E7EB] text-[#707070] hover:border-[#FBBF24]'
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
                            ? 'bg-[#0E0E0E] text-white border-[#0E0E0E] font-bold shadow-xs'
                            : 'bg-white border-[#E5E7EB] text-[#707070] hover:border-[#FBBF24]'
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
                        className="w-full px-3.5 py-2.5 bg-white border border-[#E5E7EB] rounded-2xl text-xs font-mono-tabular focus:outline-none focus:border-[#FBBF24]"
                      />
                    )}
                  </div>
                )}
              </div>

              {/* Submit CTA */}
              <button
                type="submit"
                className="w-full bg-[#0E0E0E] text-white py-4 rounded-2xl font-black text-sm shadow-xl shadow-black/15 hover:bg-[#262626] active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isScheduleEnabled ? (
                  <>
                    <CalendarCheck size={18} className="text-[#FBBF24]" weight="bold" />
                    <span>Schedule Clock-In</span>
                  </>
                ) : (
                  <>
                    <Play size={18} weight="fill" className="text-[#FBBF24]" />
                    <span>Start Live Devotion</span>
                  </>
                )}
              </button>
            </form>
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
      {/* 5. THE LIVE 1-ON-1 OVERLAY UI                                             */}
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
                  <span>LIVE 2-WAY SYNC</span>
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
                      ? 'bg-[#FBBF24]/20 border-[#FBBF24]/40 text-[#FBBF24]'
                      : 'bg-white/10 border-white/20 text-white/50 hover:text-white'
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
                    className="w-8 h-8 rounded-full bg-[#FBBF24] text-[#0E0E0E] font-black text-xs flex items-center justify-center border-2 border-[#0E0E0E] ring-2 ring-emerald-400 shadow-md"
                    title="You (Present)"
                  >
                    Me
                  </div>
                  <div
                    className="w-8 h-8 rounded-full bg-white text-[#0E0E0E] font-black text-xs flex items-center justify-center border-2 border-[#0E0E0E] ring-2 ring-emerald-400 shadow-md"
                    title={`${buddyName} (Present)`}
                  >
                    {buddyInitial}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowEndConfirm(true)}
                  className="py-1.5 px-3 rounded-xl bg-white/10 hover:bg-rose-600 text-white font-bold text-xs flex items-center gap-1 transition-all cursor-pointer"
                >
                  <X size={16} />
                  <span>Exit</span>
                </button>
              </div>
            </div>

            {/* Middle Section: Stopwatch Ring & Contextual Study / Prayer Phase Card */}
            <div className="flex flex-col items-center justify-center space-y-4 my-auto">
              {/* Circular Stopwatch */}
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
                    className="w-full py-3 px-4 rounded-2xl bg-[#FBBF24] text-[#0E0E0E] hover:bg-[#f5b81b] active:scale-95 transition-all font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#FBBF24]/20 cursor-pointer"
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
                  <div className="p-4 rounded-3xl bg-white/10 backdrop-blur-md border border-white/20 text-center max-w-sm w-full space-y-2 shadow-xl animate-in fade-in">
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
                  <div className="p-3.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-xs italic text-slate-200 max-w-xs text-center shadow-lg">
                    &ldquo;{liveFocusText}&rdquo;
                  </div>
                ) : null
              )}
            </div>

            {/* Bottom Bar: Action Finish Button */}
            <div className="flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => setShowEndConfirm(true)}
                className="py-3 px-6 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-2 shadow-lg active:scale-95 transition-all cursor-pointer"
              >
                <Square size={16} weight="fill" />
                <span>Finish & Credit Target</span>
              </button>
            </div>
          </div>
        )
      })()}

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
