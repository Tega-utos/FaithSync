'use client'

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  CaretLeft,
  Copy,
  Check,
  PencilSimple,
  Fire,
  Trophy,
  ShareNetwork,
  Users,
  CaretRight,
  CaretDown,
  Lock,
  Bell,
  Shield,
  SignOut,
  Sparkle,
  BookOpen,
  X,
  CircleNotch,
  Church,
  Lightning,
  HandWaving,
  UserPlus,
  CalendarCheck,
  Notebook,
  HourglassMedium,
  CheckCircle,
  User,
  Quotes,
  HandsPraying,
} from '@phosphor-icons/react'
import { createClient } from '@/lib/supabase/client'
import { shareOrCopyCode } from '@/lib/utils/syncCodes'
import { calculateUserStreak } from '@/lib/utils/streak'

interface BuddyPartner {
  id: string
  connectionId: string
  name: string
  initial: string
  church?: string
  permissions: {
    canInviteToClockIn: boolean
    sendNotificationOnStart: boolean
    canViewDetailedHistory: boolean
  }
}

interface PendingBuddyRequest {
  id: string
  senderId: string
  senderName: string
  senderInitial: string
}

interface MilestoneStats {
  completedSessions: number
  totalMinutes: number
  currentStreakDays: number
  prayerMinutes: number
  studyMinutes: number
}

const BADGE_PREVIEWS = [
  {
    id: 'first_step',
    title: 'First Step',
    description: 'Complete your first verified session',
    icon: Sparkle,
    unlockedWhen: (stats: MilestoneStats) => stats.completedSessions >= 1,
  },
  {
    id: 'fire_starter',
    title: 'Fire Starter',
    description: 'Maintain a 3-day consistency streak',
    icon: Fire,
    unlockedWhen: (stats: MilestoneStats) => stats.currentStreakDays >= 3,
  },
  {
    id: '7_day_streak',
    title: '7 Day Streak',
    description: 'Consistency is key — 7 days in a row',
    icon: Trophy,
    unlockedWhen: (stats: MilestoneStats) => stats.currentStreakDays >= 7,
  },
]

export default function ProfilePage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(true)
  const [displayName, setDisplayName] = useState('Believer')
  const [church, setChurch] = useState('Local Assembly')
  const [bio, setBio] = useState('Seeking first the Kingdom of God.')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [buddyCode, setBuddyCode] = useState('SYNC-1234')
  const [copiedCode, setCopiedCode] = useState(false)

  // Progression Stats
  const [streakDays, setStreakDays] = useState(0)
  const [squareShareCount, setSquareShareCount] = useState(0)
  const [milestoneStats, setMilestoneStats] = useState<MilestoneStats>({
    completedSessions: 0,
    totalMinutes: 0,
    currentStreakDays: 0,
    prayerMinutes: 0,
    studyMinutes: 0,
  })

  // Daily Targets
  const [prayerTarget, setPrayerTarget] = useState(15)
  const [studyTarget, setStudyTarget] = useState(15)
  const [todayPrayerMins, setTodayPrayerMins] = useState(0)
  const [todayStudyMins, setTodayStudyMins] = useState(0)
  const [prayerReminderTime, setPrayerReminderTime] = useState('07:00')
  const [studyReminderTime, setStudyReminderTime] = useState('21:00')

  // Accountability Buddies & Granular Permissions
  const [buddies, setBuddies] = useState<BuddyPartner[]>([])
  const [pendingRequests, setPendingRequests] = useState<PendingBuddyRequest[]>([])
  const [expandedBuddyId, setExpandedBuddyId] = useState<string | null>(null)
  const [nudgedWaves, setNudgedWaves] = useState<Record<string, boolean>>({})

  // Modals
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false)
  const [isEditTargetsOpen, setIsEditTargetsOpen] = useState(false)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false)

  // Form states
  const [editName, setEditName] = useState('')
  const [editChurch, setEditChurch] = useState('')
  const [editBio, setEditBio] = useState('')
  const [tempPrayerTarget, setTempPrayerTarget] = useState(15)
  const [tempStudyTarget, setTempStudyTarget] = useState(15)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)

  // Settings
  const [notifDailyReminders, setNotifDailyReminders] = useState(true)
  const [notifBuddyNudges, setNotifBuddyNudges] = useState(true)
  const [notifGroupActivity, setNotifGroupActivity] = useState(true)
  const [reviewDayOfWeek, setReviewDayOfWeek] = useState('Sunday')
  const [reviewReminderTime, setReviewReminderTime] = useState('18:00')
  const [monthReviewSchedule, setMonthReviewSchedule] = useState('last_day')
  const [monthReviewReminderTime, setMonthReviewReminderTime] = useState('19:00')
  const [publicStreak, setPublicStreak] = useState(true)
  const [publicMilestones, setPublicMilestones] = useState(true)

  useEffect(() => {
    async function loadProfile() {
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          router.push('/login')
          return
        }

        // 1. Fetch Profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle()

        const resolvedName =
          profile?.display_name ||
          user.user_metadata?.full_name ||
          user.user_metadata?.display_name ||
          'Believer'
        const resolvedChurch =
          profile?.church || user.user_metadata?.church || 'Local Assembly'
        const resolvedBio =
          profile?.bio || user.user_metadata?.bio || 'Seeking the Lord daily.'

        setDisplayName(resolvedName)
        setChurch(resolvedChurch)
        setBio(resolvedBio)
        setEditName(resolvedName)
        setEditChurch(resolvedChurch)
        setEditBio(resolvedBio)
        setAvatarUrl(profile?.avatar_url || user.user_metadata?.avatar_url || null)
        
        let validBuddyCode = profile?.buddy_code
        if (!validBuddyCode) {
          const generated = user.id.replace(/-/g, '').slice(0, 6).toUpperCase()
          validBuddyCode = generated
          supabase.from('profiles').update({ buddy_code: generated }).eq('id', user.id).then(() => {})
        }
        setBuddyCode(validBuddyCode)

        const prefs = (profile?.preferences as any) || user.user_metadata?.preferences || {}
        const pT = prefs.prayerTarget || prefs.targets?.prayer || 15
        const sT = prefs.studyTarget || prefs.wordTarget || prefs.targets?.study || 15
        setPrayerTarget(pT)
        setStudyTarget(sT)
        setTempPrayerTarget(pT)
        setTempStudyTarget(sT)
        setPrayerReminderTime(prefs.prayerReminderTime || '07:00')
        setStudyReminderTime(prefs.studyReminderTime || '21:00')
        setNotifDailyReminders(prefs.notifDailyReminders ?? true)
        setNotifBuddyNudges(prefs.notifBuddyNudges ?? true)
        setNotifGroupActivity(prefs.notifGroupActivity ?? true)
        setReviewDayOfWeek(prefs.reviewDayOfWeek || 'Sunday')
        setReviewReminderTime(prefs.reviewReminderTime || '18:00')
        setMonthReviewSchedule(prefs.monthReviewSchedule || 'last_day')
        setMonthReviewReminderTime(prefs.monthReviewReminderTime || '19:00')
        setPublicStreak(prefs.publicStreak ?? true)
        setPublicMilestones(prefs.publicMilestones ?? true)

        // 2. Calculate Verified Sessions & Streaks
        const { data: allSessions } = await supabase
          .from('sessions')
          .select('type, duration_seconds, target_duration_seconds, is_complete, started_at, created_at, shared_to_square')
          .eq('user_id', user.id)
          .order('started_at', { ascending: false })

        if (allSessions && allSessions.length > 0) {
          const verified = allSessions.filter(
            (s) =>
              s.is_complete ||
              (s.duration_seconds > 0 &&
                s.duration_seconds >= (s.target_duration_seconds || 0))
          )

          let totalPrayerSecs = 0
          let totalStudySecs = 0
          let publicCount = 0
          const uniqueDays = new Set<string>()

          allSessions.forEach((s) => {
            if (s.shared_to_square) publicCount++
          })

          verified.forEach((s) => {
            if (s.type === 'prayer') totalPrayerSecs += s.duration_seconds
            if (s.type === 'study' || s.type === 'word') totalStudySecs += s.duration_seconds
            const dateStr = new Date(s.started_at || s.created_at).toISOString().split('T')[0]
            uniqueDays.add(dateStr)
          })

          const pMins = Math.floor(totalPrayerSecs / 60)
          const sMins = Math.floor(totalStudySecs / 60)
          const realStreak = await calculateUserStreak(user.id, supabase)
          setStreakDays(realStreak)
          setSquareShareCount(publicCount)
          setMilestoneStats({
            completedSessions: verified.length,
            totalMinutes: pMins + sMins,
            currentStreakDays: realStreak,
            prayerMinutes: pMins,
            studyMinutes: sMins,
          })
        }

        // 3. Calculate Today's Logged Minutes
        const startOfToday = new Date()
        startOfToday.setHours(0, 0, 0, 0)

        const { data: todaySessions } = await supabase
          .from('sessions')
          .select('type, duration_seconds')
          .eq('user_id', user.id)
          .gte('started_at', startOfToday.toISOString())

        if (todaySessions) {
          let pToday = 0
          let sToday = 0
          todaySessions.forEach((s) => {
            if (s.type === 'prayer') pToday += s.duration_seconds
            if (s.type === 'study' || s.type === 'word') sToday += s.duration_seconds
          })
          setTodayPrayerMins(Math.floor(pToday / 60))
          setTodayStudyMins(Math.floor(sToday / 60))
        }

        // 4. Fetch Accountability Buddies & Incoming Requests
        const { data: buddiesData } = await supabase
          .from('buddies')
          .select('id, user_id, buddy_id, status, permissions')
          .or(`user_id.eq.${user.id},buddy_id.eq.${user.id}`)

        if (buddiesData) {
          const accepted = buddiesData.filter((b) => b.status === 'accepted')
          const pending = buddiesData.filter(
            (b) => b.status === 'pending' && b.buddy_id === user.id
          )

          const partnerIds = accepted.map((b) => (b.user_id === user.id ? b.buddy_id : b.user_id))
          const senderIds = pending.map((b) => b.user_id)
          const allProfileIds = Array.from(new Set([...partnerIds, ...senderIds]))

          if (allProfileIds.length > 0) {
            const { data: profiles } = await supabase
              .from('profiles')
              .select('id, display_name, church')
              .in('id', allProfileIds)

            const profileMap = (profiles || []).reduce((acc: any, p) => {
              acc[p.id] = p
              return acc
            }, {})

            setBuddies(
              accepted.map((b) => {
                const partnerId = b.user_id === user.id ? b.buddy_id : b.user_id
                const p = profileMap[partnerId] || {}
                const rawName = p.display_name || 'Faith Buddy'
                const perm = (b.permissions as any) || {}
                return {
                  id: partnerId,
                  connectionId: b.id,
                  name: rawName,
                  initial: rawName.charAt(0).toUpperCase(),
                  church: p.church || 'Grace Assembly',
                  permissions: {
                    canInviteToClockIn: perm.canInviteToClockIn ?? true,
                    sendNotificationOnStart: perm.sendNotificationOnStart ?? true,
                    canViewDetailedHistory: perm.canViewDetailedHistory ?? false,
                  },
                }
              })
            )

            setPendingRequests(
              pending.map((req) => {
                const p = profileMap[req.user_id] || {}
                const rawName = p.display_name || 'New Believer'
                return {
                  id: req.id,
                  senderId: req.user_id,
                  senderName: rawName,
                  senderInitial: rawName.charAt(0).toUpperCase(),
                }
              })
            )
          }
        }
      } catch (err) {
        console.error('Profile load error:', err)
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [router])

  // Copy & Share Buddy Code
  const handleCopyCode = async () => {
    await shareOrCopyCode({
      code: buddyCode,
      title: 'Join me on FaithSync',
      text: `Let's sync our spiritual habits on FaithSync! Add my buddy code: ${buddyCode}`,
    })
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  // Upload Avatar
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setUploadingAvatar(true)
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      const fileExt = file.name.split('.').pop()
      const filePath = `${user.id}-${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(filePath)
      const newAvatarUrl = publicUrlData.publicUrl

      await supabase
        .from('profiles')
        .update({ avatar_url: newAvatarUrl, updated_at: new Date().toISOString() })
        .eq('id', user.id)

      setAvatarUrl(newAvatarUrl)
    } catch (err) {
      console.error('Avatar upload failed:', err)
    } finally {
      setUploadingAvatar(false)
    }
  }

  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Open Edit Modal with Pre-filled values
  const handleOpenEditModal = () => {
    setEditName(displayName)
    setEditChurch(church)
    setEditBio(bio)
    setIsEditProfileOpen(true)
  }

  // Save Identity Modal (Optimistic UI Update + Background Sync + Toast)
  const handleSaveIdentity = async (e: React.FormEvent) => {
    e.preventDefault()

    const prevName = displayName
    const prevChurch = church
    const prevBio = bio

    const newName = editName.trim() || 'Believer'
    const newChurch = editChurch.trim() || 'Local Assembly'
    const newBio = editBio.trim() || 'Seeking first the Kingdom.'

    // 1. Immediate Local Update & Modal Close (Optimistic UI)
    setDisplayName(newName)
    setChurch(newChurch)
    setBio(newBio)
    setIsEditProfileOpen(false)
    setToastMessage('Profile updated ✓')
    setTimeout(() => setToastMessage(null), 3000)

    // 2. Multi-tier Background Database Sync (Upsert + Auth User Metadata)
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      // Update Auth User Metadata
      await supabase.auth.updateUser({
        data: {
          display_name: newName,
          full_name: newName,
          church: newChurch,
          bio: newBio,
        },
      })

      // Upsert into profiles table
      await (supabase.from('profiles') as any).upsert({
        id: user.id,
        display_name: newName,
        church: newChurch,
        bio: newBio,
        updated_at: new Date().toISOString(),
      })
    } catch (err: any) {
      console.error('Identity update error:', err)
    }
  }

  // Open Edit Targets Modal with Current Values
  const handleOpenEditTargets = () => {
    setTempPrayerTarget(prayerTarget || 15)
    setTempStudyTarget(studyTarget || 15)
    setIsEditTargetsOpen(true)
  }

  // Save Targets Modal (Optimistic UI + Cross-Screen Local Storage + Multi-tier DB Sync)
  const handleSaveTargets = async (e: React.FormEvent) => {
    e.preventDefault()

    const finalPrayer = Math.max(1, Math.min(tempPrayerTarget || 15, 720))
    const finalStudy = Math.max(1, Math.min(tempStudyTarget || 15, 720))

    const prevPrayer = prayerTarget
    const prevStudy = studyTarget

    // 1. Immediate optimistic UI update
    setPrayerTarget(finalPrayer)
    setStudyTarget(finalStudy)
    setIsEditTargetsOpen(false)
    setToastMessage('Goals & reminders updated ✓')
    setTimeout(() => setToastMessage(null), 3000)

    // Cross-screen reactive cache
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(
          'faithsync_user_targets',
          JSON.stringify({
            prayerTarget: finalPrayer,
            studyTarget: finalStudy,
            prayerReminderTime,
            studyReminderTime,
          })
        )
      }
    } catch (_) {}

    // 2. Multi-tier Background sync
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('id', user.id)
        .single()

      const prevPrefs = (profile?.preferences as any) || {}
      const newPrefs = {
        ...prevPrefs,
        prayerTarget: finalPrayer,
        studyTarget: finalStudy,
        prayerReminderTime,
        studyReminderTime,
      }

      await supabase
        .from('profiles')
        .update({
          preferences: newPrefs,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)
    } catch (err) {
      console.error('Targets update error:', err)
      // Rollback on error
      setPrayerTarget(prevPrayer)
      setStudyTarget(prevStudy)
    }
  }

  // Save Notification Preferences
  const handleSaveNotifications = async () => {
    setIsNotificationsOpen(false)
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('id', user.id)
        .single()

      const prevPrefs = (profile?.preferences as any) || {}
      const newPrefs = {
        ...prevPrefs,
        notifDailyReminders,
        notifBuddyNudges,
        notifGroupActivity,
        reviewDayOfWeek,
        reviewReminderTime,
        monthReviewSchedule,
        monthReviewReminderTime,
      }

      await supabase
        .from('profiles')
        .update({
          preferences: newPrefs,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      if (typeof window !== 'undefined') {
        localStorage.setItem('faithsync_user_notif_prefs', JSON.stringify(newPrefs))
      }
    } catch (err) {
      console.error('Failed to save notification preferences:', err)
    }
  }

  // Save Privacy Preferences
  const handleSavePrivacy = async () => {
    setIsPrivacyOpen(false)
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('id', user.id)
        .single()

      const prevPrefs = (profile?.preferences as any) || {}
      const newPrefs = {
        ...prevPrefs,
        publicStreak,
        publicMilestones,
      }

      await supabase
        .from('profiles')
        .update({
          preferences: newPrefs,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      if (typeof window !== 'undefined') {
        localStorage.setItem('faithsync_user_privacy_prefs', JSON.stringify(newPrefs))
      }
    } catch (err) {
      console.error('Failed to save privacy settings:', err)
    }
  }

  // Nudge Buddy Action with Ripple Wave
  const handleNudgeWithWave = async (e: React.MouseEvent, buddy: BuddyPartner) => {
    e.stopPropagation()
    setNudgedWaves((prev) => ({ ...prev, [buddy.id]: true }))

    try {
      await fetch('/api/buddy/nudge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buddyId: buddy.id,
          connectionId: buddy.connectionId,
        }),
      })
    } catch {}

    setTimeout(() => {
      setNudgedWaves((prev) => ({ ...prev, [buddy.id]: false }))
    }, 2500)
  }

  // Toggle Buddy Permission
  const handleTogglePermission = async (
    buddy: BuddyPartner,
    field: keyof BuddyPartner['permissions']
  ) => {
    const updatedPerms = {
      ...buddy.permissions,
      [field]: !buddy.permissions[field],
    }

    setBuddies((prev) =>
      prev.map((b) => (b.id === buddy.id ? { ...b, permissions: updatedPerms } : b))
    )

    try {
      const supabase = createClient()
      await supabase
        .from('buddies')
        .update({
          permissions: updatedPerms,
          updated_at: new Date().toISOString(),
        })
        .eq('id', buddy.connectionId)
    } catch (err) {
      console.error('Failed to update permission:', err)
    }
  }

  // Robust Sign Out Handler
  const handleSignOut = async () => {
    if (isSigningOut) return
    setIsSigningOut(true)
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
    } catch (err) {
      console.error('Sign out error:', err)
    } finally {
      if (typeof window !== 'undefined') {
        try {
          localStorage.clear()
          sessionStorage.clear()
        } catch {}
        window.location.href = '/welcome'
      }
    }
  }

  // Progress percentages
  const prayerPercent = Math.min(100, Math.round((todayPrayerMins / (prayerTarget || 15)) * 100))
  const studyPercent = Math.min(100, Math.round((todayStudyMins / (studyTarget || 15)) * 100))
  const isPrayerDone = todayPrayerMins >= prayerTarget
  const isStudyDone = todayStudyMins >= studyTarget

  const earnedBadges = BADGE_PREVIEWS.filter((b) => b.unlockedWhen(milestoneStats))

  if (loading) {
    return (
      <div className="command-center-container px-4 sm:px-6 pt-16 flex flex-col items-center justify-center space-y-2 min-h-[60vh] text-[#707070]">
        <CircleNotch size={24} className="animate-spin text-[#FBBF24]" />
        <p className="text-xs font-bold">Loading profile...</p>
      </div>
    )
  }

  return (
    <div className="command-center-container px-4 sm:px-6 pt-3 pb-28 space-y-4">
      {/* 1. Header & Back Navigation */}
      <div className="flex items-center justify-between pb-2 border-b border-[#E5E7EB]">
        <button
          type="button"
          onClick={() => router.push('/')}
          className="p-2 rounded-xl text-[#707070] hover:text-[#0E0E0E] hover:bg-[#F3F4F6]/50 transition-colors flex items-center gap-1.5 text-xs font-bold"
        >
          <CaretLeft size={18} />
          <span>Home</span>
        </button>

        <h1 className="text-sm font-extrabold text-[#0E0E0E] tracking-tight">Profile</h1>

        <button
          type="button"
          onClick={handleOpenEditModal}
          className="p-2 rounded-xl text-[#FBBF24] hover:text-[#0E0E0E] transition-colors"
          title="Edit Profile"
        >
          <PencilSimple size={18} />
        </button>
      </div>

      {/* 1. Primary Identity Card */}
      <div className="faith-card p-5 space-y-4 relative bg-white border border-[#E5E7EB]">
        <div className="flex items-center gap-4">
          {/* Dynamic Avatar with Upload & Rim Badge */}
          <div
            className="relative group cursor-pointer shrink-0"
            onClick={() => fileInputRef.current?.click()}
            title="Click to upload profile photo"
          >
            <div className="w-20 h-20 rounded-full bg-[#0E0E0E] text-white flex items-center justify-center text-2xl font-black shadow-md overflow-hidden border-2 border-white ring-2 ring-[#FBBF24]/35">
              {uploadingAvatar ? (
                <CircleNotch size={24} className="animate-spin text-[#FBBF24]" />
              ) : avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                <span>{displayName.charAt(0).toUpperCase()}</span>
              )}
            </div>

            {/* Small Gold Pencil Badge on Rim */}
            <div className="absolute bottom-0 right-0 p-1.5 bg-[#FBBF24] text-[#0E0E0E] rounded-full ring-2 ring-white shadow-sm flex items-center justify-center">
              <PencilSimple size={12} weight="bold" />
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
            />
          </div>

          {/* Editable Metadata */}
          <div
            className="flex-1 space-y-1 min-w-0 cursor-pointer"
            onClick={handleOpenEditModal}
          >
            <div className="flex items-center gap-1.5">
              <h2 className="text-base font-black text-[#0E0E0E] truncate">{displayName}</h2>
              <PencilSimple size={14} className="text-[#FBBF24]" />
            </div>

            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#F3F4F6] text-[#374151] text-[10px] font-bold">
              <Church size={11} className="text-[#FBBF24]" />
              <span>{church}</span>
            </div>

            <p className="text-xs text-[#707070] italic leading-snug line-clamp-2 pt-0.5">
              &ldquo;{bio}&rdquo;
            </p>
          </div>
        </div>

        {/* Sync Code Badge (1-Tap Copy) */}
        <div
          onClick={handleCopyCode}
          className="p-3 rounded-2xl bg-[#FDF9F1] border border-[#FBBF24]/40 flex items-center justify-between cursor-pointer hover:bg-[#FDF9F1] transition-all group"
        >
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#707070]">
              Your Sync Code:
            </span>
            <span className="text-xs font-black font-mono tracking-widest text-[#0E0E0E] bg-white px-2.5 py-0.5 rounded-md border border-[#E5E7EB] shadow-xs">
              {buddyCode}
            </span>
          </div>

          <div className="flex items-center gap-1 text-xs font-bold text-[#FBBF24]">
            {copiedCode ? (
              <>
                <Check size={14} weight="bold" />
                <span className="text-[11px] text-emerald-600">Copied! ✓</span>
              </>
            ) : (
              <>
                <Copy size={14} />
                <span className="text-[11px] group-hover:underline">Copy</span>
              </>
            )}
          </div>
        </div>

        {/* Shared Records Shortcut */}
        <Link href="/square" className="block pt-0.5">
          <div className="p-2.5 rounded-xl bg-[#FAF6EE] border border-[#E5E7EB] flex items-center justify-between hover:border-[#FBBF24]/40 transition-colors">
            <div className="flex items-center gap-2 text-xs font-bold text-[#0E0E0E]">
              <ShareNetwork size={15} className="text-[#FBBF24]" />
              <span>{squareShareCount} Public Square Post{squareShareCount === 1 ? '' : 's'}</span>
            </div>
            <span className="text-[10px] font-extrabold text-[#FBBF24] flex items-center gap-0.5">
              View Archive <CaretRight size={12} />
            </span>
          </div>
        </Link>
      </div>

      {/* 2. The Progress Hub (Streaks & Accountability) */}
      <div className="grid grid-cols-2 gap-3">
        {/* The Streak Card */}
        <div className="faith-card p-4 flex flex-col justify-between space-y-2 bg-white border border-[#E5E7EB]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#707070]">
              Streak
            </span>
            <Fire size={18} weight="fill" className="text-[#234537]" />
          </div>
          <div>
            <p className="text-xl font-black text-[#0E0E0E] font-mono-tabular">{streakDays} Days</p>
            <p className="text-[10px] text-[#707070]">Consistency is key</p>
          </div>
        </div>

        {/* Records & Milestones Shortcut */}
        <Link href="/milestones" className="block">
          <div className="faith-card p-4 flex flex-col justify-between space-y-2 bg-white border border-[#E5E7EB] hover:border-[#FBBF24]/50 transition-colors h-full">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#707070]">
                Milestones
              </span>
              <Trophy size={18} className="text-[#FBBF24]" />
            </div>
            <div>
              <p className="text-xs font-black text-[#0E0E0E]">Trophy Room</p>
              <p className="text-[10px] text-[#FBBF24] font-bold flex items-center gap-0.5 mt-0.5">
                View trophies <CaretRight size={12} />
              </p>
            </div>
          </div>
        </Link>
      </div>

      {/* Daily Accountability Card with Visual Progress Bars */}
      <div className="faith-card p-5 space-y-4 bg-white border border-[#E5E7EB]">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-[#0E0E0E]">
              Daily Accountability
            </h3>
            <p className="text-[10px] text-[#707070]">Today&apos;s goal progress</p>
          </div>

          <button
            type="button"
            onClick={handleOpenEditTargets}
            className="text-xs font-bold text-[#FBBF24] hover:underline cursor-pointer"
          >
            Edit Targets
          </button>
        </div>

        {/* Prayer Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="flex items-center gap-1.5 text-[#0E0E0E]">
              <Fire size={14} weight="fill" className="text-[#EA2C26]" />
              <span>Prayer</span>
            </span>
            <span className="font-mono-tabular text-[11px] text-[#707070]">
              {todayPrayerMins} / {prayerTarget} min
            </span>
          </div>
          <div className="w-full bg-[#F3F4F6] h-2.5 rounded-full overflow-hidden">
            <div
              className="bg-[#EA2C26] h-full rounded-full transition-all duration-700"
              style={{ width: `${prayerPercent}%` }}
            />
          </div>
        </div>

        {/* Study Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="flex items-center gap-1.5 text-[#0E0E0E]">
              <BookOpen size={14} className="text-[#FBBF24]" />
              <span>Study</span>
            </span>
            <span className="font-mono-tabular text-[11px] text-[#707070]">
              {todayStudyMins} / {studyTarget} min
            </span>
          </div>
          <div className="w-full bg-[#F3F4F6] h-2.5 rounded-full overflow-hidden">
            <div
              className="bg-[#FBBF24] h-full rounded-full transition-all duration-700"
              style={{ width: `${studyPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* 3. Records & Milestones Preview */}
      <div className="faith-card p-5 space-y-3 bg-white border border-[#E5E7EB]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy size={16} className="text-[#FBBF24]" />
            <h3 className="text-xs font-black uppercase tracking-wider text-[#0E0E0E]">
              Badges Preview
            </h3>
          </div>

          <Link href="/milestones" className="text-xs font-bold text-[#FBBF24] hover:underline">
            View All ({earnedBadges.length}/7)
          </Link>
        </div>

        {earnedBadges.length === 0 ? (
          /* Premium Dashed Empty State */
          <Link href="/clock-in" className="block">
            <div className="p-4 rounded-2xl border-2 border-dashed border-[#E5E7EB] bg-[#FAF6EE]/50 hover:bg-[#FDF9F1] hover:border-[#FBBF24]/40 transition-all text-center space-y-1.5 cursor-pointer">
              <div className="w-8 h-8 rounded-full bg-[#FDF9F1] text-[#FBBF24] flex items-center justify-center mx-auto">
                <Sparkle size={16} weight="fill" />
              </div>
              <p className="text-xs font-bold text-[#0E0E0E]">
                Complete your first session to unlock a badge
              </p>
              <p className="text-[10px] text-[#707070]">Tap to start clocking in →</p>
            </div>
          </Link>
        ) : (
          <div className="grid grid-cols-3 gap-2 pt-1">
            {earnedBadges.map((badge) => {
              const IconComp = badge.icon
              return (
                <div
                  key={badge.id}
                  className="p-3 rounded-xl bg-[#0E0E0E] text-white flex flex-col items-center text-center space-y-1 shadow-sm"
                >
                  <IconComp size={20} weight="fill" className="text-[#FBBF24]" />
                  <span className="text-[10px] font-black truncate max-w-full">{badge.title}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 4. Accountability Buddy Management */}
      <div className="faith-card p-5 space-y-4 bg-white border border-[#E5E7EB]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-[#FBBF24]" />
            <h3 className="text-xs font-black uppercase tracking-wider text-[#0E0E0E]">
              Accountability Roster
            </h3>
          </div>
          <Link href="/find-buddy" className="text-xs font-bold text-[#FBBF24] hover:underline">
            + Add Buddy
          </Link>
        </div>

        {/* Incoming Requests */}
        {pendingRequests.map((req) => (
          <div
            key={req.id}
            className="p-3 rounded-2xl bg-[#FDF9F1] border border-[#FBBF24]/35 flex items-center justify-between gap-3 animate-in fade-in"
          >
            <Link
              href={`/profile/${req.senderId}`}
              className="flex items-center gap-2.5 min-w-0 flex-1 group hover:opacity-85 transition-all"
            >
              <div className="w-8 h-8 rounded-full bg-[#FBBF24] text-white font-bold text-xs flex items-center justify-center shrink-0">
                {req.senderInitial}
              </div>
              <div className="min-w-0 flex-1 truncate">
                <p className="text-xs font-bold text-[#0E0E0E] group-hover:text-[#FBBF24] transition-colors truncate">
                  {req.senderName} <span className="text-[10px] font-normal text-[#707070] underline ml-1">Preview</span>
                </p>
                <p className="text-[10px] text-[#707070]">Sent buddy request</p>
              </div>
            </Link>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={async () => {
                  const supabase = createClient()
                  await supabase.from('buddies').update({ status: 'accepted' }).eq('id', req.id)
                  setPendingRequests((prev) => prev.filter((r) => r.id !== req.id))
                }}
                className="px-3 py-1.5 bg-[#0E0E0E] text-white rounded-xl text-xs font-bold hover:bg-[#262626]"
              >
                Approve
              </button>
              <button
                type="button"
                onClick={async () => {
                  const supabase = createClient()
                  await supabase.from('buddies').delete().eq('id', req.id)
                  setPendingRequests((prev) => prev.filter((r) => r.id !== req.id))
                }}
                className="px-2.5 py-1.5 bg-white border border-[#E5E7EB] text-[#707070] rounded-xl text-xs font-bold hover:text-[#EA2C26]"
              >
                Ignore
              </button>
            </div>
          </div>
        ))}

        {/* Active Buddy List with Accordion Permissions */}
        {buddies.length === 0 && pendingRequests.length === 0 ? (
          <div className="p-4 text-center bg-[#FAF6EE] rounded-2xl border border-[#E5E7EB] space-y-1">
            <p className="text-xs font-semibold text-[#374151]">No accountability buddies connected</p>
            <p className="text-[10px] text-[#707070]">
              Share your Buddy Code ({buddyCode}) to walk together.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {buddies.map((buddy) => {
              const isExpanded = expandedBuddyId === buddy.id
              const isWaving = nudgedWaves[buddy.id]

              return (
                <div
                  key={buddy.id}
                  className="rounded-2xl bg-[#FAF6EE] border border-[#E5E7EB] overflow-hidden transition-all"
                >
                  <div
                    onClick={() => setExpandedBuddyId(isExpanded ? null : buddy.id)}
                    className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-[#F3F4F6]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#0E0E0E] text-white font-bold text-xs flex items-center justify-center">
                        {buddy.initial}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#0E0E0E]">{buddy.name}</p>
                        <p className="text-[10px] text-[#707070]">{buddy.church}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => handleNudgeWithWave(e, buddy)}
                        className={`relative px-3 py-1 rounded-xl text-xs font-bold transition-all overflow-hidden flex items-center gap-1 ${
                          isWaving
                            ? 'bg-[#EA2C26] text-white'
                            : 'bg-white border border-[#E5E7EB] text-[#0E0E0E] hover:border-[#FBBF24]'
                        }`}
                      >
                        {isWaving && (
                          <span className="absolute inset-0 bg-gradient-to-r from-red-600 to-rose-400 opacity-80 animate-ping" />
                        )}
                        <span className="relative z-10 flex items-center gap-1">
                          {isWaving ? (
                            'Sent! ✓'
                          ) : (
                            <>
                              <HandWaving size={13} weight="fill" className="text-[#FBBF24]" />
                              <span>Nudge</span>
                            </>
                          )}
                        </span>
                      </button>

                      <CaretDown
                        size={16}
                        className={`text-[#707070] transition-transform ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                      />
                    </div>
                  </div>

                  {/* Accordion Permissions */}
                  {isExpanded && (
                    <div className="p-3.5 bg-white border-t border-[#E5E7EB] space-y-2.5 animate-in slide-in-from-top-2 duration-200">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#707070] block">
                        Buddy Permissions & Sharing
                      </span>

                      <div className="flex items-center justify-between text-xs text-[#0E0E0E]">
                        <span>Clock-in Together (allow session invites)</span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={buddy.permissions.canInviteToClockIn}
                          onClick={() => handleTogglePermission(buddy, 'canInviteToClockIn')}
                          className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors duration-200 ease-in-out cursor-pointer ${
                            buddy.permissions.canInviteToClockIn ? 'bg-[#0E0E0E]' : 'bg-[#E5E7EB]'
                          }`}
                        >
                          <div
                            className={`bg-white w-4 h-4 rounded-full shadow-xs transform transition-transform duration-200 ease-in-out ${
                              buddy.permissions.canInviteToClockIn ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>

                      <div className="flex items-center justify-between text-xs text-[#0E0E0E]">
                        <span>Notify on Clock-in (send push alert)</span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={buddy.permissions.sendNotificationOnStart}
                          onClick={() => handleTogglePermission(buddy, 'sendNotificationOnStart')}
                          className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors duration-200 ease-in-out cursor-pointer ${
                            buddy.permissions.sendNotificationOnStart ? 'bg-[#0E0E0E]' : 'bg-[#E5E7EB]'
                          }`}
                        >
                          <div
                            className={`bg-white w-4 h-4 rounded-full shadow-xs transform transition-transform duration-200 ease-in-out ${
                              buddy.permissions.sendNotificationOnStart ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>

                      <div className="flex items-center justify-between text-xs text-[#0E0E0E]">
                        <span>Share History (allow viewing full session log)</span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={buddy.permissions.canViewDetailedHistory}
                          onClick={() => handleTogglePermission(buddy, 'canViewDetailedHistory')}
                          className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors duration-200 ease-in-out cursor-pointer ${
                            buddy.permissions.canViewDetailedHistory ? 'bg-[#0E0E0E]' : 'bg-[#E5E7EB]'
                          }`}
                        >
                          <div
                            className={`bg-white w-4 h-4 rounded-full shadow-xs transform transition-transform duration-200 ease-in-out ${
                              buddy.permissions.canViewDetailedHistory ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Find Buddy Shortcut Button */}
        <Link href="/find-buddy" className="block pt-1">
          <button
            type="button"
            className="w-full py-3 rounded-2xl border-2 border-dashed border-[#E5E7EB] hover:border-[#FBBF24] bg-white text-[#0E0E0E] text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
          >
            <UserPlus size={16} className="text-[#FBBF24]" />
            <span>Find & Add More Buddies</span>
          </button>
        </Link>
      </div>

      {/* 5. Reflection & Review Card */}
      <div className="faith-card p-5 space-y-3 bg-white border border-[#E5E7EB]">
        <div className="flex items-center gap-2">
          <CalendarCheck size={18} className="text-[#FBBF24]" />
          <h3 className="text-xs font-black uppercase tracking-wider text-[#0E0E0E]">
            Reflection & Review
          </h3>
        </div>

        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <Link href="/review-digest" className="block">
            <div className="p-3.5 rounded-2xl bg-[#FAF6EE] border border-[#E5E7EB] hover:border-[#FBBF24]/40 transition-colors h-full space-y-1">
              <span className="text-xs font-black text-[#0E0E0E] block">Weekly Review</span>
              <p className="text-[10px] text-[#707070] leading-snug">
                Growth is often clearer in reflection.
              </p>
            </div>
          </Link>

          <Link href="/monthly-reflection" className="block">
            <div className="p-3.5 rounded-2xl bg-[#FAF6EE] border border-[#E5E7EB] hover:border-[#FBBF24]/40 transition-colors h-full space-y-1">
              <span className="text-xs font-black text-[#0E0E0E] block">Monthly Reflection</span>
              <p className="text-[10px] text-[#707070] leading-snug">
                Holistic spiritual journaling and milestones.
              </p>
            </div>
          </Link>
        </div>
      </div>

      {/* 6. App Settings & Preferences */}
      <div className="faith-card divide-y divide-[#F3F4F6] overflow-hidden bg-white border border-[#E5E7EB]">
        <div
          onClick={() => setIsNotificationsOpen(true)}
          className="p-4 flex items-center justify-between cursor-pointer hover:bg-[#FAF6EE] transition-colors"
        >
          <div className="flex items-center gap-3">
            <Bell size={16} className="text-[#707070]" />
            <span className="text-xs font-bold text-[#0E0E0E]">Push Notifications & Reviews</span>
          </div>
          <CaretRight size={16} className="text-[#707070]" />
        </div>

        <div
          onClick={() => setIsPrivacyOpen(true)}
          className="p-4 flex items-center justify-between cursor-pointer hover:bg-[#FAF6EE] transition-colors"
        >
          <div className="flex items-center gap-3">
            <Shield size={16} className="text-[#707070]" />
            <span className="text-xs font-bold text-[#0E0E0E]">Privacy & Public Sharing</span>
          </div>
          <CaretRight size={16} className="text-[#707070]" />
        </div>

        {/* Distinct Red-Tinted Log Out Button */}
        <button
          type="button"
          onClick={handleSignOut}
          disabled={isSigningOut}
          className="w-full p-4 flex items-center justify-between cursor-pointer bg-rose-50/50 hover:bg-rose-100/70 active:scale-[0.99] transition-all group text-left disabled:opacity-60"
        >
          <div className="flex items-center gap-3 text-[#EA2C26]">
            {isSigningOut ? (
              <CircleNotch size={16} className="animate-spin" />
            ) : (
              <SignOut size={16} />
            )}
            <span className="text-xs font-black">
              {isSigningOut ? 'Logging Out...' : 'Log Out'}
            </span>
          </div>
          <CaretRight size={16} className="text-[#EA2C26]" />
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TOAST NOTIFICATION                                                        */}
      {/* ========================================================================= */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-60 px-4 py-2.5 rounded-2xl bg-[#0E0E0E] text-white border border-emerald-500 shadow-2xl flex items-center gap-2 text-xs font-black animate-in slide-in-from-top duration-300">
          <Check size={16} weight="bold" className="text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALS                                                                    */}
      {/* ========================================================================= */}

      {/* Edit Profile Modal */}
      {isEditProfileOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xl p-4">
          <div className="w-full max-w-sm bg-[#FAF6EE] border border-[#E5E7EB] rounded-3xl p-5 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-1 border-b border-[#E5E7EB]">
              <h3 className="text-sm font-bold text-[#0E0E0E]">Edit Profile Identity</h3>
              <button onClick={() => setIsEditProfileOpen(false)} className="text-[#707070]">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveIdentity} className="space-y-3.5">
              {/* Display Name Input Wrap */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#707070] block">Display Name</label>
                <div className="p-3 rounded-2xl bg-white border border-[#E5E7EB] flex items-center gap-3 shadow-xs focus-within:border-[#FBBF24] focus-within:ring-2 focus-within:ring-[#FBBF24]/20 transition-all">
                  <User size={18} className="text-[#9095A1] shrink-0" />
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Your Name"
                    className="bg-transparent border-none outline-none text-xs text-[#0E0E0E] w-full font-bold placeholder-[#9095A1]"
                  />
                </div>
              </div>

              {/* Local Assembly (Church) Input Wrap */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#707070] block">Local Assembly (Church)</label>
                <div className="p-3 rounded-2xl bg-white border border-[#E5E7EB] flex items-center gap-3 shadow-xs focus-within:border-[#FBBF24] focus-within:ring-2 focus-within:ring-[#FBBF24]/20 transition-all">
                  <Church size={18} className="text-[#9095A1] shrink-0" />
                  <input
                    type="text"
                    value={editChurch}
                    onChange={(e) => setEditChurch(e.target.value)}
                    placeholder="e.g. Grace Assembly"
                    className="bg-transparent border-none outline-none text-xs text-[#0E0E0E] w-full font-bold placeholder-[#9095A1]"
                  />
                </div>
              </div>

              {/* Short Bio Input Wrap */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-[#707070]">Short Bio / Life Verse</label>
                  <span className="text-[10px] text-[#9095A1] font-mono-tabular">{editBio.length}/150</span>
                </div>
                <div className="p-3 rounded-2xl bg-white border border-[#E5E7EB] flex items-start gap-3 shadow-xs focus-within:border-[#FBBF24] focus-within:ring-2 focus-within:ring-[#FBBF24]/20 transition-all">
                  <Quotes size={18} className="text-[#9095A1] shrink-0 mt-0.5" />
                  <textarea
                    rows={2}
                    maxLength={150}
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    placeholder="Standing firm in faith..."
                    className="bg-transparent border-none outline-none text-xs text-[#0E0E0E] w-full font-medium placeholder-[#9095A1] resize-none leading-relaxed"
                  />
                </div>
              </div>

              {/* Large Gold Save Changes Button */}
              <button
                type="submit"
                className="w-full bg-[#FBBF24] text-[#0E0E0E] py-3.5 rounded-2xl font-black text-xs shadow-md hover:bg-[#F59E0B] active:scale-95 transition-all"
              >
                Save Changes
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Targets Modal */}
      {isEditTargetsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-[#FAF6EE] border border-[#E5E7EB] rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-[#E5E7EB]">
              <div>
                <h3 className="text-sm font-bold text-[#0E0E0E]">Edit Daily Goals & Reminders</h3>
                <p className="text-[10px] text-[#707070]">Customize your daily prayer and study targets</p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditTargetsOpen(false)}
                className="p-1 rounded-xl text-[#707070] hover:text-[#0E0E0E] hover:bg-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveTargets} className="space-y-5">
              {/* 1. Prayer Goal Section */}
              <div className="p-3.5 rounded-2xl bg-white border border-[#E5E7EB] space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#0E0E0E] flex items-center gap-1.5">
                    <HandsPraying size={16} weight="fill" className="text-[#FBBF24]" />
                    <span>Daily Prayer Goal</span>
                  </span>

                  {/* Direct Number Input */}
                  <div className="flex items-center gap-1.5 bg-[#FAF6EE] px-2.5 py-1 rounded-xl border border-[#E5E7EB]">
                    <input
                      type="number"
                      min={1}
                      max={720}
                      value={tempPrayerTarget}
                      onChange={(e) =>
                        setTempPrayerTarget(Math.max(1, Math.min(720, parseInt(e.target.value) || 1)))
                      }
                      className="w-12 bg-transparent text-xs font-black font-mono-tabular text-right text-[#0E0E0E] outline-none"
                    />
                    <span className="text-[11px] font-bold text-[#707070]">min</span>
                  </div>
                </div>

                {/* Preset Chips */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {[10, 15, 30, 45, 60, 90].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setTempPrayerTarget(mins)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all active:scale-95 ${
                        tempPrayerTarget === mins
                          ? 'bg-[#0E0E0E] text-white shadow-xs'
                          : 'bg-[#F9FAFB] border border-[#E5E7EB] text-[#4B5563] hover:border-[#FBBF24]'
                      }`}
                    >
                      {mins}m
                    </button>
                  ))}
                </div>

                {/* Synchronized Range Slider */}
                <input
                  type="range"
                  min={5}
                  max={120}
                  step={5}
                  value={tempPrayerTarget}
                  onChange={(e) => setTempPrayerTarget(Number(e.target.value))}
                  className="w-full accent-[#FBBF24] bg-[#F3F4F6] h-2 rounded-lg cursor-pointer"
                />

                {/* Reminder Time Picker */}
                <div className="flex items-center justify-between pt-1 border-t border-[#F3F4F6]">
                  <label className="text-[11px] font-bold text-[#707070]">Daily Reminder:</label>
                  <input
                    type="time"
                    value={prayerReminderTime}
                    onChange={(e) => setPrayerReminderTime(e.target.value)}
                    className="px-2.5 py-1 bg-[#FAF6EE] border border-[#E5E7EB] rounded-xl text-xs font-mono font-bold text-[#0E0E0E] focus:outline-none focus:border-[#FBBF24]"
                  />
                </div>
              </div>

              {/* 2. Scripture Study Goal Section */}
              <div className="p-3.5 rounded-2xl bg-white border border-[#E5E7EB] space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#0E0E0E] flex items-center gap-1.5">
                    <BookOpen size={16} className="text-[#234537]" weight="fill" />
                    <span>Daily Study Goal</span>
                  </span>

                  {/* Direct Number Input */}
                  <div className="flex items-center gap-1.5 bg-[#FAF6EE] px-2.5 py-1 rounded-xl border border-[#E5E7EB]">
                    <input
                      type="number"
                      min={1}
                      max={720}
                      value={tempStudyTarget}
                      onChange={(e) =>
                        setTempStudyTarget(Math.max(1, Math.min(720, parseInt(e.target.value) || 1)))
                      }
                      className="w-12 bg-transparent text-xs font-black font-mono-tabular text-right text-[#0E0E0E] outline-none"
                    />
                    <span className="text-[11px] font-bold text-[#707070]">min</span>
                  </div>
                </div>

                {/* Preset Chips */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {[10, 15, 30, 45, 60, 90].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setTempStudyTarget(mins)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all active:scale-95 ${
                        tempStudyTarget === mins
                          ? 'bg-[#234537] text-white shadow-xs'
                          : 'bg-[#F9FAFB] border border-[#E5E7EB] text-[#4B5563] hover:border-[#234537]'
                      }`}
                    >
                      {mins}m
                    </button>
                  ))}
                </div>

                {/* Synchronized Range Slider */}
                <input
                  type="range"
                  min={5}
                  max={120}
                  step={5}
                  value={tempStudyTarget}
                  onChange={(e) => setTempStudyTarget(Number(e.target.value))}
                  className="w-full accent-[#234537] bg-[#F3F4F6] h-2 rounded-lg cursor-pointer"
                />

                {/* Reminder Time Picker */}
                <div className="flex items-center justify-between pt-1 border-t border-[#F3F4F6]">
                  <label className="text-[11px] font-bold text-[#707070]">Daily Reminder:</label>
                  <input
                    type="time"
                    value={studyReminderTime}
                    onChange={(e) => setStudyReminderTime(e.target.value)}
                    className="px-2.5 py-1 bg-[#FAF6EE] border border-[#E5E7EB] rounded-xl text-xs font-mono font-bold text-[#0E0E0E] focus:outline-none focus:border-[#234537]"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsEditTargetsOpen(false)}
                  className="w-1/3 py-3 px-4 rounded-2xl bg-white border border-[#E5E7EB] text-xs font-bold text-[#707070] hover:text-[#0E0E0E]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-[#0E0E0E] text-white py-3 px-4 rounded-2xl font-bold text-xs shadow-md hover:bg-[#262626] transition-all flex items-center justify-center gap-1.5 active:scale-95"
                >
                  <Check size={16} weight="bold" className="text-[#FBBF24]" />
                  <span>Save Daily Targets</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Notifications Modal */}
      {isNotificationsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm bg-[#FAF6EE] border border-[#E5E7EB] rounded-3xl p-5 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-1 border-b border-[#E5E7EB]">
              <h3 className="text-sm font-bold text-[#0E0E0E]">Push Notification Preferences</h3>
              <button onClick={() => setIsNotificationsOpen(false)} className="text-[#707070]">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#0E0E0E]">Daily Clock-In Reminders</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={notifDailyReminders}
                  onClick={() => setNotifDailyReminders(!notifDailyReminders)}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ease-in-out cursor-pointer ${
                    notifDailyReminders ? 'bg-[#0E0E0E]' : 'bg-[#E5E7EB]'
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                      notifDailyReminders ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <span className="font-bold text-[#0E0E0E]">Buddy Nudge Alerts</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={notifBuddyNudges}
                  onClick={() => setNotifBuddyNudges(!notifBuddyNudges)}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ease-in-out cursor-pointer ${
                    notifBuddyNudges ? 'bg-[#0E0E0E]' : 'bg-[#E5E7EB]'
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                      notifBuddyNudges ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <span className="font-bold text-[#0E0E0E]">Group Activity & Live Sessions</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={notifGroupActivity}
                  onClick={() => setNotifGroupActivity(!notifGroupActivity)}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ease-in-out cursor-pointer ${
                    notifGroupActivity ? 'bg-[#0E0E0E]' : 'bg-[#E5E7EB]'
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                      notifGroupActivity ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Weekly Review Schedule */}
              <div className="pt-2 border-t border-[#E5E7EB] space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#707070] block">
                  Weekly Review Schedule
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-[#707070] block mb-1 font-bold">Day of Week</label>
                    <select
                      value={reviewDayOfWeek}
                      onChange={(e) => setReviewDayOfWeek(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#E5E7EB] rounded-xl text-xs font-bold text-[#0E0E0E]"
                    >
                      <option value="Sunday">Sunday</option>
                      <option value="Monday">Monday</option>
                      <option value="Friday">Friday</option>
                      <option value="Saturday">Saturday</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-[#707070] block mb-1 font-bold">Time</label>
                    <input
                      type="time"
                      value={reviewReminderTime}
                      onChange={(e) => setReviewReminderTime(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#E5E7EB] rounded-xl text-xs font-mono font-bold text-[#0E0E0E]"
                    />
                  </div>
                </div>
              </div>

              {/* Monthly Review Schedule */}
              <div className="pt-2 border-t border-[#E5E7EB] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#707070] block">
                    Monthly Review Schedule
                  </span>
                  <Link
                    href="/monthly-reflection"
                    onClick={() => setIsNotificationsOpen(false)}
                    className="text-[10px] font-bold text-[#234537] hover:underline flex items-center gap-0.5"
                  >
                    <span>View Reflection</span>
                    <CaretRight size={10} weight="bold" />
                  </Link>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-[#707070] block mb-1 font-bold">Day of Month</label>
                    <select
                      value={monthReviewSchedule}
                      onChange={(e) => setMonthReviewSchedule(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#E5E7EB] rounded-xl text-xs font-bold text-[#0E0E0E]"
                    >
                      <option value="last_day">Last Day of Month</option>
                      <option value="first_day">1st of the Month</option>
                      <option value="last_sunday">Last Sunday of Month</option>
                      <option value="day_15">15th of the Month</option>
                      <option value="day_28">28th of the Month</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-[#707070] block mb-1 font-bold">Reminder Time</label>
                    <input
                      type="time"
                      value={monthReviewReminderTime}
                      onChange={(e) => setMonthReviewReminderTime(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#E5E7EB] rounded-xl text-xs font-mono font-bold text-[#0E0E0E]"
                    />
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSaveNotifications}
              className="w-full bg-[#0E0E0E] text-white py-3 rounded-2xl font-bold text-xs shadow-md hover:bg-[#262626] transition-all flex items-center justify-center gap-1.5 active:scale-95"
            >
              <Check size={16} weight="bold" className="text-[#FBBF24]" />
              <span>Save Notification Preferences</span>
            </button>
          </div>
        </div>
      )}

      {/* Privacy & Public Sharing Modal */}
      {isPrivacyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-sm bg-[#FAF6EE] border border-[#E5E7EB] rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-1 border-b border-[#E5E7EB]">
              <h3 className="text-sm font-bold text-[#0E0E0E]">Privacy & Public Sharing</h3>
              <button
                type="button"
                onClick={() => setIsPrivacyOpen(false)}
                className="p-1 rounded-xl text-[#707070] hover:text-[#0E0E0E]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#0E0E0E]">Share Streak with Buddies</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={publicStreak}
                  onClick={() => setPublicStreak(!publicStreak)}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ease-in-out cursor-pointer ${
                    publicStreak ? 'bg-[#0E0E0E]' : 'bg-[#E5E7EB]'
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                      publicStreak ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <span className="font-bold text-[#0E0E0E]">Share Milestones & Badges to Square</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={publicMilestones}
                  onClick={() => setPublicMilestones(!publicMilestones)}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ease-in-out cursor-pointer ${
                    publicMilestones ? 'bg-[#0E0E0E]' : 'bg-[#E5E7EB]'
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                      publicMilestones ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSavePrivacy}
              className="w-full bg-[#0E0E0E] text-white py-3 rounded-2xl font-bold text-xs shadow-md hover:bg-[#262626] transition-all flex items-center justify-center gap-1.5 active:scale-95"
            >
              <Check size={16} weight="bold" className="text-[#FBBF24]" />
              <span>Save Privacy Settings</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
