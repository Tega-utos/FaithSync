'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CaretLeft,
  Trophy,
  Fire,
  BookOpen,
  Sparkle,
  HourglassMedium,
  CheckCircle,
  Lock,
  HandsPraying,
  CircleNotch,
} from '@phosphor-icons/react'
import { createClient } from '@/lib/supabase/client'
import { calculateUserStreak } from '@/lib/utils/streak'

interface MilestoneStats {
  completedSessions: number
  totalMinutes: number
  currentStreakDays: number
  prayerMinutes: number
  studyMinutes: number
}

interface BadgeConfig {
  id: string
  title: string
  description: string
  icon: React.ElementType
  unlockedWhen: (stats: MilestoneStats) => boolean
}

const BADGES: BadgeConfig[] = [
  {
    id: 'first_step',
    title: 'First Step',
    description: 'Complete your first verified spiritual session',
    icon: Sparkle,
    unlockedWhen: (stats) => stats.completedSessions >= 1,
  },
  {
    id: 'fire_starter',
    title: 'Fire Starter',
    description: 'Maintain a 3-day spiritual consistency streak',
    icon: Fire,
    unlockedWhen: (stats) => stats.currentStreakDays >= 3,
  },
  {
    id: 'prayer_warrior',
    title: 'Prayer Warrior',
    description: 'Accumulate 100+ minutes in the secret place',
    icon: HandsPraying,
    unlockedWhen: (stats) => stats.prayerMinutes >= 100,
  },
  {
    id: 'scripture_seeker',
    title: 'Scripture Seeker',
    description: 'Log 60+ minutes in Scripture study & reflection',
    icon: BookOpen,
    unlockedWhen: (stats) => stats.studyMinutes >= 60,
  },
  {
    id: '7_day_streak',
    title: '7 Day Streak',
    description: 'Consistency is key — reach a 7-day walk',
    icon: Trophy,
    unlockedWhen: (stats) => stats.currentStreakDays >= 7,
  },
  {
    id: 'marathon_believer',
    title: 'Marathon Believer',
    description: 'Clock in 10+ total lifetime hours of devotion',
    icon: HourglassMedium,
    unlockedWhen: (stats) => stats.totalMinutes >= 600,
  },
  {
    id: 'centurion',
    title: 'Centurion',
    description: 'Complete 100 verified spiritual sessions',
    icon: CheckCircle,
    unlockedWhen: (stats) => stats.completedSessions >= 100,
  },
]

export default function MilestonesPage() {
  const router = useRouter()
  const [stats, setStats] = useState<MilestoneStats>({
    completedSessions: 0,
    totalMinutes: 0,
    currentStreakDays: 0,
    prayerMinutes: 0,
    studyMinutes: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadMilestones() {
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          setLoading(false)
          return
        }

        // Fetch all user sessions to calculate strictly verified completed metrics
        const { data: allSessions } = await supabase
          .from('sessions')
          .select('type, duration_seconds, target_duration_seconds, is_complete, started_at, created_at')
          .eq('user_id', user.id)
          .order('started_at', { ascending: false })

        if (allSessions && allSessions.length > 0) {
          // Data Integrity: Only count sessions where user officially completed target time (is_complete)
          const verifiedSessions = allSessions.filter(
            (s) =>
              s.is_complete ||
              (s.duration_seconds > 0 &&
                s.duration_seconds >= (s.target_duration_seconds || 0))
          )

          let totalPrayerSecs = 0
          let totalStudySecs = 0
          const uniqueDays = new Set<string>()

          verifiedSessions.forEach((s) => {
            if (s.type === 'prayer') {
              totalPrayerSecs += s.duration_seconds
            }
            if (s.type === 'study' || s.type === 'word') {
              totalStudySecs += s.duration_seconds
            }
            const dateStr = new Date(s.started_at || s.created_at).toISOString().split('T')[0]
            uniqueDays.add(dateStr)
          })

          const pMins = Math.floor(totalPrayerSecs / 60)
          const sMins = Math.floor(totalStudySecs / 60)
          const totMins = pMins + sMins
          const realStreak = await calculateUserStreak(user.id, supabase)

          setStats({
            completedSessions: verifiedSessions.length,
            totalMinutes: totMins,
            currentStreakDays: realStreak,
            prayerMinutes: pMins,
            studyMinutes: sMins,
          })
        }
      } catch (err) {
        console.error('Failed to load milestones:', err)
      } finally {
        setLoading(false)
      }
    }

    loadMilestones()
  }, [])

  // Time conversion: hours and minutes
  const hours = Math.floor(stats.totalMinutes / 60)
  const remainingMins = stats.totalMinutes % 60
  const formattedTotalTime =
    hours > 0
      ? `${hours}h ${remainingMins > 0 ? `${remainingMins}m` : ''}`
      : `${stats.totalMinutes}m`

  const earnedBadges = BADGES.filter((b) => b.unlockedWhen(stats))
  const lockedBadges = BADGES.filter((b) => !b.unlockedWhen(stats))

  if (loading) {
    return (
      <div className="command-center-container px-4 sm:px-6 pt-12 flex flex-col items-center justify-center space-y-2 min-h-[60vh] text-[#707070]">
        <CircleNotch size={24} className="animate-spin text-[#FBBF24]" />
        <p className="text-xs font-bold">Loading records & milestones...</p>
      </div>
    )
  }

  return (
    <div className="command-center-container px-4 sm:px-6 pt-3 pb-28 space-y-5">
      {/* 1. Header */}
      <div className="flex items-center justify-between pb-2 border-b border-[#E5E7EB]">
        <button
          type="button"
          onClick={() => router.back()}
          className="p-2 rounded-xl text-[#707070] hover:text-[#0E0E0E] hover:bg-[#F3F4F6]/50 transition-colors flex items-center gap-1 text-xs font-bold"
        >
          <CaretLeft size={18} />
          <span>Back</span>
        </button>

        <h1 className="text-sm font-extrabold text-[#0E0E0E] tracking-tight">
          Records & Milestones
        </h1>

        <div className="w-12" />
      </div>

      {/* 2. The Stats Summary Card */}
      <div className="faith-card p-5 sm:p-6 bg-white border border-[#E5E7EB] rounded-3xl shadow-sm space-y-5">
        {/* Top Section (The Big Numbers) */}
        <div className="grid grid-cols-2 items-center">
          {/* Left: Lifetime Sessions */}
          <div className="pr-4">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#707070] block mb-1">
              Sessions
            </span>
            <div className="text-3xl sm:text-4xl font-black font-mono-tabular tracking-tight text-[#0E0E0E]">
              {stats.completedSessions}
            </div>
            <span className="text-[10px] text-[#9095A1] font-medium mt-0.5 block">
              Completed Targets
            </span>
          </div>

          {/* Vertical Divider & Right: Total Time */}
          <div className="pl-4 border-l border-[#E5E7EB]">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#707070] block mb-1">
              Total Time
            </span>
            <div className="text-3xl sm:text-4xl font-black font-mono-tabular tracking-tight text-[#FBBF24]">
              {formattedTotalTime}
            </div>
            <span className="text-[10px] text-[#9095A1] font-medium mt-0.5 block">
              Lifetime Devotion
            </span>
          </div>
        </div>

        {/* Bottom Section (The Breakdown) */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#E5E7EB]">
          {/* Prayer Breakdown */}
          <div className="p-3 rounded-2xl bg-[#FFF0F0] border border-[#EA2C26]/20 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white text-[#EA2C26] flex items-center justify-center shrink-0 shadow-sm">
              <Fire size={20} weight="fill" />
            </div>
            <div className="truncate">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#EA2C26] block">
                Prayer
              </span>
              <span className="text-sm font-black font-mono-tabular text-[#0E0E0E]">
                {stats.prayerMinutes} Mins
              </span>
            </div>
          </div>

          {/* Study Breakdown */}
          <div className="p-3 rounded-2xl bg-[#FDF9F1] border border-[#FBBF24]/35 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white text-[#FBBF24] flex items-center justify-center shrink-0 shadow-sm">
              <BookOpen size={20} />
            </div>
            <div className="truncate">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#B45309] block">
                Study
              </span>
              <span className="text-sm font-black font-mono-tabular text-[#0E0E0E]">
                {stats.studyMinutes} Mins
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. The Gamified Badges System */}
      <div className="space-y-6 pt-1">
        {/* A. Earned Badges */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy size={16} className="text-[#FBBF24]" />
              <h2 className="text-xs font-black uppercase tracking-wider text-[#0E0E0E]">
                Earned Badges ({earnedBadges.length})
              </h2>
            </div>
            {earnedBadges.length > 0 && (
              <span className="text-[10px] font-bold text-[#FBBF24] uppercase tracking-wider">
                Unlocked
              </span>
            )}
          </div>

          {earnedBadges.length === 0 ? (
            /* Dashed empty state */
            <div className="p-6 rounded-2xl border-2 border-dashed border-[#E5E7EB] bg-white/60 text-center space-y-1.5">
              <p className="text-xs font-bold text-[#0E0E0E]">No badges earned yet</p>
              <p className="text-[11px] text-[#707070]">
                Keep going! Clock in and hit your daily targets to unlock your first trophy.
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {earnedBadges.map((badge) => {
                const IconComponent = badge.icon
                return (
                  <div
                    key={badge.id}
                    className="p-4 rounded-2xl bg-[#0E0E0E] text-white border border-[#262626] shadow-lg relative overflow-hidden flex items-center gap-3.5 group"
                  >
                    {/* Subtle Gold Radial Gradient Glow */}
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#FBBF24]/20 via-transparent to-transparent pointer-events-none" />

                    {/* Gold-Filtered Icon Slot */}
                    <div className="w-12 h-12 rounded-xl bg-white/10 border border-[#FBBF24]/40 flex items-center justify-center text-[#FBBF24] shrink-0 shadow-inner relative z-10">
                      <IconComponent size={24} weight="fill" />
                    </div>

                    <div className="relative z-10 space-y-0.5 truncate">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-black text-white tracking-tight">
                          {badge.title}
                        </h3>
                        <span className="px-2 py-0.5 rounded-full bg-[#FBBF24]/20 border border-[#FBBF24]/40 text-[#FBBF24] text-[9px] font-extrabold uppercase">
                          Earned
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-snug">
                        {badge.description}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* B. Locked Badges */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Lock size={16} className="text-[#9095A1]" />
            <h2 className="text-xs font-black uppercase tracking-wider text-[#707070]">
              Locked Badges ({lockedBadges.length})
            </h2>
          </div>

          <div className="grid gap-3">
            {lockedBadges.map((badge) => {
              return (
                <div
                  key={badge.id}
                  className="faith-card p-4 bg-white border border-[#E5E7EB] rounded-2xl flex items-center gap-3.5 opacity-80"
                >
                  {/* Grayed-out Lock Icon Slot */}
                  <div className="w-12 h-12 rounded-xl bg-[#F3F4F6] border border-[#E5E7EB] flex items-center justify-center text-[#9095A1] shrink-0">
                    <Lock size={20} />
                  </div>

                  <div className="space-y-0.5 truncate">
                    <h3 className="text-xs font-bold text-[#0E0E0E]">{badge.title}</h3>
                    <p className="text-[11px] text-[#707070] leading-snug">{badge.description}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
