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
  HandsPraying,
  HandWaving,
  ShareNetwork,
} from '@phosphor-icons/react'
import { createClient } from '@/lib/supabase/client'
import { fetchDashboardData, DashboardData } from '@/features/dashboard/services/dashboardService'
import { WeeklyProgress } from '@/features/dashboard/components/WeeklyProgress'

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

  useEffect(() => {
    async function checkOnboardingAndLoad() {
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('preferences')
            .eq('id', user.id)
            .maybeSingle()

          const hasCompletedOnboarding =
            profile?.preferences?.onboarding_completed === true ||
            (profile?.preferences?.targets?.prayer && profile?.preferences?.targets?.study)

          if (!hasCompletedOnboarding) {
            router.replace('/onboarding')
            return
          }
        }
      } catch (err) {
        console.error('Home onboarding check error:', err)
      }

      const data = await fetchDashboardData()
      if (data) setDashboard(data)
    }

    checkOnboardingAndLoad()

    // 4. Push Notification Permissions (The "Silent Ask")
    // On-Load Bootstrapping: Silently request notification permissions if not yet granted
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
  }, [])

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
                  stroke="#F3F4F6"
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
                  stroke="#F3F4F6"
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
      <div className="faith-card p-5 space-y-3.5 bg-gradient-to-br from-[#FAF6EE] to-white border border-border shadow-xs relative overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#FBBF24] animate-ping" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">
              Verse of the Day
            </span>
          </div>
          <span className="text-[10px] font-mono font-bold text-[#FBBF24] bg-[#FDF9F1] dark:bg-amber-950/30 px-2 py-0.5 rounded-md border border-[#FBBF24]/30 dark:border-amber-500/25">
            Isaiah 40:31 • WEB
          </span>
        </div>

        <blockquote className="space-y-1">
          <p className="text-xs sm:text-sm font-semibold text-text-primary leading-relaxed italic">
            &ldquo;Those who wait for Yahweh will renew their strength. They will mount up with wings like eagles. They will run, and not be weary. They will walk, and not faint.&rdquo;
          </p>
          <p className="text-[10px] text-text-secondary font-medium">
            Spiritual Theme: Strength & Endurance in Daily Waiting
          </p>
        </blockquote>

        {/* 1-Tap Verse Actions */}
        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border-light">
          <Link
            href="/bible?book=Isaiah&chapter=40"
            className="p-2 rounded-xl bg-card border border-border hover:border-[#FBBF24] text-text-primary text-[11px] font-bold flex items-center justify-center gap-1 transition-all shadow-2xs hover:bg-surface"
          >
            <BookOpen size={13} className="text-[#FBBF24]" weight="bold" />
            <span>Read Bible</span>
          </Link>

          <Link
            href={`/square?compose=true&verse=${encodeURIComponent('“Those who wait for Yahweh will renew their strength. They will mount up with wings like eagles. They will run, and not be weary. They will walk, and not faint.” — Isaiah 40:31')}&ref=${encodeURIComponent('Isaiah 40:31')}&intent=record`}
            className="p-2 rounded-xl bg-card border border-border hover:border-[#FBBF24] text-text-primary text-[11px] font-bold flex items-center justify-center gap-1 transition-all shadow-2xs hover:bg-surface"
          >
            <ShareNetwork size={13} className="text-[#234537] dark:text-emerald-400" weight="bold" />
            <span>Share to Square</span>
          </Link>
        </div>
      </div>

      {/* The Clock In Now CTA */}
      <Link href="/clock-in" className="block group">
        <button
          type="button"
          className="w-full bg-[#0E0E0E] dark:bg-white/90 text-white dark:text-[#0E0E0E] py-4 px-6 rounded-2xl flex items-center justify-between font-bold text-base shadow-lg shadow-black/15 group-hover:bg-[#1f1f1f] group-active:scale-[0.99] transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-card/10 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/assets/icon-timer-active.svg"
                alt="Clock In"
                width={20}
                height={20}
                className="w-5 h-5 object-contain"
              />
            </div>
            <span className="tracking-tight">Clock In Now</span>
          </div>
          <CaretRight size={20} className="text-white/80 group-hover:translate-x-1 transition-transform" />
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
              <div className="w-8 h-8 rounded-full bg-[#FBBF24] text-white font-bold text-xs flex items-center justify-center shrink-0">
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
                className="px-2.5 py-1 bg-[#0E0E0E] dark:bg-white/90 text-white dark:text-[#0E0E0E] rounded-lg text-xs font-bold hover:bg-[#262626] dark:hover:bg-white/80"
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
                  className="p-3 rounded-xl bg-surface border border-border flex items-center justify-between gap-3 hover:border-[#FBBF24]/40 dark:border-amber-500/30 hover:bg-subtle transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full bg-[#0E0E0E] dark:bg-white/90 text-white dark:text-[#0E0E0E] font-bold text-xs flex items-center justify-center">
                        {buddy.initial}
                      </div>
                      {buddy.isActiveNow && (
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-50 dark:bg-emerald-950/300 rounded-full ring-2 ring-surface" />
                      )}
                    </div>

                    <div className="truncate">
                      <p className="text-xs font-bold text-text-primary truncate">{buddy.name}</p>
                      <div className="flex items-center gap-1.5 text-[10px] text-text-secondary">
                        {buddy.bothDone ? (
                          <span className="text-emerald-600 font-bold flex items-center gap-0.5">
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

                  <button
                    onClick={(e) => handleNudge(e, buddy.id, buddy.connectionId)}
                    disabled={isNudged}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shrink-0 ${
                      isNudged
                        ? 'bg-emerald-50 dark:bg-emerald-950/300 text-white animate-nudge'
                        : `bg-[#0E0E0E] dark:bg-white/90 text-white dark:text-[#0E0E0E] hover:bg-[#262626] dark:hover:bg-white/80 active:scale-95 ${
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
                        <HandWaving size={12} weight="fill" className="text-[#FBBF24]" />
                        <span>Nudge</span>
                      </>
                    )}
                  </button>
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
                    className="w-7 h-7 rounded-full bg-[#0E0E0E] dark:bg-white/90 text-white dark:text-[#0E0E0E] font-bold text-[10px] flex items-center justify-center ring-2 ring-white"
                  >
                    {u.initial}
                  </div>
                ))}
                {dashboard.globalCount > 3 && (
                  <div className="w-7 h-7 rounded-full bg-[#FBBF24] text-white font-bold text-[9px] flex items-center justify-center ring-2 ring-white">
                    +{dashboard.globalCount - 3}
                  </div>
                )}
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full bg-[#EBF3EE] dark:bg-emerald-950/30 border border-[#234537]/25 dark:border-emerald-700/30 text-[#234537] dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Fire size={16} weight="fill" className="text-[#234537] dark:text-emerald-400" />
              </div>
            )}

            <div>
              <p className="text-xs font-bold text-text-primary">
                {dashboard.globalCount === 0
                  ? '0 believers clocked in today'
                  : `${dashboard.globalCount} believer${dashboard.globalCount === 1 ? '' : 's'} active today`}
              </p>
              <p className="text-[10px] text-text-secondary">
                {dashboard.globalCount === 0
                  ? 'Be the first to clock in today in Community Square'
                  : 'Join the reflections in Community Square'}
              </p>
            </div>
          </div>

          <CaretRight size={18} className="text-text-secondary group-hover:translate-x-1 transition-transform" />
        </div>
      </Link>
    </div>
  )
}
