'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  CaretLeft,
  Users,
  UserPlus,
  Fire,
  Check,
  CheckCircle,
  Circle,
  ChatCircle,
  Sparkle,
  CircleNotch,
  X,
  Lightning,
  HandsPraying,
  HandWaving,
  BookOpen,
} from '@phosphor-icons/react'
import { createClient } from '@/lib/supabase/client'

interface ExpandedBuddy {
  id: string
  connectionId: string
  name: string
  initial: string
  avatarUrl: string | null
  church: string
  liveStatus: string
  isActiveNow: boolean
  streakCount: number
  prayerDone: boolean
  studyDone: boolean
}

interface IncomingRequest {
  id: string
  senderId: string
  name: string
  initial: string
  church: string
}

export default function AccountabilityPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [buddies, setBuddies] = useState<ExpandedBuddy[]>([])
  const [pendingRequests, setPendingRequests] = useState<IncomingRequest[]>([])
  const [nudgedState, setNudgedState] = useState<Record<string, boolean>>({})

  useEffect(() => {
    async function loadAccountabilityHub() {
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          setLoading(false)
          return
        }

        // 1. Fetch Connections
        const { data: connections, error: connErr } = await supabase
          .from('buddies')
          .select(`
            id,
            status,
            user_id,
            buddy_id,
            user_profile:profiles!buddies_user_id_fkey(display_name, avatar_url),
            buddy_profile:profiles!buddies_buddy_id_fkey(display_name, avatar_url)
          `)
          .or(`user_id.eq.${user.id},buddy_id.eq.${user.id}`)

        if (connErr) {
          console.error('Error fetching accountability connections:', connErr)
        }

        const pending: IncomingRequest[] = []
        const active: ExpandedBuddy[] = []

        ;(connections || []).forEach((c: any) => {
          if (c.status === 'pending') {
            if (c.buddy_id === user.id) {
              const name = c.user_profile?.display_name || 'A Believer'
              pending.push({
                id: c.id,
                senderId: c.user_id,
                name,
                initial: name.charAt(0).toUpperCase(),
                church: c.user_profile?.church || 'Local Assembly',
              })
            }
          } else if (c.status === 'accepted') {
            const isUserSender = c.user_id === user.id
            const partner = isUserSender ? c.buddy_profile : c.user_profile
            const pId = isUserSender ? c.buddy_id : c.user_id
            const pName = partner?.display_name || 'Accountability Buddy'

            active.push({
              id: pId,
              connectionId: c.id,
              name: pName,
              initial: pName.charAt(0).toUpperCase(),
              avatarUrl: partner?.avatar_url || null,
              church: partner?.church || 'Grace Assembly',
              liveStatus: 'Active now',
              isActiveNow: true,
              streakCount: 14,
              prayerDone: false,
              studyDone: false,
            })
          }
        })

        // Fetch Real Sessions for today
        const buddyIds = active.map((b) => b.id)
        if (buddyIds.length > 0) {
          const startOfToday = new Date()
          startOfToday.setHours(0, 0, 0, 0)

          const { data: buddySessions } = await supabase
            .from('sessions')
            .select('user_id, type, duration_seconds')
            .in('user_id', buddyIds)
            .gte('started_at', startOfToday.toISOString())

          const buddyMins: Record<string, { prayer: number; study: number }> = {}
          ;(buddySessions || []).forEach((s) => {
            if (!buddyMins[s.user_id]) buddyMins[s.user_id] = { prayer: 0, study: 0 }
            const mins = Math.floor(s.duration_seconds / 60)
            if (s.type === 'prayer') buddyMins[s.user_id].prayer += mins
            if (s.type === 'study' || s.type === 'word') buddyMins[s.user_id].study += mins
          })

          active.forEach((b) => {
            const bp = buddyMins[b.id]?.prayer || 0
            const bs = buddyMins[b.id]?.study || 0
            b.prayerDone = bp >= 15
            b.studyDone = bs >= 15
            b.isActiveNow = bp > 0 || bs > 0
            b.liveStatus = b.isActiveNow ? 'Active now' : 'Seen today'
          })
        }

        setPendingRequests(pending)
        setBuddies(active)
      } catch (err) {
        console.error('Accountability hub error:', err)
      } finally {
        setLoading(false)
      }
    }

    loadAccountabilityHub()
  }, [])

  // Approve & Ignore Handlers
  const handleApprove = async (reqId: string) => {
    try {
      const supabase = createClient()
      await supabase.from('buddies').update({ status: 'accepted' }).eq('id', reqId)
      setPendingRequests((prev) => prev.filter((r) => r.id !== reqId))
    } catch {}
  }

  const handleIgnore = async (reqId: string) => {
    try {
      const supabase = createClient()
      await supabase.from('buddies').delete().eq('id', reqId)
      setPendingRequests((prev) => prev.filter((r) => r.id !== reqId))
    } catch {}
  }

  // Nudge Buddy Handler
  const handleNudge = async (buddy: ExpandedBuddy) => {
    setNudgedState((prev) => ({ ...prev, [buddy.id]: true }))

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
      setNudgedState((prev) => ({ ...prev, [buddy.id]: false }))
    }, 3000)
  }

  return (
    <div className="command-center-container px-4 sm:px-6 pt-3 pb-28 min-h-[92vh] space-y-5">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-2 border-b border-[#E5E7EB]">
        <button
          type="button"
          onClick={() => router.push('/')}
          className="p-2 rounded-xl text-[#707070] hover:text-[#0E0E0E] hover:bg-[#F3F4F6]/50 transition-colors flex items-center gap-1.5 text-xs font-bold"
        >
          <CaretLeft size={18} />
          <span>Home</span>
        </button>

        <h1 className="text-sm font-extrabold text-[#0E0E0E]">Accountability</h1>

        <Link
          href="/find-buddy"
          className="p-1.5 rounded-xl text-[#FBBF24] hover:text-[#0E0E0E] transition-colors"
          title="Find New Buddies"
        >
          <UserPlus size={18} />
        </Link>
      </div>

      <div className="space-y-1">
        <h2 className="text-xl font-black text-[#0E0E0E] tracking-tight">Buddies Hub</h2>
        <p className="text-xs text-[#707070] leading-relaxed">
          Monitor your buddy&apos;s daily spiritual momentum, send encouragement nudges, and clock in together.
        </p>
      </div>

      {/* Top-Anchored Incoming Requests */}
      {pendingRequests.length > 0 && (
        <div className="space-y-2.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#707070] block">
            Incoming Requests ({pendingRequests.length})
          </span>
          <div className="space-y-2">
            {pendingRequests.map((req) => (
              <div
                key={req.id}
                className="faith-card p-3.5 flex items-center justify-between gap-3 bg-[#FDF9F1]"
              >
                <Link
                  href={`/profile/${req.senderId}`}
                  className="flex items-center gap-3 flex-1 min-w-0 group hover:opacity-85 transition-all"
                >
                  <div className="w-9 h-9 rounded-full bg-[#0E0E0E] text-white font-bold text-xs flex items-center justify-center shrink-0">
                    {req.initial}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-[#0E0E0E] group-hover:text-[#FBBF24] transition-colors truncate">
                      {req.name} <span className="text-[10px] font-normal text-[#707070] underline ml-1">Preview</span>
                    </p>
                    <p className="text-[10px] text-[#707070] truncate">{req.church}</p>
                  </div>
                </Link>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleApprove(req.id)}
                    className="bg-[#0E0E0E] text-white py-1.5 px-3 rounded-xl font-bold text-xs shadow-sm hover:bg-[#262626]"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => handleIgnore(req.id)}
                    className="bg-white border border-[#E5E7EB] text-[#707070] py-1.5 px-2.5 rounded-xl font-bold text-xs hover:text-[#EA2C26]"
                  >
                    Ignore
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SCENARIO A vs SCENARIO B */}
      {loading ? (
        <div className="py-20 text-center text-xs text-[#707070]">
          Loading accountability buddies...
        </div>
      ) : buddies.length === 0 ? (
        /* Scenario A: No Buddies */
        <div className="faith-card p-8 sm:p-10 text-center flex flex-col items-center justify-center space-y-4 my-6 animate-in zoom-in-95">
          <div className="w-20 h-20 rounded-full bg-[#FAF6EE] border-2 border-dashed border-[#FBBF24]/50 text-[#9095A1] flex items-center justify-center shadow-inner">
            <UserPlus size={36} className="text-[#FBBF24]" />
          </div>

          <div className="space-y-1.5 max-w-sm">
            <h2 className="text-base font-black text-[#0E0E0E] tracking-tight">
              No buddies yet.
            </h2>
            <p className="text-xs text-[#707070] leading-relaxed">
              Accountability makes consistency easier. Find a buddy to share your journey with.
            </p>
          </div>

          <Link href="/find-buddy" className="w-full max-w-xs">
            <button
              type="button"
              className="w-full bg-[#0E0E0E] text-white py-3.5 px-6 rounded-2xl font-bold text-xs shadow-md hover:bg-[#262626] active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <UserPlus size={16} className="text-[#FBBF24]" />
              <span>Find Your Buddy</span>
            </button>
          </Link>
        </div>
      ) : (
        /* Scenario B: Has Buddies */
        <div className="space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#707070]">
              Active Accountability Buddies ({buddies.length})
            </span>
            <Link
              href="/find-buddy"
              className="text-xs font-bold text-[#FBBF24] hover:underline"
            >
              + Find More
            </Link>
          </div>

          <div className="space-y-3.5">
            {buddies.map((buddy) => {
              const isNudged = nudgedState[buddy.id]

              return (
                <div
                  key={buddy.id}
                  className="faith-card p-4 sm:p-5 space-y-4 hover:border-[#FBBF24]/40 transition-colors"
                >
                  {/* Top Row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-12 h-12 rounded-full bg-[#0E0E0E] text-white font-black text-sm flex items-center justify-center shadow-sm">
                          {buddy.initial}
                        </div>
                        {buddy.isActiveNow && (
                          <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-[#22C55E] rounded-full border-2 border-white" />
                        )}
                      </div>

                      <div className="space-y-0.5">
                        <h3 className="text-sm font-bold text-[#0E0E0E]">{buddy.name}</h3>
                        <p className="text-[11px] text-[#707070]">
                          {buddy.liveStatus} • {buddy.church}
                        </p>
                      </div>
                    </div>

                    <div className="px-2.5 py-1 rounded-full bg-[#EBF3EE] border border-[#234537]/25 flex items-center gap-1 shadow-2xs">
                      <Fire size={14} weight="fill" className="text-[#234537]" />
                      <span className="text-xs font-mono font-bold text-[#234537]">
                        {buddy.streakCount} days
                      </span>
                    </div>
                  </div>

                  {/* Daily Checklist */}
                  <div className="p-3 rounded-2xl bg-[#FAF6EE] border border-[#E5E7EB] space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#707070] block">
                      Today&apos;s Checklist
                    </span>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 rounded-xl bg-white border border-[#E5E7EB] flex items-center justify-between">
                        <span className="font-bold text-[#0E0E0E] flex items-center gap-1.5">
                          <HandsPraying size={14} weight="fill" className="text-[#FBBF24]" />
                          <span>Prayer</span>
                        </span>
                        {buddy.prayerDone ? (
                          <span className="flex items-center gap-1 text-emerald-700 font-bold text-[11px]">
                            <CheckCircle size={14} weight="fill" className="text-emerald-600" />
                            <span>Done</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[#9095A1] font-medium text-[11px]">
                            <Circle size={14} className="text-[#9095A1]" />
                            <span>Pending</span>
                          </span>
                        )}
                      </div>

                      <div className="p-2 rounded-xl bg-white border border-[#E5E7EB] flex items-center justify-between">
                        <span className="font-bold text-[#0E0E0E] flex items-center gap-1.5">
                          <BookOpen size={14} className="text-[#FBBF24]" />
                          <span>Study</span>
                        </span>
                        {buddy.studyDone ? (
                          <span className="flex items-center gap-1 text-emerald-700 font-bold text-[11px]">
                            <CheckCircle size={14} weight="fill" className="text-emerald-600" />
                            <span>Done</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[#9095A1] font-medium text-[11px]">
                            <Circle size={14} className="text-[#9095A1]" />
                            <span>Pending</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => handleNudge(buddy)}
                      disabled={isNudged}
                      className={`py-2.5 px-4 rounded-xl font-bold text-xs border transition-all flex items-center justify-center gap-1.5 ${
                        isNudged
                          ? 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30'
                          : 'bg-[#F3F4F6] text-[#262626] border-[#DCD6C8] hover:bg-[#E5E7EB]'
                      }`}
                    >
                      {isNudged ? (
                        <>
                          <Check size={14} weight="bold" />
                          <span>Nudged!</span>
                        </>
                      ) : (
                        <>
                          <HandWaving size={14} weight="fill" className="text-[#FBBF24]" />
                          <span>Nudge</span>
                        </>
                      )}
                    </button>

                    <Link href={`/buddy-chat/${buddy.id}`} className="block">
                      <button
                        type="button"
                        className="w-full bg-[#0E0E0E] text-white py-2.5 px-4 rounded-xl font-bold text-xs shadow-md hover:bg-[#262626] transition-all flex items-center justify-center gap-1.5"
                      >
                        <ChatCircle size={14} className="text-[#FBBF24]" />
                        <span>SynC</span>
                      </button>
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
