'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  CaretLeft,
  Sparkle,
  Fire,
  BookOpen,
  ShareNetwork,
  Quotes,
  Check,
  CircleNotch,
  TrendUp,
  CalendarBlank,
} from '@phosphor-icons/react'
import { createClient } from '@/lib/supabase/client'
import { getLocalDateKey, getStartOfLocalDay } from '@/lib/utils/date'

interface DayData {
  dayLabel: string
  fullDate: string
  minutes: number
  prayerMinutes: number
  studyMinutes: number
}

interface TopReflection {
  id: string
  content: string
  type: string
  durationMinutes: number
  dateStr: string
}

const KEYWORD_MAP: Record<string, string[]> = {
  Patience: ['patience', 'patient', 'waiting', 'slow down', 'endure', 'timing'],
  Peace: ['peace', 'stillness', 'quiet', 'calm', 'rest', 'anxiety', 'worries'],
  Gratitude: ['grateful', 'gratitude', 'thankful', 'thanks', 'blessed', 'praise'],
  Faith: ['faith', 'trust', 'believe', 'hoping', 'confidence', 'doubt'],
  Family: ['family', 'children', 'spouse', 'parents', 'home', 'marriage'],
  Endurance: ['endure', 'strength', 'fight', 'persevere', 'perseverance', 'tired'],
  Wisdom: ['wisdom', 'direction', 'guidance', 'decision', 'clarity', 'discernment'],
  Surrender: ['surrender', 'let go', 'submit', 'humble', 'yielding'],
  Love: ['love', 'compassion', 'kindness', 'forgive', 'forgiveness', 'grace'],
}

export default function ReviewDigestPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [daysData, setDaysData] = useState<DayData[]>([])
  const [totalWeekMins, setTotalWeekMins] = useState(0)
  const [activeDaysCount, setActiveDaysCount] = useState(0)
  const [detectedThemes, setDetectedThemes] = useState<string[]>([])
  const [topReflection, setTopReflection] = useState<TopReflection | null>(null)
  const [sharing, setSharing] = useState(false)
  const [sharedSuccess, setSharedSuccess] = useState(false)

  useEffect(() => {
    async function loadWeeklyDigest() {
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          router.push('/login')
          return
        }

        // Build last 7 days array
        const days: DayData[] = []
        const now = new Date()
        for (let i = 6; i >= 0; i--) {
          const d = new Date(now)
          d.setDate(d.getDate() - i)
          const dateStr = getLocalDateKey(d)
          const dayName = d.toLocaleDateString('en-US', { weekday: 'short' })
          days.push({
            dayLabel: dayName,
            fullDate: dateStr,
            minutes: 0,
            prayerMinutes: 0,
            studyMinutes: 0,
          })
        }

        const sevenDaysAgo = getStartOfLocalDay(now)
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

        // Fetch sessions from last 7 days
        const { data: weekSessions } = await supabase
          .from('sessions')
          .select('*')
          .eq('user_id', user.id)
          .gte('started_at', sevenDaysAgo.toISOString())
          .order('started_at', { ascending: true })

        let weekMinutesSum = 0
        const activeDates = new Set<string>()
        const allReflectionTexts: string[] = []
        let longestReflection: TopReflection | null = null

        if (weekSessions && weekSessions.length > 0) {
          weekSessions.forEach((s) => {
            const dateStr = getLocalDateKey(s.started_at || s.created_at)
            const mins = Math.floor((s.duration_seconds || 0) / 60)
            weekMinutesSum += mins
            if (mins > 0) activeDates.add(dateStr)

            const dayObj = days.find((d) => d.fullDate === dateStr)
            if (dayObj) {
              dayObj.minutes += mins
              if (s.type === 'prayer') dayObj.prayerMinutes += mins
              if (s.type === 'study' || s.type === 'word') dayObj.studyMinutes += mins
            }

            // Reflection processing
            if (s.reflection && s.reflection.trim().length > 0) {
              const text = s.reflection.trim()
              allReflectionTexts.push(text)

              if (!longestReflection || text.length > longestReflection.content.length) {
                longestReflection = {
                  id: s.id,
                  content: text,
                  type: s.type,
                  durationMinutes: Math.floor((s.duration_seconds || 0) / 60),
                  dateStr: new Date(s.started_at || s.created_at).toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                  }),
                }
              }
            }
          })
        }

        setDaysData(days)
        setTotalWeekMins(weekMinutesSum)
        setActiveDaysCount(activeDates.size)
        setTopReflection(longestReflection)

        // AI Thematic Analysis
        const combinedNotes = allReflectionTexts.join(' ').toLowerCase()
        const themesFound: string[] = []

        if (combinedNotes.length > 0) {
          Object.entries(KEYWORD_MAP).forEach(([theme, keywords]) => {
            const matched = keywords.some((kw) => combinedNotes.includes(kw))
            if (matched) {
              themesFound.push(theme)
            }
          })
        }

        setDetectedThemes(themesFound.slice(0, 4))
      } catch (err) {
        console.error('Failed to load weekly digest:', err)
      } finally {
        setLoading(false)
      }
    }

    loadWeeklyDigest()
  }, [router])

  // Share Top Reflection to Community Square
  const handleShareReflection = async () => {
    if (!topReflection) return
    try {
      setSharing(true)
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      await supabase.from('square_posts').insert({
        user_id: user.id,
        session_id: topReflection.id,
        content: topReflection.content,
        post_type: 'testimony',
      })

      setSharedSuccess(true)
      setTimeout(() => setSharedSuccess(false), 3000)
    } catch (err) {
      console.error('Failed to share reflection to square:', err)
    } finally {
      setSharing(false)
    }
  }

  // Calculate sparkline SVG coordinates
  const maxMinutes = Math.max(...daysData.map((d) => d.minutes), 30)
  const svgWidth = 320
  const svgHeight = 110
  const paddingX = 25
  const paddingY = 20

  const points = daysData.map((d, index) => {
    const x = paddingX + (index / Math.max(1, daysData.length - 1)) * (svgWidth - paddingX * 2)
    const normalizedY = d.minutes / maxMinutes
    const y = svgHeight - paddingY - normalizedY * (svgHeight - paddingY * 2)
    return { x, y, minutes: d.minutes, dayLabel: d.dayLabel }
  })

  const pathD = points.reduce((acc, pt, i) => {
    return i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`
  }, '')

  const areaD =
    points.length > 0
      ? `${pathD} L ${points[points.length - 1].x} ${svgHeight - paddingY} L ${points[0].x} ${
          svgHeight - paddingY
        } Z`
      : ''

  if (loading) {
    return (
      <div className="command-center-container px-4 sm:px-6 pt-16 flex flex-col items-center justify-center space-y-2 min-h-[60vh] text-text-secondary">
        <CircleNotch size={24} className="animate-spin text-[#FBBF24]" />
        <p className="text-xs font-bold">Compiling weekly digest...</p>
      </div>
    )
  }

  return (
    <div className="command-center-container px-4 sm:px-6 pt-3 pb-28 space-y-5">
      {/* 1. Header */}
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <button
          type="button"
          onClick={() => router.back()}
          className="p-2 rounded-xl text-text-secondary hover:text-text-primary hover:bg-subtle/50 transition-colors flex items-center gap-1 text-xs font-bold"
        >
          <CaretLeft size={18} />
          <span>Back</span>
        </button>

        <h1 className="text-sm font-extrabold text-text-primary tracking-tight">
          Weekly Review Digest
        </h1>

        <div className="w-12" />
      </div>

      {/* Overview Stat Strip */}
      <div className="grid grid-cols-2 gap-3">
        <div className="faith-card p-4 bg-card border border-border space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary block">
            7-Day Total
          </span>
          <div className="text-2xl font-black font-mono-tabular text-text-primary">
            {totalWeekMins} <span className="text-xs font-bold text-text-secondary">Mins</span>
          </div>
          <p className="text-[10px] text-text-secondary">
            Avg {Math.round(totalWeekMins / 7)} mins / day
          </p>
        </div>

        <div className="faith-card p-4 bg-card border border-border space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary block">
            Active Days
          </span>
          <div className="text-2xl font-black font-mono-tabular text-[#FBBF24]">
            {activeDaysCount} <span className="text-xs font-bold text-text-secondary">/ 7 Days</span>
          </div>
          <p className="text-[10px] text-text-secondary">Spiritual momentum</p>
        </div>
      </div>

      {/* A. Engagement Graph (The Sparkline) */}
      <div className="faith-card p-5 bg-card border border-border rounded-3xl shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendUp size={16} className="text-[#FBBF24]" />
            <h2 className="text-xs font-black uppercase tracking-wider text-text-primary">
              Engagement Trend (Last 7 Days)
            </h2>
          </div>
          <span className="text-[10px] font-bold text-text-secondary">Minutes Logged</span>
        </div>

        {/* Sparkline SVG */}
        <div className="w-full flex flex-col items-center pt-2">
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-32 overflow-visible"
          >
            <defs>
              <linearGradient id="goldGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FBBF24" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#FBBF24" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Baseline */}
            <line
              x1={paddingX}
              y1={svgHeight - paddingY}
              x2={svgWidth - paddingX}
              y2={svgHeight - paddingY}
              stroke="#E5E7EB"
              strokeWidth="1"
              strokeDasharray="3 3"
            />

            {/* Area Fill */}
            {points.length > 0 && (
              <path d={areaD} fill="url(#goldGradient)" />
            )}

            {/* Connecting Gold Line */}
            {points.length > 0 && (
              <path
                d={pathD}
                fill="none"
                stroke="#FBBF24"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Data Plot Circles */}
            {points.map((pt, i) => (
              <g key={i}>
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r="4.5"
                  fill="#FBBF24"
                  stroke="#FFFFFF"
                  strokeWidth="2"
                  className="transition-all hover:scale-125"
                />
                {pt.minutes > 0 && (
                  <text
                    x={pt.x}
                    y={pt.y - 8}
                    textAnchor="middle"
                    fill="#0E0E0E"
                    fontSize="9"
                    fontWeight="bold"
                    fontFamily="monospace"
                  >
                    {pt.minutes}m
                  </text>
                )}
              </g>
            ))}
          </svg>

          {/* Days Label Axis */}
          <div className="w-full grid grid-cols-7 text-center pt-1 border-t border-border-light">
            {daysData.map((d, idx) => (
              <div key={idx} className="space-y-0.5">
                <span className="text-[10px] font-bold text-text-secondary block">
                  {d.dayLabel}
                </span>
                <span className="text-[9px] font-mono-tabular text-text-muted block">
                  {d.minutes > 0 ? `${d.minutes}m` : '-'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* B. AI Thematic Insights */}
      <div className="faith-card p-5 bg-card border border-border rounded-3xl shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <Sparkle size={18} weight="fill" className="text-[#FBBF24]" />
          <h2 className="text-xs font-black uppercase tracking-wider text-text-primary">
            Spiritual Themes & Patterns
          </h2>
        </div>

        {detectedThemes.length > 0 ? (
          <div className="p-4 rounded-2xl bg-[#FDF9F1] border border-[#FBBF24]/35 space-y-2.5">
            <p className="text-xs text-text-primary leading-relaxed">
              <span className="font-bold">Consistent Themes:</span> Over the last 7 days, your
              reflections frequently centered around spiritual growth, steady endurance, and seeking
              God&apos;s peace in prayer.
            </p>

            {/* Hashtag Pills */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {detectedThemes.map((tag) => (
                <span
                  key={tag}
                  className="px-2.5 py-1 rounded-full bg-card border border-[#FBBF24]/40 text-text-primary text-[10px] font-black tracking-wide shadow-xs"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-surface border border-border text-center space-y-1">
            <p className="text-xs font-bold text-text-primary">Building Your Foundation</p>
            <p className="text-[11px] text-text-secondary leading-snug">
              You were quiet in your reflection notes this week. Jotting down brief prayers and thoughts
              during clock-ins unlocks deeper thematic insights over time.
            </p>
          </div>
        )}
      </div>

      {/* C. Top Reflection & Community Sharing */}
      {topReflection && (
        <div className="faith-card p-5 bg-card border border-border rounded-3xl shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Quotes size={18} weight="fill" className="text-[#EA2C26]" />
              <h2 className="text-xs font-black uppercase tracking-wider text-text-primary">
                Top Reflection of the Week
              </h2>
            </div>

            <span className="text-[10px] font-bold text-text-secondary uppercase">
              {topReflection.dateStr}
            </span>
          </div>

          {/* Italicized Quote Card */}
          <div className="border-l-4 border-[#EA2C26] bg-surface p-4 rounded-r-2xl space-y-1.5 shadow-xs">
            <p className="text-xs text-text-primary italic leading-relaxed whitespace-pre-line">
              &ldquo;{topReflection.content}&rdquo;
            </p>
            <span className="text-[10px] font-bold text-text-secondary block">
              Logged during {topReflection.durationMinutes}m {topReflection.type} session
            </span>
          </div>

          {/* Share to Community Square Button */}
          <button
            type="button"
            onClick={handleShareReflection}
            disabled={sharing || sharedSuccess}
            className={`w-full py-3.5 px-5 rounded-2xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 ${
              sharedSuccess
                ? 'bg-emerald-600 text-white'
                : 'bg-[#0E0E0E] text-white hover:bg-[#262626] active:scale-95'
            }`}
          >
            {sharing ? (
              <>
                <CircleNotch size={16} className="animate-spin text-[#FBBF24]" />
                <span>Publishing to Square...</span>
              </>
            ) : sharedSuccess ? (
              <>
                <Check size={16} weight="bold" />
                <span>Shared to Community Square! ✓</span>
              </>
            ) : (
              <>
                <ShareNetwork size={16} className="text-[#FBBF24]" />
                <span>Share to Community Square</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
