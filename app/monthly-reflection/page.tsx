'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  CaretLeft,
  Fire,
  BookOpen,
  CheckCircle,
  ShareNetwork,
  CircleNotch,
  Check,
  Notebook,
  Sparkle,
} from '@phosphor-icons/react'
import { createClient } from '@/lib/supabase/client'

export default function MonthlyReflectionPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)

  // Current Month Stats
  const [monthName, setMonthName] = useState('')
  const [prayerMinutes, setPrayerMinutes] = useState(0)
  const [studyMinutes, setStudyMinutes] = useState(0)
  const [totalSessions, setTotalSessions] = useState(0)

  // Form State
  const [journalText, setJournalText] = useState('')
  const [verseReference, setVerseReference] = useState('')
  const [shareToSquare, setShareToSquare] = useState(true)

  useEffect(() => {
    async function loadMonthlyStats() {
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          router.push('/login')
          return
        }

        const now = new Date()
        const currentMonthTitle = now.toLocaleDateString('en-US', {
          month: 'long',
          year: 'numeric',
        })
        setMonthName(currentMonthTitle)

        // First day of current month
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

        const { data: monthSessions } = await supabase
          .from('sessions')
          .select('type, duration_seconds, started_at')
          .eq('user_id', user.id)
          .gte('started_at', startOfMonth.toISOString())

        if (monthSessions && monthSessions.length > 0) {
          let pMins = 0
          let sMins = 0
          monthSessions.forEach((s) => {
            const mins = Math.floor((s.duration_seconds || 0) / 60)
            if (s.type === 'prayer') pMins += mins
            if (s.type === 'study' || s.type === 'word') sMins += mins
          })

          setPrayerMinutes(pMins)
          setStudyMinutes(sMins)
          setTotalSessions(monthSessions.length)
        }
      } catch (err) {
        console.error('Failed to load monthly stats:', err)
      } finally {
        setLoading(false)
      }
    }

    loadMonthlyStats()
  }, [router])

  // Save Monthly Reflection
  const handleSaveReflection = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!journalText.trim()) return

    try {
      setSaving(true)
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      // Format formatted monthly journal text
      const totalMonthMins = prayerMinutes + studyMinutes
      const formattedEntry = `**${monthName} Spiritual Reflection**\n\n📊 **Monthly Momentum**: ${totalSessions} sessions | ${prayerMinutes}m Prayer | ${studyMinutes}m Study (${totalMonthMins}m total)\n\n${journalText.trim()}`

      if (shareToSquare) {
        // Publish to square_posts
        await supabase.from('square_posts').insert({
          user_id: user.id,
          content: formattedEntry,
          verse_reference: verseReference.trim() || null,
          post_type: 'testimony',
        })
      }

      setSavedSuccess(true)
      setTimeout(() => {
        if (shareToSquare) {
          router.push('/square')
        } else {
          router.push('/profile')
        }
      }, 1500)
    } catch (err) {
      console.error('Failed to save monthly reflection:', err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="command-center-container px-4 sm:px-6 pt-16 flex flex-col items-center justify-center space-y-2 min-h-[60vh] text-[#707070]">
        <CircleNotch size={24} className="animate-spin text-[#FBBF24]" />
        <p className="text-xs font-bold">Loading monthly overview...</p>
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
          Monthly Reflection
        </h1>

        <div className="w-12" />
      </div>

      {/* Intro Header */}
      <div className="space-y-1">
        <h2 className="text-xl font-black text-[#0E0E0E] tracking-tight">
          {monthName} Journal
        </h2>
        <p className="text-xs text-[#707070] leading-relaxed">
          Reflect on God&apos;s faithfulness, your consistency, and areas for spiritual growth over
          the past month.
        </p>
      </div>

      {/* A. The Monthly Stats Rollup (3 Metric Blocks) */}
      <div className="grid grid-cols-3 gap-2.5">
        {/* Prayer Min */}
        <div className="p-3.5 rounded-2xl bg-[#FFF0F0] border border-[#EA2C26]/20 flex flex-col justify-between space-y-1 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold uppercase tracking-wider text-[#EA2C26]">
              Prayer
            </span>
            <Fire size={15} weight="fill" className="text-[#EA2C26]" />
          </div>
          <div>
            <span className="text-xl font-black font-mono-tabular text-[#0E0E0E] block">
              {prayerMinutes}
            </span>
            <span className="text-[9px] text-[#707070] font-medium">Minutes</span>
          </div>
        </div>

        {/* Study Min */}
        <div className="p-3.5 rounded-2xl bg-[#FDF9F1] border border-[#FBBF24]/35 flex flex-col justify-between space-y-1 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold uppercase tracking-wider text-[#B45309]">
              Study
            </span>
            <BookOpen size={15} className="text-[#FBBF24]" />
          </div>
          <div>
            <span className="text-xl font-black font-mono-tabular text-[#0E0E0E] block">
              {studyMinutes}
            </span>
            <span className="text-[9px] text-[#707070] font-medium">Minutes</span>
          </div>
        </div>

        {/* Total Sessions */}
        <div className="p-3.5 rounded-2xl bg-white border border-[#E5E7EB] flex flex-col justify-between space-y-1 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold uppercase tracking-wider text-[#707070]">
              Sessions
            </span>
            <CheckCircle size={15} weight="fill" className="text-emerald-600" />
          </div>
          <div>
            <span className="text-xl font-black font-mono-tabular text-[#0E0E0E] block">
              {totalSessions}
            </span>
            <span className="text-[9px] text-[#707070] font-medium">Clock-ins</span>
          </div>
        </div>
      </div>

      {/* B. The Journal Area */}
      <form onSubmit={handleSaveReflection} className="space-y-4">
        <div className="faith-card p-5 bg-white border border-[#E5E7EB] rounded-3xl shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <Notebook size={18} className="text-[#FBBF24]" />
            <h3 className="text-xs font-black uppercase tracking-wider text-[#0E0E0E]">
              Spiritual Journaling
            </h3>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-[#707070] block">
              Monthly Reflection & Takeaways
            </label>
            <textarea
              required
              rows={6}
              value={journalText}
              onChange={(e) => setJournalText(e.target.value)}
              placeholder="Where did you see God move this month? How has your spiritual discipline grown, and what are your intentions for the month ahead?"
              className="w-full p-4 bg-[#FAF6EE] border border-[#E5E7EB] rounded-2xl text-xs text-[#0E0E0E] placeholder-[#9095A1] focus:outline-none focus:border-[#FBBF24] focus:bg-white transition-all resize-none shadow-xs leading-relaxed"
            />
          </div>

          <div className="space-y-1 pt-1">
            <label className="text-[11px] font-bold text-[#707070] block">
              Anchor Scripture (Optional)
            </label>
            <input
              type="text"
              value={verseReference}
              onChange={(e) => setVerseReference(e.target.value)}
              placeholder="e.g. Psalm 23:1-3, Romans 8:28"
              className="w-full px-3.5 py-2.5 bg-[#FAF6EE] border border-[#E5E7EB] rounded-xl text-xs text-[#0E0E0E] focus:outline-none focus:border-[#FBBF24] focus:bg-white transition-all shadow-xs"
            />
          </div>
        </div>

        {/* C. Community Publishing Toggle */}
        <div className="faith-card p-4 bg-white border border-[#E5E7EB] rounded-2xl flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#FDF9F1] text-[#FBBF24] flex items-center justify-center shrink-0">
              <ShareNetwork size={16} />
            </div>
            <div>
              <p className="text-xs font-bold text-[#0E0E0E]">Share to Square</p>
              <p className="text-[10px] text-[#707070]">
                Publish your monthly stats and reflection card to the Community
              </p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={shareToSquare}
              onChange={(e) => setShareToSquare(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-10 h-6 bg-[#E5E7EB] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[#E5E7EB] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0E0E0E]" />
          </label>
        </div>

        {/* Save Button */}
        <button
          type="submit"
          disabled={saving || savedSuccess || !journalText.trim()}
          className={`w-full py-4 px-6 rounded-2xl font-black text-sm shadow-xl transition-all flex items-center justify-center gap-2 ${
            savedSuccess
              ? 'bg-emerald-600 text-white'
              : 'bg-[#0E0E0E] text-white hover:bg-[#262626] active:scale-95 disabled:opacity-50'
          }`}
        >
          {saving ? (
            <>
              <CircleNotch size={18} className="animate-spin text-[#FBBF24]" />
              <span>Saving Reflection...</span>
            </>
          ) : savedSuccess ? (
            <>
              <Check size={18} weight="bold" />
              <span>Reflection Saved & Published! ✓</span>
            </>
          ) : (
            <>
              <Sparkle size={18} weight="fill" className="text-[#FBBF24]" />
              <span>Save Reflection</span>
            </>
          )}
        </button>
      </form>
    </div>
  )
}
