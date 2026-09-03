'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  HandsPraying,
  BookOpen,
  Timer,
  Copy,
  Check,
  MagnifyingGlass,
  CircleNotch,
} from '@phosphor-icons/react'
import { createClient } from '@/lib/supabase/client'
import { Logo } from '@/components/Logo'
import { searchUserBySyncCode, sendBuddyRequest } from '@/features/buddies/services/buddyService'

export default function OnboardingPage() {
  const router = useRouter()

  const [userId, setUserId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Targets (Bounded 5 to 180 min)
  const [prayerTarget, setPrayerTarget] = useState(15)
  const [studyTarget, setStudyTarget] = useState(15)

  // Schedule (24-hour custom time selector HH:MM)
  const [hourInput, setHourInput] = useState('07')
  const [minuteInput, setMinuteInput] = useState('00')

  // Buddy Code (6-digit UID uppercase)
  const [syncCode, setSyncCode] = useState('')
  const [friendCode, setFriendCode] = useState('')

  // Toast state
  const [showToast, setShowToast] = useState(false)
  const [toastMessage, setToastMessage] = useState('Invite code copied to clipboard!')

  // 1. Authenticate user & extract genuine 6-digit sync code
  useEffect(() => {
    let isMounted = true

    async function processUser(currentUser: any, supabaseClient: any) {
      if (!isMounted || !currentUser) return
      setUserId(currentUser.id)

      let assignedCode = ''
      try {
        const { data: profile } = await supabaseClient
          .from('profiles')
          .select('buddy_code')
          .eq('id', currentUser.id)
          .maybeSingle()

        if (profile?.buddy_code) {
          assignedCode = profile.buddy_code
        } else {
          assignedCode = currentUser.id.replace(/-/g, '').slice(0, 6).toUpperCase()
          await supabaseClient
            .from('profiles')
            .upsert({ id: currentUser.id, buddy_code: assignedCode }, { onConflict: 'id' })
        }
      } catch (err) {
        console.error('Error fetching/setting buddy_code:', err)
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

  // Save targets & profile to Supabase
  const savePreferences = async (customFriendCode?: string) => {
    if (!userId) return

    const supabase = createClient()
    const scheduledTime = `${hourInput}:${minuteInput}`

    const updatePayload: Record<string, any> = {
      id: userId,
      preferences: {
        targets: {
          prayer: prayerTarget,
          study: studyTarget,
        },
        reminderTimes: {
          daily: scheduledTime,
          prayer: scheduledTime,
        },
        notifDailyReminders: true,
        notifBuddyNudges: true,
        notifGroupActivity: true,
        publicStreak: true,
        publicMilestones: true,
      },
      updated_at: new Date().toISOString(),
    }

    if (syncCode) {
      updatePayload.buddy_code = syncCode
    }

    await (supabase.from('profiles') as any).upsert(updatePayload, { onConflict: 'id' })

    await supabase.auth.updateUser({
      data: {
        prayer_target: prayerTarget,
        study_target: studyTarget,
        buddy_code: syncCode,
      },
    })

    if (customFriendCode && customFriendCode.trim()) {
      try {
        const { sendBuddyCodeConnect } = await import('@/features/buddies/services/buddyService')
        await sendBuddyCodeConnect(customFriendCode.trim())
      } catch (err) {
        console.error('Buddy connect error:', err)
      }
    }
  }

  // Complete Setup
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

  // Skip Setup (Accept 15 min defaults)
  const handleSkip = async () => {
    setSaving(true)
    try {
      if (userId) {
        const supabase = createClient()
        await (supabase.from('profiles') as any).upsert(
          {
            id: userId,
            buddy_code: syncCode,
            preferences: {
              targets: { prayer: 15, study: 15 },
              reminderTimes: { daily: '07:00', prayer: '07:00' },
              notifDailyReminders: true,
              notifBuddyNudges: true,
              notifGroupActivity: true,
            },
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        )
      }
      router.replace('/home')
    } catch {
      router.replace('/home')
    } finally {
      setSaving(false)
    }
  }

  // Join Existing Buddy
  const handleFindBuddy = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!friendCode.trim()) return

    setSaving(true)
    try {
      await savePreferences(friendCode)
      router.replace(`/find-buddy?search=${encodeURIComponent(friendCode.trim().toUpperCase())}`)
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
          <h1 className="text-2xl font-black tracking-tight text-text-primary">
            Set your intention.
          </h1>
          <p className="text-xs text-text-secondary leading-relaxed max-w-xs mx-auto font-medium">
            Let&apos;s build your habit. Configure your targets, schedule, and buddy.
          </p>
        </div>

        {/* ========================================================================= */}
        {/* Section 1: Set Targets (Dual Input System: Inset Box + Range Slider)     */}
        {/* ========================================================================= */}
        <div className="space-y-3.5 animate-fade-up" style={{ animationDelay: '0.1s' }}>
          <h2 className="text-xs font-black uppercase tracking-wider text-text-secondary px-1">
            1. Set Targets
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
        {/* Section 2: Review Schedule (Custom Large 24-hr Time Selector)             */}
        {/* ========================================================================= */}
        <div className="space-y-3 animate-fade-up" style={{ animationDelay: '0.2s' }}>
          <h2 className="text-xs font-black uppercase tracking-wider text-text-secondary px-1">
            2. Review Schedule
          </h2>

          <div className="custom-time-selector bg-card border border-border rounded-3xl p-5 flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-surface border border-border flex items-center justify-center shadow-2xs">
                <svg width="22" height="22" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M15.1342 2.09154L10.1343 2.06104" stroke="#0E0E0E" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M4.06384 13.524C4.09248 8.82968 7.92121 5.04739 12.6155 5.07603C14.9627 5.09036 17.0819 6.0547 18.6106 7.60225M18.6106 7.60225C20.1394 9.14981 21.0778 11.2806 21.0635 13.6277C21.0349 18.3221 17.2061 22.1044 12.5118 22.0757L3.01199 22.0178M18.6106 7.60225L20.1093 6.12178" stroke="#0E0E0E" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M8.03018 19.0486L3.03027 19.0181" stroke="#EA2C26" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M6.04877 16.0364L3.04883 16.0181" stroke="#234537" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M12.5641 13.5761L16.0854 10.0975" stroke="#FBBF24" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div>
                <h3 className="text-xs font-black text-text-primary">Daily Reminder</h3>
                <p className="text-[10px] text-text-secondary">Push notification nudge</p>
              </div>
            </div>

            {/* Massive Bold HH : MM 24-Hour Input Pill */}
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
        {/* Section 3: Find a Buddy (Bittersweet Red Invite Card + Search Input)      */}
        {/* ========================================================================= */}
        <div className="space-y-3 animate-fade-up" style={{ animationDelay: '0.3s' }}>
          <h2 className="text-xs font-black uppercase tracking-wider text-text-secondary px-1">
            3. Find a Buddy
          </h2>

          {/* Bittersweet #FF6B66 Invite Card */}
          <div className="bg-[#FF6B66] text-white rounded-3xl p-5 space-y-3.5 shadow-md">
            <div className="flex items-start justify-between">
              <div className="space-y-0.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-white/80">
                  Your SynC Code
                </span>
                <h3 className="text-2xl font-black font-mono tracking-widest text-white">
                  {syncCode}
                </h3>
              </div>
              <span className="text-[10px] font-bold bg-card/20 text-white px-2.5 py-1 rounded-full backdrop-blur-xs">
                2x Accountability
              </span>
            </div>

            <p className="text-[11px] text-white/90 leading-relaxed font-medium">
              Users with a buddy are twice as likely to stay consistent. Share your link to sync together.
            </p>

            <button
              type="button"
              onClick={handleCopyInvite}
              className="w-full py-3 px-4 rounded-2xl bg-card text-text-primary font-black text-xs shadow-sm hover:bg-[#FDF9F1] dark:bg-amber-950/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Copy size={16} className="text-[#FF6B66]" weight="bold" />
              <span>Copy Invite Link</span>
            </button>
          </div>

          {/* Join Existing Buddy Code Box */}
          <form onSubmit={handleFindBuddy} className="flex items-center gap-2 pt-0.5">
            <input
              type="text"
              value={friendCode}
              onChange={(e) => setFriendCode(e.target.value.toUpperCase())}
              placeholder="Enter buddy code (e.g. SYNC99)"
              maxLength={12}
              className="flex-1 px-4 py-3.5 rounded-2xl bg-surface border border-border font-mono text-xs font-bold text-text-primary placeholder-[#9095A1] outline-none focus:border-[#FBBF24] focus:ring-2 focus:ring-[#FBBF24]/20 uppercase transition-all shadow-2xs"
            />
            <button
              type="submit"
              disabled={!friendCode.trim() || saving}
              className="py-3.5 px-5 rounded-2xl bg-[#0E0E0E] dark:bg-white/90 text-white dark:text-[#0E0E0E] font-black text-xs hover:bg-black/90 active:scale-[0.98] transition-all disabled:opacity-40 cursor-pointer flex items-center gap-1.5 shadow-2xs"
            >
              <MagnifyingGlass size={14} weight="bold" />
              <span>Find</span>
            </button>
          </form>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. Permanent Sticky Bottom Action Bar                                      */}
      {/* ========================================================================= */}
      <div className="fixed bottom-0 left-0 right-0 z-30 pointer-events-none flex justify-center">
        <div className="w-full max-w-[440px] pointer-events-auto bg-gradient-to-t from-white via-white/95 to-transparent pt-6 pb-6 px-5 space-y-2.5 text-center">
          {/* Primary Action: Complete Setup with Glowing Orange Drop Shadow */}
          <button
            type="button"
            onClick={handleCompleteSetup}
            disabled={saving}
            className="w-full py-4 px-6 rounded-full bg-card border-2 border-[#FBBF24] text-text-primary font-black text-sm shadow-[0_4px_20px_rgba(255,152,0,0.4)] hover:bg-[#FDF9F1] dark:bg-amber-950/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
          >
            {saving ? (
              <>
                <CircleNotch size={18} className="animate-spin text-[#FBBF24]" />
                <span>Completing Setup...</span>
              </>
            ) : (
              <span>Complete Setup</span>
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
              Skip for now
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* Floating Pill Toast Notification (Animated slideUp)                        */}
      {/* ========================================================================= */}
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
