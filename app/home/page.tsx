'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Fire,
  CaretRight,
  Check,
  Users,
  BookOpen,
  CheckCircle,
  X,
  Clock,
  Timer,
  HandsPraying,
  HandWaving,
  ShareNetwork,
  ChatCircle,
  Lock,
  ArrowRight,
} from '@phosphor-icons/react'
import { createClient } from '@/lib/supabase/client'
import { fetchDashboardData, DashboardData } from '@/features/dashboard/services/dashboardService'
import { WeeklyProgress } from '@/features/dashboard/components/WeeklyProgress'
import { getVerseOfTheDay } from '@/lib/scripture'
import { Modal } from '@/components/ui/Modal'

const DASH_ARRAY = 282.74 // 2 * PI * 45

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export default function HomePage() {
  const router = useRouter()

  const [dashboard, setDashboard] = useState<DashboardData>({
    firstName: 'Believer',
    streakDays: 0,
    prayerMinutes: 0,
    studyMinutes: 0,
    prayerTarget: 15,
    studyTarget: 15,
    weekDots: ['pending', 'pending', 'pending', 'pending', 'pending', 'pending', 'pending'],
    completedDaysCount: 0,
    buddies: [],
    pendingRequests: [],
    globalCount: 0,
    activeCommunityUsers: [],
  })

  const [nudgedState, setNudgedState] = useState<Record<string, boolean>>({})
  const [vibratingState, setVibratingState] = useState<Record<string, boolean>>({})
  const [showGatingModal, setShowGatingModal] = useState(false)

  useEffect(() => {
    async function reloadDashboard(force = true) {
      const data = await fetchDashboardData(force)
      if (data) setDashboard(data)
    }

    async function checkOnboardingAndLoad() {
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (user) {
          // Check localStorage first for instant client truth
          const localDone =
            typeof window !== 'undefined' &&
            (localStorage.getItem('faithsync_onboarding_completed') === 'true' ||
              localStorage.getItem(`faithsync_onboarding_${user.id}`) === 'true')

          // Check user metadata
          const metaDone =
            user.user_metadata?.onboarding_completed === true ||
            Boolean(user.user_metadata?.prayer_target || user.user_metadata?.study_target)

          if (!localDone && !metaDone) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('preferences')
              .eq('id', user.id)
              .maybeSingle()

            const profileDone =
              profile?.preferences?.onboarding_completed === true ||
              Boolean(profile?.preferences?.targets?.prayer || profile?.preferences?.targets?.study)

            if (!profileDone) {
              router.replace('/onboarding')
              return
            } else if (typeof window !== 'undefined') {
              localStorage.setItem('faithsync_onboarding_completed', 'true')
              localStorage.setItem(`faithsync_onboarding_${user.id}`, 'true')
            }
          }
        }
      } catch (err) {
        console.error('Home onboarding check error:', err)
      }

      await reloadDashboard(true)
    }

    checkOnboardingAndLoad()

    const handleFocus = () => reloadDashboard(true)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') reloadDashboard(true)
    }
    const handleSessionUpdate = () => reloadDashboard(true)

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('faithsync_session_updated', handleSessionUpdate)

    // 4. Push Notification Permissions (The "Silent Ask")
    async function requestNotificationPermission() {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'default') {
          try {
            await Notification.requestPermission()
          } catch {}
        }
      }
    }
    requestNotificationPermission()

    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('faithsync_session_updated', handleSessionUpdate)
    }
  }, [router])

  // Nudge Partner Handler (with 400ms Haptic Feedback Emulation)
  const handleNudge = async (e: React.MouseEvent, buddyId: string, connectionId: string) => {
    e.stopPropagation()
    setNudgedState((prev) => ({ ...prev, [buddyId]: true }))
    setVibratingState((prev) => ({ ...prev, [buddyId]: true }))

    // Haptic vibration emulation for exactly 400ms
    setTimeout(() => {
      setVibratingState((prev) => ({ ...prev, [buddyId]: false }))
    }, 400)

    try {
      await fetch('/api/buddy/nudge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buddyId,
          connectionId,
        }),
      })
    } catch {}

    setTimeout(() => {
      setNudgedState((prev) => ({ ...prev, [buddyId]: false }))
    }, 3000)
  }

  // Request Approval / Silent Ignore Handlers
  const handleApprove = async (reqId: string) => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    await supabase.from('buddies').update({ status: 'accepted' }).eq('id', reqId)

    const targetReq = dashboard.pendingRequests.find((r) => r.id === reqId)
    if (targetReq?.senderId && user) {
      await (supabase.from('notifications') as any).insert({
        user_id: targetReq.senderId,
        type: 'buddy_accepted',
        text: `**${user.user_metadata?.full_name || 'A Believer'}** accepted your Accountability Buddy request!`,
        route_url: `/buddy-chat/${user.id}`,
        icon_type: 'hands_praying',
      })
    }

    setDashboard((prev) => ({
      ...prev,
      pendingRequests: prev.pendingRequests.filter((r) => r.id !== reqId),
    }))
  }

  // The Silent Ignore Rule: Deletes row from database and explicitly does NOT notify sender
  const handleIgnore = async (reqId: string) => {
    const supabase = createClient()
    await supabase.from('buddies').delete().eq('id', reqId)
    setDashboard((prev) => ({
      ...prev,
      pendingRequests: prev.pendingRequests.filter((r) => r.id !== reqId),
    }))
  }

  const prayerTarget = Math.max(dashboard.prayerTarget || 15, 1)
  const studyTarget = Math.max(dashboard.studyTarget || 15, 1)
  const prayerProgress = Math.min(Math.max((dashboard.prayerMinutes || 0) / prayerTarget, 0), 1)
  const studyProgress = Math.min(Math.max((dashboard.studyMinutes || 0) / studyTarget, 0), 1)
  
  // Circumference for r=42 is 2 * PI * 42 = 263.89
  const RING_CIRCUMFERENCE = 263.89
  const prayerOffset = RING_CIRCUMFERENCE * (1 - prayerProgress)
  const studyOffset = RING_CIRCUMFERENCE * (1 - studyProgress)

  const votd = getVerseOfTheDay()
  const isDevotionComplete = Boolean(
    dashboard.isDevotionComplete ||
    ((dashboard.prayerMinutes || 0) >= prayerTarget && (dashboard.studyMinutes || 0) >= studyTarget)
  )

  const handleShareVotdToSquare = (e: React.MouseEvent) => {
    e.preventDefault()
    if (isDevotionComplete) {
      const shareUrl = `/square?compose=true&verse=${encodeURIComponent(`“${votd.text}” — ${votd.reference}`)}&ref=${encodeURIComponent(votd.reference)}&intent=record`
      router.push(shareUrl)
    } else {
      setShowGatingModal(true)
    }
  }

  return (
    <div className="command-center-container px-4 sm:px-6 pt-3 pb-28 space-y-4">
      {/* Personalized Greeting */}
      <div className="space-y-1 pt-1">
        <h1 className="text-2xl font-bold tracking-tight text-text-primary">
          {getGreeting()},{' '}
          <span className="text-[#FBBF24] underline decoration-[#FBBF24]/30 underline-offset-4">
            {dashboard.firstName}
          </span>
        </h1>
        <p className="text-xs font-medium text-text-secondary leading-relaxed">
          Your daily build-up starts here. Let&apos;s make today count.
        </p>
      </div>

      {/* 1. Weekly Progress Tracker */}
      <WeeklyProgress
        completedDaysCount={dashboard.completedDaysCount}
        weekDots={dashboard.weekDots}
      />

      {/* Today's Progress Rings */}
      <div className="faith-card p-5 space-y-4 relative overflow-hidden">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-text-primary tracking-tight">Today&apos;s Momentum</h2>
            <p className="text-[11px] text-text-secondary">Prayer & Scripture Study</p>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EBF3EE] dark:bg-emerald-950/30 border border-[#234537]/25 dark:border-emerald-700/30 text-[#234537] dark:text-emerald-400 text-xs font-extrabold shadow-2xs">
            <Fire size={14} weight="fill" className="text-[#234537] dark:text-emerald-400" />
            <span>{dashboard.streakDays} Day Streak</span>
          </div>
        </div>

        {/* Dual Animated Circular Rings (Separate Side-by-Side) */}
        <div className="grid grid-cols-2 gap-4 py-2">
            {/* 1. Prayer Ring */}
            <div className="flex flex-col items-center text-center space-y-2 p-2">
              <div className="relative w-28 h-28 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    stroke="currentColor"
                    className="text-gray-200 dark:text-neutral-800"
                    strokeWidth="8"
                    fill="none"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    stroke="#FBBF24"
                    strokeWidth="8"
                    strokeDasharray={RING_CIRCUMFERENCE}
                    strokeDashoffset={prayerOffset}
                    strokeLinecap="round"
                    fill="none"
                    style={{
                      transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <HandsPraying size={18} weight="fill" className="text-[#FBBF24] mb-0.5" />
                  <span className="text-xs font-bold text-text-primary">Prayer</span>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-text-primary bg-surface px-2.5 py-1 rounded-lg border border-border flex items-center gap-1.5 justify-center">
                <Clock size={13} className="text-[#FBBF24]" />
                <span>{dashboard.prayerMinutes} / {dashboard.prayerTarget} min</span>
              </span>
            </div>

            {/* 2. Study Ring */}
            <div className="flex flex-col items-center text-center space-y-2 p-2">
              <div className="relative w-28 h-28 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    stroke="currentColor"
                    className="text-gray-200 dark:text-neutral-800"
                    strokeWidth="8"
                    fill="none"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    stroke="#FBBF24"
                    strokeWidth="8"
                    strokeDasharray={RING_CIRCUMFERENCE}
                    strokeDashoffset={studyOffset}
                    strokeLinecap="round"
                    fill="none"
                    style={{
                      transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <BookOpen size={18} className="text-[#FBBF24] mb-0.5" />
                  <span className="text-xs font-bold text-text-primary">Study</span>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-text-primary bg-surface px-2.5 py-1 rounded-lg border border-border flex items-center gap-1.5 justify-center">
                <BookOpen size={13} className="text-[#FBBF24]" />
                <span>{dashboard.studyMinutes} / {dashboard.studyTarget} min</span>
              </span>
            </div>
          </div>
        </div>

        {/* Interactive Verse of the Day Card */}
        <div className="faith-card p-5 space-y-3.5 bg-card border border-border dark:border-neutral-700/80 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#FBBF24] animate-ping" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-neutral-400">
                Verse of the Day
              </span>
            </div>
            <span className="text-xs font-mono font-medium text-amber-700 dark:text-amber-300 bg-amber-500/10 dark:bg-amber-400/15 px-2.5 py-0.5 rounded-md border border-amber-500/25 dark:border-amber-400/30">
              {votd.reference} • {votd.version || 'WEB'}
            </span>
          </div>

          <blockquote className="space-y-1.5">
            <p className="text-[14.5px] sm:text-[15.5px] font-normal text-text-primary dark:text-neutral-100 leading-relaxed">
              &ldquo;{votd.text}&rdquo;
            </p>
            {votd.theme && (
              <p className="text-xs text-text-secondary dark:text-neutral-400 font-normal">
                Spiritual Theme: {votd.theme}
              </p>
            )}
          </blockquote>

          {/* 1-Tap Verse Actions */}
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border dark:border-neutral-800">
            <Link
              href={`/bible?book=${encodeURIComponent(votd.book)}&chapter=${votd.chapter}`}
              className="p-2.5 rounded-xl bg-surface dark:bg-[#1E1E1E] border border-border dark:border-neutral-700 hover:border-[#FBBF24] text-text-primary dark:text-neutral-100 text-xs font-medium flex items-center justify-center gap-1.5 transition-all shadow-2xs hover:bg-subtle"
            >
              <BookOpen size={14} className="text-[#FBBF24]" weight="bold" />
              <span>Read Bible</span>
            </Link>

            <button
              type="button"
              onClick={handleShareVotdToSquare}
              className="p-2.5 rounded-xl bg-surface dark:bg-[#1E1E1E] border border-border dark:border-neutral-700 hover:border-[#FBBF24] text-text-primary dark:text-neutral-100 text-xs font-medium flex items-center justify-center gap-1.5 transition-all shadow-2xs hover:bg-subtle cursor-pointer"
            >
              <ShareNetwork size={14} className="text-[#234537] dark:text-emerald-400" weight="bold" />
              <span>Share to Square</span>
            </button>
          </div>
        </div>

      {/* The Clock In Now CTA */}
      <Link href="/clock-in" className="block group">
        <button
          type="button"
          className="w-full bg-[#0E0E0E] dark:bg-[#1C1813] border border-black/10 dark:border-[#FBBF24]/50 text-white dark:text-[#F5F1E8] py-4 px-6 rounded-2xl flex items-center justify-between font-extrabold text-base shadow-xl shadow-black/20 dark:shadow-[0_4px_24px_rgba(251,191,36,0.15)] group-hover:bg-[#1f1f1f] dark:group-hover:bg-[#241E18] dark:group-hover:border-[#FBBF24]/80 group-active:scale-[0.99] transition-all cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FBBF24] text-[#1A1610] flex items-center justify-center shadow-md shadow-[#FBBF24]/20 shrink-0">
              <Timer size={22} weight="fill" className="text-[#1A1610]" />
            </div>
            <span className="tracking-tight text-white dark:text-[#F5F1E8] text-base font-extrabold">Clock In Now</span>
          </div>
          <CaretRight size={20} className="text-[#FBBF24] group-hover:translate-x-1 transition-transform" />
        </button>
      </Link>

      {/* Accountability Buddies Hub */}
      <div className="faith-card p-5 space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-[#FBBF24]" />
            <h2 className="text-sm font-bold text-text-primary">Accountability Buddies</h2>
          </div>
          <Link href="/accountability" className="text-xs font-bold text-[#FBBF24] hover:underline">
            View All
          </Link>
        </div>

        {/* Incoming Requests */}
        {dashboard.pendingRequests.map((req) => (
          <div
            key={req.id}
            className="p-3 rounded-xl bg-[#FDF9F1] dark:bg-amber-950/30 border border-[#FBBF24]/35 flex items-center justify-between gap-3 animate-in fade-in"
          >
            <Link
              href={`/profile/${req.senderId}`}
              className="flex items-center gap-2.5 min-w-0 flex-1 group hover:opacity-85 transition-all"
            >
              <div className="w-8 h-8 rounded-full bg-[#FBBF24] text-[#1A1610] font-black text-xs flex items-center justify-center shrink-0">
                {req.senderInitial}
              </div>
              <div className="min-w-0 flex-1 truncate">
                <p className="text-xs font-bold text-text-primary group-hover:text-[#FBBF24] transition-colors truncate">
                  {req.senderName} <span className="text-[10px] font-normal text-text-secondary underline ml-1">Preview</span>
                </p>
                <p className="text-[10px] text-text-secondary">Sent buddy request</p>
              </div>
            </Link>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => handleApprove(req.id)}
                className="px-2.5 py-1 bg-[#0E0E0E] dark:bg-neutral-800 text-white border border-transparent dark:border-white/15 rounded-lg text-xs font-bold hover:bg-[#262626] dark:hover:bg-neutral-700"
              >
                Approve
              </button>
              <button
                onClick={() => handleIgnore(req.id)}
                className="p-1 text-text-secondary hover:text-[#EA2C26] dark:text-red-400 rounded-lg"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        ))}

        {/* Active Buddy List */}
        {dashboard.buddies.length === 0 && dashboard.pendingRequests.length === 0 ? (
          <div className="p-5 text-center bg-surface rounded-xl border border-border space-y-2">
            <p className="text-xs font-semibold text-text-primary">No accountability buddies yet</p>
            <p className="text-[11px] text-text-secondary">
              Share your Buddy Code to walk and grow together.
            </p>
            <Link href="/find-buddy" className="inline-block pt-1">
              <span className="text-xs font-bold text-[#FBBF24] underline">Add a Buddy</span>
            </Link>
          </div>
        ) : (
          <div className="space-y-2.5">
            {dashboard.buddies.map((buddy) => {
              const isNudged = nudgedState[buddy.id]

              return (
                <div
                  key={buddy.id}
                  onClick={() => router.push(`/buddy-chat/${buddy.id}`)}
                  className="p-3 rounded-xl bg-surface border border-border flex items-center justify-between gap-3 hover:border-[#FBBF24]/40 dark:border-white/15 hover:bg-subtle transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 border border-neutral-300 dark:border-neutral-600 ring-1 ring-black/5 dark:ring-white/20 font-bold text-xs flex items-center justify-center shadow-2xs">
                        {buddy.initial}
                      </div>
                      {buddy.isActiveNow && (
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-card" />
                      )}
                    </div>

                    <div className="truncate">
                      <p className="text-xs font-bold text-text-primary truncate">{buddy.name}</p>
                      <div className="flex items-center gap-1.5 text-[10px] text-text-secondary">
                        {buddy.bothDone ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5">
                            <CheckCircle size={12} weight="fill" /> Goals complete
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            Pending:
                            {!buddy.prayerDone && (
                              <span className="inline-flex items-center gap-0.5 opacity-80">
                                <HandsPraying size={11} weight="fill" className="text-[#FBBF24]" /> Prayer
                              </span>
                            )}
                            {!buddy.studyDone && (
                              <span className="inline-flex items-center gap-0.5 opacity-80">
                                <BookOpen size={11} className="text-[#FBBF24]" /> Study
                              </span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={(e) => handleNudge(e, buddy.id, buddy.connectionId)}
                      disabled={isNudged}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                        isNudged
                          ? 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-[#1A1610] animate-nudge'
                          : `bg-card border border-border text-text-primary hover:border-[#FBBF24]/60 dark:hover:border-[#FBBF24]/60 shadow-2xs ${
                              vibratingState[buddy.id] ? 'anim-vibrate' : ''
                            }`
                      }`}
                    >
                      {isNudged ? (
                        <>
                          <Check size={12} weight="bold" />
                          <span>Sent! ✓</span>
                        </>
                      ) : (
                        <>
                          <HandWaving size={13} weight="fill" className="text-[#FBBF24]" />
                          <span>Nudge</span>
                        </>
                      )}
                    </button>

                    <Link
                      href={`/buddy-chat/${buddy.id}`}
                      className="px-3 py-1.5 rounded-xl bg-[#0E0E0E] dark:bg-[#1C1813] border border-transparent dark:border-[#FBBF24]/50 text-white dark:text-[#F5F1E8] text-xs font-bold shadow-2xs hover:bg-[#262626] dark:hover:bg-[#231E18] dark:hover:border-[#FBBF24]/80 flex items-center gap-1 transition-all cursor-pointer"
                      title={`SynC with ${buddy.name}`}
                    >
                      <ChatCircle size={13} weight="fill" className="text-[#FBBF24]" />
                      <span>SynC</span>
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Global Community Attendance */}
      <Link href="/square" className="block group">
        <div className="faith-card p-4 flex items-center justify-between gap-4 group-hover:border-[#FBBF24]/40 dark:border-amber-500/30 transition-all cursor-pointer">
          <div className="flex items-center gap-3">
            {dashboard.activeCommunityUsers.length > 0 ? (
              <div className="flex -space-x-2 shrink-0">
                {dashboard.activeCommunityUsers.slice(0, 3).map((u, idx) => (
                  <div
                    key={u.id || idx}
                    className="w-7 h-7 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-bold text-[10px] flex items-center justify-center ring-2 ring-card border border-neutral-300 dark:border-neutral-700 shadow-2xs"
                  >
                    {u.initial}
                  </div>
                ))}
                {dashboard.globalCount > 3 && (
                  <div className="w-7 h-7 rounded-full bg-[#FBBF24] text-black font-bold text-[9px] flex items-center justify-center ring-2 ring-card shadow-2xs">
                    +{dashboard.globalCount - 3}
                  </div>
                )}
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full bg-[#EBF3EE] dark:bg-emerald-950/40 border border-[#234537]/25 dark:border-emerald-600/40 text-[#234537] dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-2xs">
                <Fire size={16} weight="fill" className="text-[#234537] dark:text-emerald-400" />
              </div>
            )}

            <div>
              <p className="text-xs font-bold text-text-primary">
                {dashboard.globalCount} {dashboard.globalCount === 1 ? 'believer' : 'believers'} showed up today
              </p>
              <p className="text-[10px] text-text-secondary dark:text-neutral-400">
                The community is stronger with you
              </p>
            </div>
          </div>

          <CaretRight size={18} className="text-text-secondary group-hover:translate-x-1 transition-transform" />
        </div>
      </Link>

      {/* Devotion Gating Modal for Verse of the Day Square Share */}
      <Modal
        isOpen={showGatingModal}
        onClose={() => setShowGatingModal(false)}
        maxWidth="sm"
      >
        <div className="flex flex-col items-center text-center space-y-4 pt-1 pb-2">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-[#FBBF24]">
            <Lock size={24} weight="bold" />
          </div>

          <div className="space-y-1.5">
            <h3 className="text-base font-bold text-text-primary tracking-tight">
              Devotion Clock-In Required
            </h3>
            <p className="text-xs text-text-secondary leading-relaxed px-2">
              To keep records authentic on the Community Square, you must complete today&apos;s personal <span className="font-semibold text-text-primary">Prayer ({dashboard.prayerMinutes}/{prayerTarget}m)</span> and <span className="font-semibold text-text-primary">Study ({dashboard.studyMinutes}/{studyTarget}m)</span> targets before sharing.
            </p>
          </div>

          <div className="w-full space-y-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setShowGatingModal(false)
                router.push('/clock-in')
              }}
              className="w-full py-3 px-4 rounded-xl bg-[#0E0E0E] dark:bg-[#1C1813] border border-transparent dark:border-[#FBBF24]/50 text-white dark:text-[#F5F1E8] font-bold text-xs flex items-center justify-center gap-2 hover:bg-[#262626] dark:hover:bg-[#251E18] transition-all cursor-pointer shadow-sm"
            >
              <span>Clock In Now</span>
              <ArrowRight size={14} weight="bold" className="text-[#FBBF24]" />
            </button>

            <button
              type="button"
              onClick={() => setShowGatingModal(false)}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
            >
              Maybe Later
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
