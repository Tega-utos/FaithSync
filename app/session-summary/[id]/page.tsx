'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Check,
  Fire,
  BookOpen,
  ShareNetwork,
  Sparkle,
  CaretLeft,
  CircleNotch,
  Quotes,
  Clock,
  House,
  Globe,
  Lock,
  HandsPraying,
} from '@phosphor-icons/react'
import { createClient } from '@/lib/supabase/client'

export default function SessionSummaryPage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params?.id as string

  const [loading, setLoading] = useState(true)
  const [sharing, setSharing] = useState(false)
  const [includeReflection, setIncludeReflection] = useState(false)
  const [session, setSession] = useState<{
    id: string
    type: string
    duration_seconds: number
    reflection: string | null
    verse_reference: string | null
    focus_type?: string | null
    focus_timeline?: Array<{
      id?: string
      type: 'scripture' | 'reflection'
      durationMinutes: number
      reference?: string
      versionId?: string
      prompt?: string
      verseText?: string
    }> | null
    created_at: string
  }>({
    id: sessionId,
    type: 'prayer',
    duration_seconds: 900,
    reflection: 'Staying anchored in His grace and seeking divine guidance.',
    verse_reference: 'Hebrews 6:19',
    focus_type: 'quick',
    focus_timeline: null,
    created_at: new Date().toISOString(),
  })

  useEffect(() => {
    async function loadSession() {
      try {
        const supabase = createClient()
        if (sessionId && sessionId !== 'latest' && sessionId !== 'temp') {
          const { data: found } = await supabase
            .from('sessions')
            .select('*')
            .eq('id', sessionId)
            .single()

          if (found) {
            setSession(found as any)
          }
        }
      } catch (err) {
        console.error('Session summary load error:', err)
      } finally {
        setLoading(false)
      }
    }

    loadSession()
  }, [sessionId])

  const mins = Math.floor(session.duration_seconds / 60)
  const secs = session.duration_seconds % 60
  const formattedDuration = `${mins}m ${secs > 0 ? `${secs}s` : ''}`

  const handleShareToSquare = async () => {
    setSharing(true)
    try {
      const res = await fetch('/api/session/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          includeReflection,
          customReflection: includeReflection ? session.reflection : null,
        }),
      })

      if (res.ok) {
        router.push('/square')
      } else {
        router.push('/square')
      }
    } catch {
      router.push('/square')
    } finally {
      setSharing(false)
    }
  }

  return (
    <div className="command-center-container px-4 sm:px-6 pt-4 pb-28 min-h-[92vh] space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-2 border-b border-[#E5E7EB]">
        <button
          type="button"
          onClick={() => router.push('/')}
          className="p-1.5 rounded-xl text-[#707070] hover:text-[#0E0E0E] hover:bg-[#F3F4F6]/50 flex items-center gap-1 text-xs font-bold"
        >
          <CaretLeft size={18} />
          <span>Home</span>
        </button>

        <h1 className="text-sm font-extrabold text-[#0E0E0E]">Session Summary</h1>
        <div className="w-8" />
      </div>

      {/* Success Badge */}
      <div className="text-center space-y-2 pt-2">
        <div className="w-16 h-16 rounded-full bg-[#FDF9F1] border-2 border-[#FBBF24] text-[#FBBF24] flex items-center justify-center mx-auto shadow-md">
          <Check size={28} weight="bold" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-black text-[#0E0E0E] tracking-tight">Session Logged!</h2>
          <p className="text-xs text-[#707070]">
            Your time has been recorded to your daily accountability ledger.
          </p>
        </div>
      </div>

      {/* Session Receipt Card */}
      <div className="faith-card p-6 space-y-5 bg-[#FAF6EE] border border-[#E5E7EB] shadow-lg">
        {/* Receipt Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB]">
          <div className="flex items-center gap-2">
            {session.type === 'prayer' ? (
              <div className="w-9 h-9 rounded-2xl bg-[#FDF9F1] text-[#FBBF24] border border-[#FBBF24]/30 flex items-center justify-center font-bold">
                <HandsPraying size={20} weight="fill" />
              </div>
            ) : (
              <div className="w-9 h-9 rounded-2xl bg-[#FBBF24]/20 text-[#FBBF24] flex items-center justify-center font-bold">
                <BookOpen size={20} />
              </div>
            )}
            <div>
              <h3 className="text-sm font-bold text-[#0E0E0E] capitalize">{session.type} Session</h3>
              <p className="text-[10px] text-[#707070]">Official Proof of Devotion</p>
            </div>
          </div>

          <span className="text-base font-black font-mono text-[#FBBF24] bg-white px-3 py-1 rounded-xl border border-[#E5E7EB]">
            {formattedDuration}
          </span>
        </div>

        {/* Focus / Reflection Text */}
        {session.reflection && (
          <div className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#707070] flex items-center gap-1">
              <Quotes size={14} className="text-[#FBBF24]" /> Your Reflection (Private)
            </span>
            <div className="p-3.5 bg-white rounded-2xl border-l-4 border-[#234537] text-xs text-[#0E0E0E] italic leading-relaxed shadow-sm">
              &ldquo;{session.reflection}&rdquo;
            </div>
          </div>
        )}

        {/* Scripture Reference */}
        {session.verse_reference && (
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#FBBF24] bg-white px-3 py-1 rounded-xl border border-[#E5E7EB]">
            <BookOpen size={14} />
            <span>{session.verse_reference}</span>
          </div>
        )}

        {/* Used Timeline Segments */}
        {Array.isArray(session.focus_timeline) && session.focus_timeline.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-[#E5E7EB]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#707070] flex items-center gap-1">
                <Clock size={13} className="text-[#FBBF24]" />
                Prayer Focus Timeline ({session.focus_timeline.length} Segments)
              </span>
              <span className="text-[10px] font-mono font-bold text-[#FBBF24] bg-[#FDF9F1] px-2 py-0.5 rounded-lg border border-[#FBBF24]/30">
                {session.focus_timeline.reduce((sum, seg) => sum + (seg.durationMinutes || 1), 0)}m Guided
              </span>
            </div>

            <div className="space-y-2 pl-2 border-l-2 border-[#E5E7EB]">
              {session.focus_timeline.map((seg, idx) => (
                <div
                  key={seg.id || idx}
                  className="p-3 rounded-xl bg-white border border-[#E5E7EB] space-y-1 text-xs shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold">
                      {seg.type === 'scripture' ? (
                        <>
                          <BookOpen size={14} className="text-[#FBBF24]" weight="fill" />
                          <span className="text-[#0E0E0E] text-xs">
                            {seg.reference || 'Scripture Passage'}
                          </span>
                          {seg.versionId && (
                            <span className="text-[9px] font-mono uppercase bg-[#F3F4F6] text-[#707070] px-1.5 py-0.5 rounded">
                              {seg.versionId}
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          <Sparkle size={14} className="text-rose-500" weight="fill" />
                          <span className="text-[#0E0E0E] text-xs">Reflection Prompt</span>
                        </>
                      )}
                    </div>
                    <span className="text-[10px] font-mono text-[#707070] font-semibold">
                      {seg.durationMinutes || 1} min
                    </span>
                  </div>

                  {seg.type === 'scripture' && seg.verseText && (
                    <p className="text-xs text-[#707070] italic leading-snug">
                      &ldquo;{seg.verseText}&rdquo;
                    </p>
                  )}

                  {seg.type === 'reflection' && seg.prompt && (
                    <p className="text-xs text-[#0E0E0E] italic leading-snug">
                      &ldquo;{seg.prompt}&rdquo;
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Privacy-First Reflection Sharing Toggle */}
      <div className="faith-card p-4 space-y-2 bg-[#FDF9F1] border border-[#E5E7EB]">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-xs font-bold text-[#0E0E0E]">Include personal reflection on Square</p>
            <p className="text-[10px] text-[#707070]">Default is OFF — share consistency stats only</p>
          </div>

          <input
            type="checkbox"
            checked={includeReflection}
            onChange={(e) => setIncludeReflection(e.target.checked)}
            className="w-4 h-4 rounded text-[#FBBF24] cursor-pointer"
          />
        </div>

        <div className="pt-2 border-t border-[#E5E7EB]/60 flex items-center gap-1.5 text-[10px] text-[#9095A1]">
          <Lock size={12} className="text-[#FBBF24]" />
          <span>Your personal reflection notes remain completely confidential unless toggled on.</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-3 pt-1">
        <button
          type="button"
          onClick={handleShareToSquare}
          disabled={sharing}
          className="w-full bg-[#0E0E0E] text-white py-4 px-6 rounded-2xl font-black text-sm shadow-xl hover:bg-[#262626] active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          {sharing ? (
            <>
              <CircleNotch size={16} className="animate-spin" />
              <span>Publishing Record...</span>
            </>
          ) : (
            <>
              <Globe size={18} className="text-[#FBBF24]" />
              <span>Share to Community Square</span>
            </>
          )}
        </button>

        <Link href="/" className="block">
          <button
            type="button"
            className="w-full bg-white border border-[#E5E7EB] text-[#0E0E0E] py-3.5 rounded-2xl font-bold text-xs hover:bg-[#FAF6EE] transition-all flex items-center justify-center gap-2"
          >
            <House size={16} className="text-[#707070]" />
            <span>Back to Dashboard</span>
          </button>
        </Link>
      </div>
    </div>
  )
}
