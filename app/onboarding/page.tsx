'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  HandsPraying,
  BookOpen,
  Church,
  User,
  Bell,
  Copy,
  Check,
  MagnifyingGlass,
  CircleNotch,
  Sparkle,
} from '@phosphor-icons/react'
import { createClient } from '@/lib/supabase/client'
import { Logo } from '@/components/Logo'

const BIBLE_VERSIONS = ['WEB', 'KJV', 'ASV', 'BBE']

export default function OnboardingPage() {
  const router = useRouter()

  const [userId, setUserId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // 1. Identity & Assembly Details
  const [displayName, setDisplayName] = useState('')
  const [church, setChurch] = useState('')
  const [preferredBibleVersion, setPreferredBibleVersion] = useState('WEB')

  // 2. Targets (Bounded 5 to 180 min)
  const [prayerTarget, setPrayerTarget] = useState(15)
  const [studyTarget, setStudyTarget] = useState(15)

  // 3. Schedule (24-hour custom time selector HH:MM)
  const [hourInput, setHourInput] = useState('07')
  const [minuteInput, setMinuteInput] = useState('00')
  const [allowNotifications, setAllowNotifications] = useState(true)

  // 4. Buddy Code (6-digit UID uppercase)
  const [syncCode, setSyncCode] = useState('')
  const [friendCode, setFriendCode] = useState('')

  // Toast state
  const [showToast, setShowToast] = useState(false)
  const [toastMessage, setToastMessage] = useState('Invite code copied to clipboard!')

  // 1. Authenticate user & prefill details from profile/metadata
  useEffect(() => {
    let isMounted = true

    async function processUser(currentUser: any, supabaseClient: any) {
      if (!isMounted || !currentUser) return
      setUserId(currentUser.id)

      const fallbackName =
        currentUser.user_metadata?.full_name ||
        currentUser.user_metadata?.name ||
        currentUser.email?.split('@')[0] ||
        'Believer'

      let assignedCode = ''
      try {
        const { data: profile } = await supabaseClient
          .from('profiles')
          .select('display_name, church, preferred_bible_version, buddy_code, preferences')
          .eq('id', currentUser.id)
          .maybeSingle()

        if (profile) {
          if (profile.display_name) setDisplayName(profile.display_name)
          else setDisplayName(fallbackName)

          if (profile.church) setChurch(profile.church)
          if (profile.preferred_bible_version) setPreferredBibleVersion(profile.preferred_bible_version)

          if (profile.preferences?.targets?.prayer) setPrayerTarget(profile.preferences.targets.prayer)
          if (profile.preferences?.targets?.study) setStudyTarget(profile.preferences.targets.study)

          if (profile.buddy_code) {
            assignedCode = profile.buddy_code
          } else {
            assignedCode = currentUser.id.replace(/-/g, '').slice(0, 6).toUpperCase()
            await supabaseClient
              .from('profiles')
              .upsert({ id: currentUser.id, buddy_code: assignedCode }, { onConflict: 'id' })
          }
        } else {
          setDisplayName(fallbackName)
          assignedCode = currentUser.id.replace(/-/g, '').slice(0, 6).toUpperCase()
          await supabaseClient
            .from('profiles')
            .upsert({ id: currentUser.id, buddy_code: assignedCode, display_name: fallbackName }, { onConflict: 'id' })
        }
      } catch (err) {
        console.error('Error fetching/setting onboarding profile:', err)
        setDisplayName(fallbackName)
        assignedCode = currentUser.id.replace(/-/g, '').slice(0, 6).toUpperCase()
      }

      if (isMounted) {
        setSyncCode(assignedCode)
      }
    }

    async function initUser() {
      const supabase = createClient()

      // 1. Check active session first
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (session?.user) {
        await processUser(session.user, supabase)
        return
      }

      // 2. Check getUser
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        await processUser(user, supabase)
        return
      }

      // 3. Listen for auth state change in case of hydration delay
      const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
        if (newSession?.user) {
          await processUser(newSession.user, supabase)
        } else {
          setTimeout(async () => {
            if (!isMounted) return
            const { data: checkData } = await supabase.auth.getUser()
            if (!checkData?.user && isMounted) {
              router.replace('/welcome')
            } else if (checkData?.user) {
              await processUser(checkData.user, supabase)
            }
          }, 600)
        }
      })

      return () => {
        authListener.subscription.unsubscribe()
      }
    }

    const cleanupPromise = initUser()
    return () => {
      isMounted = false
      cleanupPromise.then((cleanup) => cleanup && cleanup())
    }
  }, [router])

  // Handle number input clamping for targets (5 - 180 min)
  const handlePrayerChange = (value: number) => {
    if (isNaN(value)) {
      setPrayerTarget(5)
      return
    }
    const clamped = Math.max(5, Math.min(180, value))
    setPrayerTarget(clamped)
  }

  const handleStudyChange = (value: number) => {
    if (isNaN(value)) {
      setStudyTarget(5)
      return
    }
    const clamped = Math.max(5, Math.min(180, value))
    setStudyTarget(clamped)
  }

  // Handle 24-hour mathematical bounding onBlur
  const handleHourBlur = () => {
    let val = parseInt(hourInput, 10)
    if (isNaN(val) || val < 0) val = 0
    if (val > 23) val = 23
    setHourInput(val.toString().padStart(2, '0'))
  }

  const handleMinuteBlur = () => {
    let val = parseInt(minuteInput, 10)
    if (isNaN(val) || val < 0) val = 0
    if (val > 59) val = 59
    setMinuteInput(val.toString().padStart(2, '0'))
  }

  // Copy Invite Action with Pill Toast
  const handleCopyInvite = () => {
    if (typeof navigator !== 'undefined') {
      const inviteUrl = `${window.location.origin}/welcome?ref=${syncCode || 'FAITH'}`
      navigator.clipboard.writeText(inviteUrl)
      setToastMessage('Invite link copied to clipboard!')
      setShowToast(true)
      setTimeout(() => setShowToast(false), 2500)
    }
  }

  // Save all inputted details to Supabase Database
  const savePreferences = async (customFriendCode?: string) => {
    if (!userId) return

    const supabase = createClient()
    const scheduledTime = `${hourInput}:${minuteInput}`
    const finalDisplayName = displayName.trim() || 'Believer'
    const finalChurch = church.trim() || 'Local Assembly'

    // 1. Mark in localStorage immediately so client guards recognize onboarding is complete
    if (typeof window !== 'undefined') {
      localStorage.setItem('faithsync_onboarding_completed', 'true')
      localStorage.setItem(`faithsync_onboarding_${userId}`, 'true')
      localStorage.setItem('faithsync_prayer_target', String(prayerTarget))
      localStorage.setItem('faithsync_study_target', String(studyTarget))
    }

    // 2. Keep Auth user metadata in sync (Always succeeds for authenticated user)
    try {
      await supabase.auth.updateUser({
        data: {
          full_name: finalDisplayName,
          display_name: finalDisplayName,
          onboarding_completed: true,
          prayer_target: prayerTarget,
          study_target: studyTarget,
          buddy_code: syncCode,
          church: finalChurch,
          preferred_bible_version: preferredBibleVersion,
          targets: {
            prayer: prayerTarget,
            study: studyTarget,
          },
        },
      })
    } catch (authErr) {
      console.warn('Auth updateUser notice:', authErr)
    }

    // 3. Persist to profiles table safely
    const preferencesData = {
      onboarding_completed: true,
      completed_at: new Date().toISOString(),
      targets: {
        prayer: prayerTarget,
        study: studyTarget,
        prayer_minutes: prayerTarget,
        study_minutes: studyTarget,
      },
      prayerTarget,
      studyTarget,
      reminderTimes: {
        daily: scheduledTime,
        prayer: scheduledTime,
        study: '20:00',
      },
      daily_reminder_time: scheduledTime,
      church: finalChurch,
      preferred_bible_version: preferredBibleVersion,
      notifDailyReminders: allowNotifications,
      notifBuddyNudges: true,
      notifGroupActivity: true,
      publicStreak: true,
      publicMilestones: true,
    }

    try {
      const { error: fullErr } = await (supabase.from('profiles') as any).upsert(
        {
          id: userId,
          display_name: finalDisplayName,
          buddy_code: syncCode,
          church: finalChurch,
          preferences: preferencesData,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )

      if (fullErr) {
        console.warn('Full upsert notice, trying safe update:', fullErr)
        await (supabase.from('profiles') as any)
          .update({
            display_name: finalDisplayName,
            preferences: preferencesData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId)
      }
    } catch (profileErr) {
      console.warn('Profile save notice:', profileErr)
    }

    // 4. Optional Buddy connection
    if (customFriendCode && customFriendCode.trim()) {
      try {
        const { sendBuddyCodeConnect } = await import('@/features/buddies/services/buddyService')
        await sendBuddyCodeConnect(customFriendCode.trim())
      } catch (err) {
        console.error('Buddy connect error:', err)
      }
    }
  }

  // Complete Setup and Proceed to Homepage
  const handleCompleteSetup = async () => {
    setSaving(true)
    try {
      await savePreferences(friendCode)
      router.replace('/home')
    } catch (err) {
      console.error('Onboarding save error:', err)
      router.replace('/home')
    } finally {
      setSaving(false)
    }
  }

  // Skip Setup (Accept baseline 15 min defaults)
  const handleSkip = async () => {
    setSaving(true)
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('faithsync_onboarding_completed', 'true')
        if (userId) localStorage.setItem(`faithsync_onboarding_${userId}`, 'true')
      }

      if (userId) {
        const supabase = createClient()
        const finalDisplayName = displayName.trim() || 'Believer'
        const finalChurch = church.trim() || 'Local Assembly'

        try {
          await supabase.auth.updateUser({
            data: {
              onboarding_completed: true,
              prayer_target: 15,
              study_target: 15,
            },
          })
        } catch {}

        try {
          await (supabase.from('profiles') as any).upsert(
            {
              id: userId,
              display_name: finalDisplayName,
              buddy_code: syncCode,
              preferences: {
                onboarding_completed: true,
                completed_at: new Date().toISOString(),
                targets: { prayer: 15, study: 15, prayer_minutes: 15, study_minutes: 15 },
                prayerTarget: 15,
                studyTarget: 15,
                reminderTimes: { daily: '07:00', prayer: '07:00', study: '20:00' },
                daily_reminder_time: '07:00',
                church: finalChurch,
                preferred_bible_version: preferredBibleVersion,
                notifDailyReminders: true,
                notifBuddyNudges: true,
                notifGroupActivity: true,
                publicStreak: true,
                publicMilestones: true,
              },
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'id' }
          )
        } catch {}
      }
      router.replace('/home')
    } catch {
      router.replace('/home')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="command-center-container min-h-screen min-h-[100dvh] bg-card relative select-none">
      {/* 1. Vertically Scrollable Content */}
      <div className="scrollable-content max-w-[440px] mx-auto px-5 pt-8 pb-44 space-y-7">
        {/* Header */}
        <div className="text-center space-y-2 pt-2 animate-fade-up">
          <div className="flex justify-center mb-1">
            <Logo height={28} priority />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-text-primary">
            Set your spiritual walk.
          </h1>
          <p className="text-xs text-text-secondary leading-relaxed max-w-xs mx-auto font-medium">
            Fill in your baseline details. These configure your daily habits and database profile.
          </p>
        </div>

        {/* ========================================================================= */}
        {/* Section 1: Profile & Assembly Details                                    */}
        {/* ========================================================================= */}
        <div className="space-y-3.5 animate-fade-up" style={{ animationDelay: '0.05s' }}>
          <h2 className="text-xs font-black uppercase tracking-wider text-text-secondary px-1 flex items-center gap-1.5">
            <User size={14} className="text-[#FBBF24]" />
            <span>1. Your Profile & Assembly</span>
          </h2>

          <div className="bg-surface rounded-3xl p-5 border border-border space-y-3.5 shadow-2xs">
            {/* Display Name Input */}
            <div className="space-y-1.5">
              <label className="block text-[12px] font-medium text-text-secondary">
                Display Name / How Buddies See You
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Brother David, Sarah M."
                className="w-full px-3.5 py-3 rounded-2xl bg-surface/70 dark:bg-neutral-900/70 border border-border/80 dark:border-white/15 text-[13.5px] font-normal text-text-primary placeholder:text-text-muted/60 placeholder:font-normal outline-none focus:border-border focus:ring-2 focus:ring-black/5 dark:focus:ring-white/10 transition-all"
              />
            </div>

            {/* Local Church Assembly */}
            <div className="space-y-1.5">
              <label className="block text-[12px] font-medium text-text-secondary flex items-center gap-1.5">
                <Church size={14} className="text-[#FBBF24]" />
                <span>Local Assembly / Church (Optional)</span>
              </label>
              <input
                type="text"
                value={church}
                onChange={(e) => setChurch(e.target.value)}
                placeholder="e.g. Grace Fellowship, City Assembly"
                className="w-full px-3.5 py-3 rounded-2xl bg-surface/70 dark:bg-neutral-900/70 border border-border/80 dark:border-white/15 text-[13.5px] font-normal text-text-primary placeholder:text-text-muted/60 placeholder:font-normal outline-none focus:border-border focus:ring-2 focus:ring-black/5 dark:focus:ring-white/10 transition-all"
              />
            </div>

            {/* Preferred Bible Version Chips */}
            <div className="space-y-1.5 pt-1">
              <label className="block text-[11px] font-bold text-text-secondary">
                Preferred Bible Version
              </label>
              <div className="grid grid-cols-4 gap-2">
                {BIBLE_VERSIONS.map((ver) => (
                  <button
                    key={ver}
                    type="button"
                    onClick={() => setPreferredBibleVersion(ver)}
                    className={`py-2 px-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      preferredBibleVersion === ver
                        ? 'bg-[#FBBF24] text-text-primary shadow-xs'
                        : 'bg-card text-text-secondary border border-border hover:bg-subtle'
                    }`}
                  >
                    {ver}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* Section 2: Daily Targets (Prayer & Study)                                */}
        {/* ========================================================================= */}
        <div className="space-y-3.5 animate-fade-up" style={{ animationDelay: '0.1s' }}>
          <h2 className="text-xs font-black uppercase tracking-wider text-text-secondary px-1 flex items-center gap-1.5">
            <HandsPraying size={14} className="text-[#FBBF24]" />
            <span>2. Set Daily Targets</span>
          </h2>

          {/* Daily Prayer Card */}
          <div className="target-card bg-surface rounded-3xl p-5 border border-border space-y-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-amber-100/80 text-amber-700 flex items-center justify-center shadow-2xs">
                  <HandsPraying size={20} weight="fill" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-text-primary">Daily Prayer</h3>
                  <p className="text-[10px] text-text-secondary font-medium">Intentional communion</p>
                </div>
              </div>

              {/* Inset Text Box */}
              <div className="flex items-center gap-1 bg-card border border-border rounded-2xl px-3 py-1.5 shadow-2xs">
                <input
                  type="number"
                  min={5}
                  max={180}
                  step={5}
                  value={prayerTarget}
                  onChange={(e) => handlePrayerChange(parseInt(e.target.value, 10))}
                  className="w-10 text-right text-xs font-black font-mono-tabular text-text-primary outline-none bg-transparent"
                />
                <span className="text-[10px] font-bold text-text-secondary">min</span>
              </div>
            </div>

            {/* Custom Horizontal Range Slider */}
            <div className="space-y-1">
              <input
                type="range"
                min={5}
                max={180}
                step={5}
                value={prayerTarget}
                onChange={(e) => setPrayerTarget(parseInt(e.target.value, 10))}
                className="w-full accent-[#FBBF24] cursor-pointer h-2 bg-[#E5E7EB] rounded-lg appearance-none"
              />
              <div className="flex justify-between text-[9px] font-bold text-text-muted px-0.5">
                <span>5m</span>
                <span>60m</span>
                <span>120m</span>
                <span>180m</span>
              </div>
            </div>
          </div>

          {/* Daily Study Card */}
          <div className="target-card bg-surface rounded-3xl p-5 border border-border space-y-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-emerald-100/80 text-emerald-800 flex items-center justify-center shadow-2xs">
                  <BookOpen size={20} weight="bold" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-text-primary">Daily Study</h3>
                  <p className="text-[10px] text-text-secondary font-medium">Deep reflection in the Word</p>
                </div>
              </div>

              {/* Inset Text Box */}
              <div className="flex items-center gap-1 bg-card border border-border rounded-2xl px-3 py-1.5 shadow-2xs">
                <input
                  type="number"
                  min={5}
                  max={180}
                  step={5}
                  value={studyTarget}
                  onChange={(e) => handleStudyChange(parseInt(e.target.value, 10))}
                  className="w-10 text-right text-xs font-black font-mono-tabular text-text-primary outline-none bg-transparent"
                />
                <span className="text-[10px] font-bold text-text-secondary">min</span>
              </div>
            </div>

            {/* Custom Horizontal Range Slider */}
            <div className="space-y-1">
              <input
                type="range"
                min={5}
                max={180}
                step={5}
                value={studyTarget}
                onChange={(e) => setStudyTarget(parseInt(e.target.value, 10))}
                className="w-full accent-[#FBBF24] cursor-pointer h-2 bg-[#E5E7EB] rounded-lg appearance-none"
              />
              <div className="flex justify-between text-[9px] font-bold text-text-muted px-0.5">
                <span>5m</span>
                <span>60m</span>
                <span>120m</span>
                <span>180m</span>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* Section 3: Reminder Schedule                                              */}
        {/* ========================================================================= */}
        <div className="space-y-3 animate-fade-up" style={{ animationDelay: '0.15s' }}>
          <h2 className="text-xs font-black uppercase tracking-wider text-text-secondary px-1 flex items-center gap-1.5">
            <Bell size={14} className="text-[#FBBF24]" />
            <span>3. Reminder Schedule</span>
          </h2>

          <div className="custom-time-selector bg-card border border-border rounded-3xl p-5 flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-surface border border-border flex items-center justify-center shadow-2xs">
                <Bell size={20} className="text-[#FBBF24]" weight="fill" />
              </div>
              <div>
                <h3 className="text-xs font-black text-text-primary">Daily Reminder</h3>
                <p className="text-[10px] text-text-secondary">Gentle nudge to maintain consistency</p>
              </div>
            </div>

            {/* HH : MM 24-Hour Input Pill */}
            <div className="flex items-center gap-1.5 bg-surface border border-border px-3.5 py-2 rounded-2xl shadow-2xs">
              <input
                type="text"
                maxLength={2}
                value={hourInput}
                onChange={(e) => setHourInput(e.target.value.replace(/\D/g, ''))}
                onBlur={handleHourBlur}
                className="w-8 text-center text-base font-black font-mono-tabular text-text-primary bg-transparent outline-none"
              />
              <span className="text-sm font-black text-text-secondary">:</span>
              <input
                type="text"
                maxLength={2}
                value={minuteInput}
                onChange={(e) => setMinuteInput(e.target.value.replace(/\D/g, ''))}
                onBlur={handleMinuteBlur}
                className="w-8 text-center text-base font-black font-mono-tabular text-text-primary bg-transparent outline-none"
              />
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* Section 4: Accountability SynC Code & Connect Buddy                      */}
        {/* ========================================================================= */}
        <div className="space-y-3 animate-fade-up" style={{ animationDelay: '0.2s' }}>
          <h2 className="text-xs font-black uppercase tracking-wider text-text-secondary px-1 flex items-center gap-1.5">
            <Sparkle size={14} className="text-[#FBBF24]" />
            <span>4. SynC Code & Accountability</span>
          </h2>

          {/* SynC Code Card */}
          <div className="bg-[#FF6B66] text-white rounded-3xl p-5 space-y-3.5 shadow-md">
            <div className="flex items-start justify-between">
              <div className="space-y-0.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-white/80">
                  Your SynC Code
                </span>
                <h3 className="text-2xl font-black font-mono tracking-widest text-white">
                  {syncCode || 'SYNC-BELIEVER'}
                </h3>
              </div>
              <span className="text-[10px] font-bold bg-card/20 text-white px-2.5 py-1 rounded-full backdrop-blur-xs">
                Accountability
              </span>
            </div>

            <p className="text-[11px] text-white/90 leading-relaxed font-medium">
              Share your SynC code with friends or enter a buddy&apos;s code below to stay accountable together.
            </p>

            <button
              type="button"
              onClick={handleCopyInvite}
              className="w-full py-3 px-4 rounded-2xl bg-card text-text-primary font-black text-xs shadow-sm hover:bg-subtle active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Copy size={16} className="text-[#FF6B66]" weight="bold" />
              <span>Copy Invite Link</span>
            </button>
          </div>

          {/* Join Existing Buddy Code Box */}
          <div className="pt-0.5">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={friendCode}
                onChange={(e) => setFriendCode(e.target.value.toUpperCase())}
                placeholder="Have a buddy's code? (Optional)"
                maxLength={12}
                className="flex-1 px-4 py-3 rounded-2xl bg-surface/70 dark:bg-neutral-900/70 border border-border/80 dark:border-white/15 font-mono text-[13px] font-normal text-text-primary placeholder:text-text-muted/60 placeholder:font-normal outline-none focus:border-border focus:ring-2 focus:ring-black/5 dark:focus:ring-white/10 uppercase transition-all"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. Sticky Bottom Action Bar                                               */}
      {/* ========================================================================= */}
      <div className="fixed bottom-0 left-0 right-0 z-30 pointer-events-none flex justify-center">
        <div className="w-full max-w-[440px] pointer-events-auto bg-gradient-to-t from-card via-card/95 to-transparent pt-6 pb-6 px-5 space-y-2.5 text-center">
          {/* Primary Action: Complete Setup & Proceed to Homepage */}
          <button
            type="button"
            onClick={handleCompleteSetup}
            disabled={saving}
            className="w-full py-4 px-6 rounded-2xl bg-[#FBBF24] text-text-primary font-black text-sm shadow-[0_4px_20px_rgba(251,191,36,0.25)] hover:bg-[#f5b318] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
          >
            {saving ? (
              <>
                <CircleNotch size={18} className="animate-spin text-text-primary" />
                <span>Saving to Database...</span>
              </>
            ) : (
              <span>Proceed to Homepage →</span>
            )}
          </button>

          {/* Secondary Action: Skip for now */}
          <div>
            <button
              type="button"
              onClick={handleSkip}
              disabled={saving}
              className="text-xs font-bold text-text-secondary hover:text-text-primary transition-colors cursor-pointer py-1"
            >
              Skip for now (Accept defaults)
            </button>
          </div>
        </div>
      </div>

      {/* Floating Pill Toast Notification */}
      {showToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 animate-slide-up pointer-events-none">
          <div className="bg-[#0E0E0E] dark:bg-white/90 text-white dark:text-[#0E0E0E] px-5 py-2.5 rounded-full text-xs font-bold shadow-xl flex items-center gap-2 border border-white/10">
            <Check size={16} className="text-emerald-400 font-bold" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}
    </div>
  )
}
