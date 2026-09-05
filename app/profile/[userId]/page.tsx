'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  CaretLeft,
  UserPlus,
  Check,
  HandsPraying,
  BookOpen,
  Church,
  Copy,
  CircleNotch,
  ChatCircle,
} from '@phosphor-icons/react'
import { createClient } from '@/lib/supabase/client'
import { shareOrCopyCode } from '@/lib/utils/syncCodes'

export default function OtherUserProfilePage() {
  const params = useParams()
  const router = useRouter()
  const targetUserId = params?.userId as string

  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [connectionStatus, setConnectionStatus] = useState<'none' | 'pending' | 'incoming_pending' | 'accepted'>('none')
  const [connectionId, setConnectionId] = useState<string | null>(null)
  const [sendingRequest, setSendingRequest] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)

  // Faith Walk Summary (Privacy-preserving: Active Today vs Pending)
  const [prayerActiveToday, setPrayerActiveToday] = useState(false)
  const [studyActiveToday, setStudyActiveToday] = useState(false)

  useEffect(() => {
    async function loadOtherUserProfile() {
      if (!targetUserId) return

      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        setCurrentUser(user)

        // If viewing yourself, redirect to your private profile
        if (user && user.id === targetUserId) {
          router.replace('/profile')
          return
        }

        // 1. Fetch Target Profile
        const { data: targetProfile, error: profErr } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url, bio, buddy_code')
          .eq('id', targetUserId)
          .maybeSingle()

        if (profErr || !targetProfile) {
          // Graceful fallback for mock preview
          setProfile({
            id: targetUserId,
            display_name: 'Faithful Believer',
            church: 'Local Assembly',
            bio: 'Walking in faith daily. Seeking God in prayer and Scripture study.',
            avatar_url: null,
            buddy_code: `SYNC-${targetUserId.slice(0, 4).toUpperCase()}`,
          })
          setPrayerActiveToday(true)
          setStudyActiveToday(false)
        } else {
          setProfile({
            ...targetProfile,
            church: (targetProfile as any).church || 'Local Assembly',
          })

          // 2. Check Connection Status
          if (user) {
            const { data: conn } = await supabase
              .from('buddies')
              .select('id, user_id, buddy_id, status')
              .or(
                `and(user_id.eq.${user.id},buddy_id.eq.${targetUserId}),and(user_id.eq.${targetUserId},buddy_id.eq.${user.id})`
              )
              .maybeSingle()

            if (conn) {
              setConnectionId(conn.id)
              if (conn.status === 'accepted') {
                setConnectionStatus('accepted')
              } else if (conn.status === 'pending') {
                if (conn.user_id === targetUserId) {
                  setConnectionStatus('incoming_pending')
                } else {
                  setConnectionStatus('pending')
                }
              }
            }
          }

          // 3. Check Today's Activity (Boolean only, no minute counts revealed)
          const startOfToday = new Date()
          startOfToday.setHours(0, 0, 0, 0)

          const { data: todaySessions } = await supabase
            .from('sessions')
            .select('type, is_complete')
            .eq('user_id', targetUserId)
            .gte('started_at', startOfToday.toISOString())

          if (todaySessions && todaySessions.length > 0) {
            setPrayerActiveToday(todaySessions.some((s) => s.type === 'prayer'))
            setStudyActiveToday(todaySessions.some((s) => s.type === 'study' || s.type === 'word'))
          }
        }
      } catch (err) {
        console.error('Failed to load user profile:', err)
      } finally {
        setLoading(false)
      }
    }

    loadOtherUserProfile()
  }, [targetUserId, router])

  // Send Buddy Request ("Connect as Buddy")
  const sendBuddyRequest = async () => {
    if (!currentUser) {
      router.push('/login')
      return
    }

    setSendingRequest(true)
    try {
      const { sendBuddyRequest: sendReq } = await import('@/features/buddies/services/buddyService')
      const res = await sendReq(targetUserId, currentUser.id)
      if (res.success) {
        setConnectionStatus(res.status)
      }
    } catch (err) {
      console.error('Failed to send buddy request:', err)
    } finally {
      setSendingRequest(false)
    }
  }

  // Approve Incoming Request
  const handleApproveIncoming = async () => {
    if (!connectionId || !currentUser) return
    setSendingRequest(true)
    try {
      const { approveBuddyRequest } = await import('@/features/buddies/services/buddyService')
      const res = await approveBuddyRequest(connectionId, currentUser.id)
      if (res.success) {
        setConnectionStatus('accepted')
      }
    } catch (err) {
      console.error('Approve error:', err)
    } finally {
      setSendingRequest(false)
    }
  }

  // Ignore Request
  const handleIgnoreIncoming = async () => {
    if (!connectionId) return
    try {
      const { deleteBuddyConnection } = await import('@/features/buddies/services/buddyService')
      await deleteBuddyConnection(connectionId)
      setConnectionStatus('none')
    } catch (err) {
      console.error('Ignore error:', err)
    }
  }

  // Copy Buddy Code
  const handleCopyBuddyCode = async () => {
    if (!profile?.buddy_code) return
    await shareOrCopyCode({
      code: profile.buddy_code,
      title: `${profile.display_name} on FaithSync`,
      text: `Connect with ${profile.display_name} on FaithSync using buddy code: ${profile.buddy_code}`,
    })
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  if (loading) {
    return (
      <div className="command-center-container px-4 sm:px-6 pt-16 flex flex-col items-center justify-center space-y-2 min-h-[60vh] text-text-secondary">
        <CircleNotch size={24} className="animate-spin text-[#FBBF24]" />
        <p className="text-xs font-bold">Loading profile...</p>
      </div>
    )
  }

  const displayName = profile?.display_name || 'Believer'
  const church = profile?.church || 'Local Assembly'
  const bio = profile?.bio || ''
  const initial = displayName.charAt(0).toUpperCase()
  const avatarUrl = profile?.avatar_url
  const buddyCode = profile?.buddy_code || `SYNC-${targetUserId.slice(0, 4).toUpperCase()}`

  return (
    <div className="command-center-container px-4 sm:px-6 pt-3 pb-28 space-y-4">
      {/* 1. Header & Back Navigation */}
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <button
          type="button"
          onClick={() => router.back()}
          className="p-2 rounded-xl text-text-secondary hover:text-text-primary hover:bg-subtle/50 transition-colors flex items-center gap-1.5 text-xs font-bold"
        >
          <CaretLeft size={18} />
          <span>Back</span>
        </button>

        <h1 className="text-sm font-extrabold text-text-primary tracking-tight">Public Profile</h1>
        <div className="w-8" />
      </div>

      {/* 1. The Identity Section (Top Card) */}
      <div className="faith-card p-6 text-center space-y-4 bg-card border border-border">
        {/* Avatar: Uploaded photo or fallback solid gold circle with first initial */}
        <div className="relative mx-auto w-24 h-24 rounded-full bg-[#FBBF24] text-text-primary flex items-center justify-center text-3xl font-black shadow-lg border-2 border-white ring-2 ring-[#FBBF24]/35 overflow-hidden">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
          ) : (
            <span>{initial}</span>
          )}
        </div>

        {/* Display Name & Church Pill */}
        <div className="space-y-2">
          <h2 className="text-xl sm:text-2xl font-black text-text-primary tracking-tight">
            {displayName}
          </h2>

          {/* Bright green pill for Local Assembly */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-400 border border-emerald-300/40 dark:border-emerald-700/40 text-xs font-bold">
            <Church size={13} className="text-emerald-700 dark:text-emerald-400" />
            <span>{church}</span>
          </div>

          {/* Bio: Centered, italicized, muted gray font */}
          {bio && (
            <p className="text-xs text-text-secondary italic pt-1 max-w-xs mx-auto leading-relaxed">
              &ldquo;{bio}&rdquo;
            </p>
          )}
        </div>

        {/* Sync Code Badge (Tap to Copy) */}
        <div
          onClick={handleCopyBuddyCode}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface border border-border cursor-pointer hover:border-[#FBBF24] transition-all group"
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">
            CODE:
          </span>
          <span className="text-xs font-mono font-black text-text-primary">
            {buddyCode}
          </span>
          <div className="text-[#FBBF24]">
            {copiedCode ? (
              <Check size={13} weight="bold" className="text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Copy size={13} />
            )}
          </div>
        </div>

        {/* 2. The Primary Action: "Connect as Buddy" */}
        <div className="pt-2">
          {connectionStatus === 'accepted' ? (
            <Link href={`/buddy-chat/${targetUserId}`} className="block">
              <button
                type="button"
                className="w-full bg-[#0E0E0E] dark:bg-white/90 text-white dark:text-[#0E0E0E] py-3.5 rounded-full font-bold text-xs shadow-md flex items-center justify-center gap-2 hover:bg-[#262626] dark:hover:bg-white/80 active:scale-95 transition-all cursor-pointer"
              >
                <ChatCircle size={16} />
                <span>Open Buddy Chat</span>
              </button>
            </Link>
          ) : connectionStatus === 'incoming_pending' ? (
            <div className="p-4 rounded-2xl bg-[#FDF9F1] dark:bg-amber-950/30 border border-[#FBBF24]/40 dark:border-amber-500/30 space-y-2.5 animate-in fade-in">
              <p className="text-xs font-bold text-text-primary">
                {displayName} sent you an accountability buddy request!
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleApproveIncoming}
                  disabled={sendingRequest}
                  className="flex-1 bg-[#0E0E0E] dark:bg-white/90 text-white dark:text-[#0E0E0E] py-2.5 rounded-xl font-bold text-xs shadow-sm hover:bg-[#262626] dark:hover:bg-white/80 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Check size={14} weight="bold" className="text-[#FBBF24]" />
                  <span>{sendingRequest ? 'Approving...' : 'Approve Request'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleIgnoreIncoming}
                  className="px-4 py-2.5 bg-card border border-border text-text-secondary rounded-xl font-bold text-xs hover:text-[#EA2C26] dark:text-red-400 transition-all cursor-pointer"
                >
                  Ignore
                </button>
              </div>
            </div>
          ) : connectionStatus === 'pending' ? (
            <button
              type="button"
              disabled
              className="w-full bg-surface border border-border text-text-secondary py-3.5 rounded-full font-bold text-xs flex items-center justify-center gap-2 cursor-not-allowed opacity-80"
            >
              <Check size={16} weight="bold" className="text-emerald-600 dark:text-emerald-400" />
              <span>Request Sent</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={sendBuddyRequest}
              disabled={sendingRequest}
              className="w-full bg-[#0E0E0E] dark:bg-white/90 text-white dark:text-[#0E0E0E] py-3.5 rounded-full font-bold text-xs shadow-lg shadow-black/15 flex items-center justify-center gap-2 hover:bg-[#262626] dark:hover:bg-white/80 active:scale-95 transition-all cursor-pointer"
            >
              <UserPlus size={16} weight="bold" />
              <span>{sendingRequest ? 'Sending Request...' : 'Connect as Buddy'}</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. The "FAITH WALK" Section (Abstracted Accountability) */}
      <div className="faith-card p-5 space-y-3.5 bg-card border border-border">
        <div className="flex items-center justify-between pb-1 border-b border-border-light">
          <span className="text-[11px] font-black uppercase tracking-wider text-text-primary">
            FAITH WALK
          </span>
          <span className="text-[10px] font-bold text-text-secondary">Daily Rhythm</span>
        </div>

        <div className="space-y-2.5">
          {/* Row 1: Faithful in Prayer */}
          <div className="p-3.5 rounded-2xl bg-surface border border-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-card border border-border flex items-center justify-center text-text-primary shadow-2xs">
                <HandsPraying size={16} weight="fill" className="text-[#FBBF24]" />
              </div>
              <span className="text-xs font-black text-text-primary">Faithful in Prayer</span>
            </div>

            {prayerActiveToday ? (
              <span className="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400 text-[10px] font-black inline-flex items-center gap-1 border border-emerald-200 dark:border-emerald-700/40">
                <Check size={11} weight="bold" />
                <span>Active Today</span>
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full bg-subtle text-text-muted text-[10px] font-bold border border-border">
                Pending
              </span>
            )}
          </div>

          {/* Row 2: Student of the Word */}
          <div className="p-3.5 rounded-2xl bg-surface border border-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-card border border-border flex items-center justify-center text-text-primary shadow-2xs">
                <BookOpen size={16} weight="fill" className="text-[#FBBF24]" />
              </div>
              <span className="text-xs font-black text-text-primary">Student of the Word</span>
            </div>

            {studyActiveToday ? (
              <span className="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400 text-[10px] font-black inline-flex items-center gap-1 border border-emerald-200 dark:border-emerald-700/40">
                <Check size={11} weight="bold" />
                <span>Active Today</span>
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full bg-subtle text-text-muted text-[10px] font-bold border border-border">
                Pending
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
