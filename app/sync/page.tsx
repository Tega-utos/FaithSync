'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Users,
  User,
  UserPlus,
  Copy,
  Check,
  Fire,
  ChatCircle,
  Clock,
  Sparkle,
  CaretRight,
  Plus,
  ShieldWarning,
  BookOpen,
  X,
  CircleNotch,
  Globe,
  Broadcast,
  Quotes,
  Church,
  Camera,
  CheckCircle,
  Lock,
  ChatDots,
} from '@phosphor-icons/react'
import { createClient } from '@/lib/supabase/client'

interface BuddyItem {
  id: string
  connectionId: string
  name: string
  initial: string
  avatarUrl: string | null
  church: string
  isOnline: boolean
  isLiveNow?: boolean
  liveDiscipline?: 'prayer' | 'study'
  liveFocusText?: string
  liveStartedAt?: string
  liveDurationMins?: number
  lastActive: string
  lastMessage: string
}

interface IncomingRequestItem {
  id: string
  senderId: string
  senderName: string
  senderInitial: string
  senderAvatar: string | null
  senderChurch: string
}

interface IncomingSquareRequest {
  id: string
  senderId: string
  senderName: string
  senderAvatar: string | null
  senderChurch: string
  createdAt: string
}

interface ActiveSquareConnection {
  id: string
  partnerId: string
  partnerName: string
  partnerAvatar: string | null
  partnerChurch: string
  createdAt: string
  acceptedAt: string
  expiresAt: string
  remainingMs: number
  lastMessage: string
  lastMessageTime: string
}

function formatRemainingCountdown(remainingMs: number): string {
  if (remainingMs <= 0) return 'Expiring now'
  const totalMins = Math.floor(remainingMs / 60000)
  const days = Math.floor(totalMins / (24 * 60))
  const hours = Math.floor((totalMins % (24 * 60)) / 60)
  const mins = totalMins % 60

  if (days > 0) {
    return `${days}d ${hours}h left`
  }
  if (hours > 0) {
    return `${hours}h ${mins}m left`
  }
  return `${Math.max(1, mins)}m left`
}

import { fetchGroups, createGroup, joinGroupByCode, GroupItem } from '@/features/groups/services/groupService'
import { normalizeCode, shareOrCopyCode } from '@/lib/utils/syncCodes'
import {
  getMyBuddies,
  searchUserBySyncCode,
  sendBuddyRequest,
  sendBuddyCodeConnect,
  approveBuddyRequest,
  deleteBuddyConnection,
  subscribeToBuddyUpdates,
} from '@/features/buddies/services/buddyService'

import { useBuddiesData } from '@/features/buddies/hooks/useBuddiesData'
import { useGroupsData } from '@/features/groups/hooks/useGroupsData'

export default function SyncPage() {
  const router = useRouter()

  const [activeTab, setActiveTab] = useState<'personal' | 'group' | 'square'>('personal')
  const [currentUser, setCurrentUser] = useState<any>(null)

  const { activeBuddies, incomingRequests: swrIncoming, isInitialLoading: isBuddiesInitialLoading, mutate: mutateBuddies } = useBuddiesData()
  const { groups: swrGroups, isInitialLoading: isGroupsInitialLoading, mutate: mutateGroups } = useGroupsData()

  // Square Activity States
  const [incomingSquareRequests, setIncomingSquareRequests] = useState<IncomingSquareRequest[]>([])
  const [activeSquareConnections, setActiveSquareConnections] = useState<ActiveSquareConnection[]>([])
  const [loadingSquareActivity, setLoadingSquareActivity] = useState(true)

  const fetchSquareConnections = async () => {
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }

      const res = await fetch('/api/square/connect', { headers, cache: 'no-store' })
      if (res.ok) {
        const json = await res.json()
        if (json.success) {
          setIncomingSquareRequests(json.incomingRequests || [])
          setActiveSquareConnections(json.activeConnections || [])
        }
      }
    } catch (err) {
      console.error('Failed to fetch square activity:', err)
    } finally {
      setLoadingSquareActivity(false)
    }
  }

  const handleAcceptSquareRequest = async (connectionId: string, partnerId: string) => {
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }

      const res = await fetch('/api/square/connect', {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'accept', connectionId }),
      })

      if (res.ok) {
        setIncomingSquareRequests((prev) => prev.filter((r) => r.id !== connectionId))
        fetchSquareConnections()
        mutateBuddies()
        router.push(`/buddy-chat/${partnerId}?type=square`)
      }
    } catch (err) {
      console.error('Failed to accept square request:', err)
    }
  }

  const handleDeclineSquareRequest = async (connectionId: string) => {
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }

      await fetch('/api/square/connect', {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'decline', connectionId }),
      })

      setIncomingSquareRequests((prev) => prev.filter((r) => r.id !== connectionId))
    } catch (err) {
      console.error('Failed to decline square request:', err)
    }
  }

  const buddies: BuddyItem[] = activeBuddies.map((c) => ({
    id: c.partnerId,
    connectionId: c.id,
    name: c.partnerName,
    initial: c.partnerInitial,
    avatarUrl: c.partnerAvatar,
    church: c.partnerChurch,
    isOnline: Boolean(c.isOnline || c.isLiveNow),
    isLiveNow: Boolean(c.isLiveNow),
    liveDiscipline: c.liveDiscipline,
    liveFocusText: c.liveFocusText,
    liveStartedAt: c.liveStartedAt,
    liveDurationMins: c.liveDurationMins,
    lastActive: c.lastActive || 'Active today',
    lastMessage: c.lastMessage || 'Let’s clock in together!',
  }))

  const incomingRequests: IncomingRequestItem[] = swrIncoming.map((c) => ({
    id: c.id,
    senderId: c.partnerId,
    senderName: c.partnerName,
    senderInitial: c.partnerInitial,
    senderAvatar: c.partnerAvatar,
    senderChurch: c.partnerChurch,
  }))

  const groups: GroupItem[] = swrGroups

  // Modals
  const [isAddBuddyOpen, setIsAddBuddyOpen] = useState(false)
  const [buddyCodeInput, setBuddyCodeInput] = useState('')
  const [buddyCodeError, setBuddyCodeError] = useState<string | null>(null)
  const [sendingBuddyRequest, setSendingBuddyRequest] = useState(false)
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false)
  const [createGroupStep, setCreateGroupStep] = useState<'form' | 'success'>('form')
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupCategory, setNewGroupCategory] = useState('Bible Study')
  const [newGroupChurch, setNewGroupChurch] = useState('')
  const [newGroupRules, setNewGroupRules] = useState('')
  const [newGroupIsPrivate, setNewGroupIsPrivate] = useState(false)
  const [newGroupAvatar, setNewGroupAvatar] = useState<string | null>(null)
  const [createdGroupId, setCreatedGroupId] = useState('')
  const [createdInviteCode, setCreatedInviteCode] = useState('')
  const [copiedInvite, setCopiedInvite] = useState(false)

  // Join Group with Code Modal
  const [isJoinGroupOpen, setIsJoinGroupOpen] = useState(false)
  const [joinCodeInput, setJoinCodeInput] = useState('')
  const [joinError, setJoinError] = useState<string | null>(null)
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    let unsubscribe: (() => void) | null = null

    async function initUserAndActivities() {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        setCurrentUser(user)

        if (user) {
          fetchSquareConnections()

          if (!unsubscribe) {
            const buddyUnsub = subscribeToBuddyUpdates(user.id, () => {
              mutateBuddies()
              mutateGroups()
              fetchSquareConnections()
            })

            const liveChannel = supabase
              .channel(`sync_live_sessions_${user.id}`)
              .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'sessions' },
                () => {
                  mutateBuddies()
                  mutateGroups()
                }
              )
              .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'buddies' },
                () => {
                  mutateBuddies()
                  fetchSquareConnections()
                }
              )
              .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'messages' },
                () => {
                  mutateBuddies()
                  mutateGroups()
                  fetchSquareConnections()
                }
              )
              .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'group_messages' },
                () => {
                  mutateBuddies()
                  mutateGroups()
                }
              )
              .subscribe()

            unsubscribe = () => {
              buddyUnsub()
              supabase.removeChannel(liveChannel)
            }
          }
        }
      } catch {}
    }

    initUserAndActivities()

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [mutateBuddies, mutateGroups])

  // Approve Request (Stage 5)
  const handleApproveRequest = async (reqId: string) => {
    if (!currentUser) return
    try {
      const res = await approveBuddyRequest(reqId, currentUser.id)
      if (res.success) {
        mutateBuddies()
      }
    } catch (err) {
      console.error('Approve error:', err)
    }
  }

  // Ignore Request
  const handleIgnoreRequest = async (reqId: string) => {
    try {
      await deleteBuddyConnection(reqId)
      mutateBuddies()
    } catch (err) {
      console.error('Ignore error:', err)
    }
  }

  const [isCreatingGroup, setIsCreatingGroup] = useState(false)
  const [createGroupError, setCreateGroupError] = useState<string | null>(null)

  // Create Group Handler (uses atomic code from backend/service)
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newGroupName.trim()) return

    setIsCreatingGroup(true)
    setCreateGroupError(null)

    try {
      const res = await createGroup({
        name: newGroupName.trim(),
        category: newGroupCategory,
        church: newGroupChurch.trim() || undefined,
        guidelines: newGroupRules.trim() || undefined,
        is_private: newGroupIsPrivate,
      })

      if (!res) {
        setCreateGroupError('Could not create group. Please check database tables or try again.')
        return
      }

      setCreatedGroupId(res.id)
      setCreatedInviteCode(res.code)

      mutateGroups()
      setCreateGroupStep('success')
    } catch (err: any) {
      console.error('Create group error:', err)
      setCreateGroupError(err?.message || 'Failed to create group.')
    } finally {
      setIsCreatingGroup(false)
    }
  }

  // Join Group with Code Handler (uses normalizeCode: trims whitespace & uppercases)
  const handleJoinWithCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!joinCodeInput.trim()) return

    setJoining(true)
    setJoinError(null)

    const res = await joinGroupByCode(joinCodeInput)
    if (res.success && res.group) {
      mutateGroups()
      setIsJoinGroupOpen(false)
      setJoinCodeInput('')
      router.push(`/group-chat/${res.group.id}`)
    } else {
      setJoinError(res.error || 'No group found matching this invite code.')
    }
    setJoining(false)
  }

  // Copy & Share Invite Code
  const handleCopyInviteCode = async () => {
    await shareOrCopyCode({
      code: createdInviteCode,
      title: `Join ${newGroupName || 'our group'} on FaithSync`,
      text: `Join our accountability group on FaithSync using code: ${createdInviteCode}`,
    })
    setCopiedInvite(true)
    setTimeout(() => setCopiedInvite(false), 2000)
  }

  return (
    <div className="command-center-container px-4 sm:px-6 pt-3 pb-28 space-y-4">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-black text-text-primary tracking-tight">
          SynC
        </h1>

        <Link
          href="/find-buddy"
          className="p-2 rounded-xl bg-card border border-border text-text-primary text-xs font-bold shadow-sm hover:border-[#FBBF24] transition-all flex items-center gap-1.5"
        >
          <UserPlus size={14} className="text-[#FBBF24]" />
          <span>Add Buddy</span>
        </Link>
      </div>

      {/* 3-Segment Toggle Navigation Bar */}
      <div className="p-1 rounded-2xl bg-card border border-border grid grid-cols-3 gap-1 shadow-2xs">
        {/* Personal Tab */}
        <button
          type="button"
          onClick={() => setActiveTab('personal')}
          className={`py-2 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'personal'
              ? 'bg-[var(--surface-dark-fixed)] text-[var(--text-on-dark-fixed)] dark:bg-neutral-800 dark:text-neutral-100 dark:border dark:border-neutral-700 shadow-sm'
              : 'text-text-secondary hover:text-text-primary hover:bg-subtle/50'
          }`}
        >
          <User size={14} className={activeTab === 'personal' ? 'text-[#FBBF24]' : 'opacity-60'} />
          <span>Personal</span>
        </button>

        {/* Group Tab */}
        <button
          type="button"
          onClick={() => setActiveTab('group')}
          className={`py-2 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'group'
              ? 'bg-[var(--surface-dark-fixed)] text-[var(--text-on-dark-fixed)] dark:bg-neutral-800 dark:text-neutral-100 dark:border dark:border-neutral-700 shadow-sm'
              : 'text-text-secondary hover:text-text-primary hover:bg-subtle/50'
          }`}
        >
          <Users size={14} className={activeTab === 'group' ? 'text-[#FBBF24]' : 'opacity-60'} />
          <span>Groups</span>
        </button>

        {/* Square Tab Shortcut */}
        <button
          type="button"
          onClick={() => router.push('/square')}
          className="py-2 px-3 rounded-xl font-bold text-xs text-text-secondary hover:text-text-primary hover:bg-subtle/50 transition-all flex items-center justify-center gap-1.5"
        >
          <Globe size={14} className="text-[#FBBF24]" />
          <span>Square</span>
        </button>
      </div>

      {/* Personal Tab */}
      {activeTab === 'personal' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Incoming Requests */}
          {incomingRequests.length > 0 && (
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">
                Incoming Requests ({incomingRequests.length})
              </span>
              <div className="space-y-2">
                {incomingRequests.map((req) => (
                  <div
                    key={req.id}
                    className="faith-card p-3.5 flex items-center justify-between gap-3 bg-[#FDF9F1] dark:bg-amber-950/30"
                  >
                    <Link
                      href={`/profile/${req.senderId}`}
                      className="flex items-center gap-3 flex-1 min-w-0 group hover:opacity-85 transition-all"
                    >
                      <div className="w-10 h-10 rounded-full bg-[#0E0E0E] dark:bg-white/90 text-white dark:text-[#0E0E0E] font-bold text-xs flex items-center justify-center shrink-0">
                        {req.senderInitial}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-text-primary group-hover:text-[#FBBF24] transition-colors truncate">
                          {req.senderName} <span className="text-[10px] font-normal text-text-secondary underline ml-1">Preview Profile</span>
                        </p>
                        <p className="text-[10px] text-text-secondary truncate">{req.senderChurch}</p>
                      </div>
                    </Link>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleApproveRequest(req.id)}
                        className="bg-[#0E0E0E] dark:bg-white/90 text-white dark:text-[#0E0E0E] py-1.5 px-3 rounded-xl font-bold text-xs shadow-sm hover:bg-[#262626] dark:hover:bg-white/80"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => handleIgnoreRequest(req.id)}
                        className="bg-card border border-border text-text-secondary py-1.5 px-2.5 rounded-xl font-bold text-xs hover:border-[#EA2C26] hover:text-[#EA2C26] dark:text-red-400"
                      >
                        Ignore
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Buddies List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">
                Active Accountability Buddies
              </span>
              <span className="text-[10px] font-mono font-bold text-text-secondary bg-surface px-2 py-0.5 rounded-md border border-border">
                {buddies.length} / 3 Active Buddies
              </span>
            </div>

            {/* Pinned Live Altar Ongoing Alert */}
            {buddies.some((b) => b.isLiveNow) && (
              <div className="p-4 rounded-2xl bg-gradient-to-r from-rose-500/10 via-amber-500/10 to-transparent border border-rose-500/30 dark:border-rose-500/20 shadow-sm space-y-3 animate-fade-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-2.5 w-2.5 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                    </span>
                    <span className="text-[11px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400">
                      Live Clock-In Ongoing
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-text-secondary bg-surface px-2 py-0.5 rounded-full border border-border">
                    Real-Time SynC Room
                  </span>
                </div>
                {buddies
                  .filter((b) => b.isLiveNow)
                  .map((liveBuddy) => (
                    <div
                      key={`live-banner-${liveBuddy.id}`}
                      className="flex items-center justify-between gap-3 bg-surface/90 dark:bg-neutral-900/80 p-3 rounded-xl border border-rose-500/20 shadow-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="relative shrink-0">
                          <div className="w-9 h-9 rounded-full bg-rose-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                            {liveBuddy.initial}
                          </div>
                          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-surface" />
                        </div>
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <p className="text-xs font-bold text-text-primary truncate">
                            {liveBuddy.name} is in Live {liveBuddy.liveDiscipline === 'study' ? 'Scripture Study' : 'Prayer'}
                          </p>
                          {liveBuddy.liveFocusText && (
                            <p className="text-[11px] text-text-secondary truncate italic">
                              &ldquo;{liveBuddy.liveFocusText}&rdquo;
                            </p>
                          )}
                        </div>
                      </div>
                      <Link
                        href={`/buddy-chat/${liveBuddy.id}?joinLive=true`}
                        className="shrink-0 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md flex items-center gap-1.5 transition-transform active:scale-95"
                      >
                        <Fire size={14} weight="fill" className="text-amber-300" />
                        <span>Join Live Altar</span>
                      </Link>
                    </div>
                  ))}
              </div>
            )}

            {isBuddiesInitialLoading ? (
              <div className="py-12 text-center text-xs text-text-secondary">Loading buddies...</div>
            ) : buddies.length === 0 ? (
              <div className="faith-card p-8 text-center flex flex-col items-center justify-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-[#FDF9F1] dark:bg-amber-950/30 text-[#FBBF24] border border-[#FBBF24]/35 flex items-center justify-center">
                  <Users size={24} />
                </div>
                <div className="space-y-1 max-w-xs">
                  <h3 className="text-xs font-bold text-text-primary">Find an accountability buddy</h3>
                  <p className="text-[11px] text-text-secondary leading-relaxed">
                    Connect with believers to encourage daily prayer and scripture study.
                  </p>
                </div>
                <Link href="/find-buddy">
                  <button
                    type="button"
                    className="bg-[#0E0E0E] dark:bg-white/90 text-white dark:text-[#0E0E0E] py-2.5 px-5 rounded-xl font-bold text-xs shadow-md hover:bg-[#262626] dark:hover:bg-white/80 transition-all flex items-center gap-1.5"
                  >
                    <UserPlus size={14} className="text-[#FBBF24]" />
                    <span>Add via Buddy Code</span>
                  </button>
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="faith-card divide-y divide-border-light overflow-hidden">
                  {buddies.map((buddy) => {
                    const isLive = Boolean(buddy.isLiveNow)

                    return (
                      <Link
                        key={buddy.id}
                        href={isLive ? `/buddy-chat/${buddy.id}?joinLive=true` : `/buddy-chat/${buddy.id}`}
                        className={`p-3.5 flex items-center justify-between transition-colors block group ${
                          isLive
                            ? 'bg-rose-500/5 dark:bg-rose-950/20 hover:bg-rose-500/10'
                            : 'hover:bg-surface'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="relative shrink-0">
                            <div
                              className={`w-10 h-10 rounded-full font-bold text-xs flex items-center justify-center shadow-xs ${
                                isLive
                                  ? 'bg-rose-600 text-white border border-rose-400'
                                  : 'bg-[#0E0E0E] dark:bg-white/90 text-white dark:text-[#0E0E0E]'
                              }`}
                            >
                              {buddy.initial}
                            </div>
                            {isLive ? (
                              <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500 border-2 border-white dark:border-neutral-900"></span>
                              </span>
                            ) : buddy.isOnline ? (
                              <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#22C55E] border-2 border-white ring-1 ring-black/5" />
                            ) : null}
                          </div>

                          <div className="space-y-0.5 min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-bold text-text-primary group-hover:text-[#FBBF24] transition-colors truncate">
                                {buddy.name}
                              </p>
                              {isLive ? (
                                <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[8.5px] font-black uppercase tracking-wider flex items-center gap-1 shrink-0 animate-pulse shadow-xs">
                                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                                  {buddy.liveDiscipline === 'study' ? 'LIVE STUDY' : 'LIVE PRAYER'}
                                </span>
                              ) : (
                                <span className="text-[9px] text-text-muted font-mono shrink-0">{buddy.lastActive}</span>
                              )}
                            </div>
                            <p
                              className={`text-[11px] truncate max-w-[200px] sm:max-w-xs ${
                                isLive
                                  ? 'font-bold text-rose-600 dark:text-rose-400'
                                  : 'text-text-secondary'
                              }`}
                            >
                              {buddy.lastMessage}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          {isLive && (
                            <span className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs flex items-center gap-1 shrink-0">
                              <Fire size={13} weight="fill" className="text-amber-300" />
                              <span>Join Altar</span>
                            </span>
                          )}
                          <CaretRight
                            size={16}
                            className="text-text-secondary group-hover:translate-x-0.5 transition-transform shrink-0"
                          />
                        </div>
                      </Link>
                    )
                  })}
                </div>

                {buddies.length < 3 ? (
                  <Link
                    href="/find-buddy"
                    className="block text-center p-2.5 rounded-xl border border-dashed border-[#FBBF24]/50 text-xs font-bold text-[#FBBF24] hover:bg-[#FDF9F1] dark:bg-amber-950/30 transition-colors"
                  >
                    + Find More Buddies ({3 - buddies.length} slots remaining)
                  </Link>
                ) : (
                  <div className="p-2.5 rounded-xl bg-surface border border-border text-center text-[11px] text-text-secondary font-medium">
                    Trinity Limit reached (3/3 active buddies).
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Square Activity Section */}
          <div className="space-y-2.5 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">
                Square Activity
              </span>
              {(incomingSquareRequests.length > 0 || activeSquareConnections.length > 0) && (
                <span className="text-[10px] font-mono font-bold text-[#234537] dark:text-emerald-400 bg-[#EBF3EE] dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-[#234537]/20 dark:border-emerald-700/30">
                  {incomingSquareRequests.length} Request{incomingSquareRequests.length === 1 ? '' : 's'} • {activeSquareConnections.length} Active 3-Day Chat{activeSquareConnections.length === 1 ? '' : 's'}
                </span>
              )}
            </div>

            {/* 1. Incoming Square Requests */}
            {incomingSquareRequests.length > 0 && (
              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 block">
                  Incoming Intercession Requests
                </span>
                <div className="space-y-2">
                  {incomingSquareRequests.map((req) => (
                    <div key={req.id} className="faith-card p-3.5 space-y-2.5 border-amber-500/30 bg-card">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="w-9 h-9 rounded-full bg-[#FBBF24] text-[#1A1610] font-bold text-xs flex items-center justify-center shrink-0">
                            {req.senderAvatar ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={req.senderAvatar} alt={req.senderName} className="w-full h-full object-cover rounded-full" />
                            ) : (
                              (req.senderName || 'B').charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-text-primary truncate">
                              {req.senderName}
                            </p>
                            <p className="text-[10px] text-text-secondary truncate">
                              {req.senderChurch} • {new Date(req.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleAcceptSquareRequest(req.id, req.senderId)}
                            className="bg-[#0E0E0E] dark:bg-white/90 text-white dark:text-[#0E0E0E] py-1.5 px-3 rounded-xl font-bold text-xs shadow-xs hover:bg-[#262626] dark:hover:bg-white/80 transition-all cursor-pointer"
                          >
                            Accept & Chat
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeclineSquareRequest(req.id)}
                            className="bg-card border border-border text-text-secondary py-1.5 px-2 rounded-xl font-bold text-xs hover:text-rose-600 hover:border-rose-300 dark:hover:text-red-400 transition-all cursor-pointer"
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 2. Active 3-Day Intercession Fellowships */}
            {activeSquareConnections.length > 0 && (
              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#234537] dark:text-emerald-400 block">
                  Active 3-Day Intercession Windows
                </span>
                <div className="faith-card divide-y divide-border-light overflow-hidden">
                  {activeSquareConnections.map((conn) => (
                    <Link
                      key={conn.id}
                      href={`/buddy-chat/${conn.partnerId}?type=square`}
                      className="p-3.5 flex items-center justify-between hover:bg-surface transition-colors block group"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-full bg-[#234537] dark:bg-emerald-900/60 text-white font-bold text-xs flex items-center justify-center shrink-0 border border-emerald-500/30">
                          {conn.partnerAvatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={conn.partnerAvatar} alt={conn.partnerName} className="w-full h-full object-cover rounded-full" />
                          ) : (
                            (conn.partnerName || 'B').charAt(0).toUpperCase()
                          )}
                        </div>

                        <div className="space-y-0.5 min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-bold text-text-primary group-hover:text-[#234537] dark:group-hover:text-emerald-400 transition-colors truncate">
                              {conn.partnerName}
                            </p>
                            <span className="px-2 py-0.5 rounded-full bg-[#EBF3EE] dark:bg-emerald-950/40 text-[#234537] dark:text-emerald-400 border border-[#234537]/20 dark:border-emerald-700/30 text-[9px] font-extrabold flex items-center gap-1 shrink-0">
                              ⏳ {formatRemainingCountdown(conn.remainingMs)}
                            </span>
                          </div>
                          <p className="text-[11px] text-text-secondary truncate max-w-[200px] sm:max-w-xs">
                            {conn.lastMessage || 'Intercession window open'}
                          </p>
                        </div>
                      </div>

                      <CaretRight size={16} className="text-text-secondary group-hover:translate-x-0.5 transition-transform shrink-0 ml-2" />
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Empty Square Activity Guidance */}
            {incomingSquareRequests.length === 0 && activeSquareConnections.length === 0 && (
              <div className="p-4 rounded-2xl bg-surface/60 border border-border text-center space-y-2">
                <p className="text-xs text-text-secondary">
                  No active Square connections.
                </p>
                <Link
                  href="/square"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#234537] dark:text-emerald-400 hover:underline"
                >
                  <Globe size={14} />
                  <span>Visit Community Square to Connect</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Group Tab */}
      {activeTab === 'group' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Group Action Buttons Bar */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => {
                setCreateGroupStep('form')
                setIsCreateGroupOpen(true)
              }}
              className="p-3.5 rounded-2xl bg-[#0E0E0E] text-white dark:bg-[#FBBF24] dark:text-[#1A1610] dark:hover:bg-[#F59E0B] flex items-center justify-center gap-2 font-bold text-xs shadow-md hover:bg-[#262626] transition-all cursor-pointer"
            >
              <Plus size={16} className="text-[#FBBF24] dark:text-[#1A1610]" weight="bold" />
              <span className="text-white dark:text-[#1A1610] font-bold">Create Group</span>
            </button>

            <button
              type="button"
              onClick={() => setIsJoinGroupOpen(true)}
              className="p-3.5 rounded-2xl bg-card border border-border text-text-primary flex items-center justify-center gap-2 font-bold text-xs shadow-sm hover:border-[#FBBF24] hover:bg-surface transition-all cursor-pointer"
            >
              <Users size={16} className="text-[#FBBF24]" />
              <span>Join with Code</span>
            </button>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">
              My Groups ({groups.length})
            </span>
          </div>

          <div className="space-y-3">
            {groups.length === 0 ? (
              <div className="faith-card p-6 text-center space-y-2.5 bg-surface border border-border">
                <div className="w-10 h-10 rounded-full bg-[#FDF9F1] dark:bg-amber-950/30 text-[#FBBF24] flex items-center justify-center mx-auto">
                  <Users size={20} />
                </div>
                <p className="text-xs font-bold text-text-primary">No groups joined yet</p>
                <p className="text-[11px] text-text-secondary max-w-xs mx-auto">
                  Start an accountability circle for your Bible study, youth group, or ministry!
                </p>
              </div>
            ) : (
              groups.map((group) => (
                <Link
                  key={group.id}
                  href={`/group-chat/${group.id}`}
                  className="faith-card p-4 block hover:border-[#FBBF24]/50 transition-colors group"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-text-primary group-hover:text-[#FBBF24] transition-colors">
                          {group.name}
                        </h3>
                        {group.isLive && (
                          <span className="px-1.5 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-[9px] font-extrabold flex items-center gap-1 animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                            LIVE NOW
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-text-secondary">
                        {group.category} • {group.church}
                      </p>
                      {group.isLive && (
                        <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5 pt-0.5 animate-pulse">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                          <span>Live Clock-In Ongoing • Tap to join!</span>
                        </p>
                      )}
                    </div>

                    <span className="text-[10px] font-mono font-bold text-[#FBBF24] bg-[#FDF9F1] dark:bg-amber-950/30 px-2 py-0.5 rounded-md border border-[#FBBF24]/35">
                      {group.code || 'SYNC GROUP'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-3 mt-2 border-t border-border-light">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-[#0E0E0E] text-[#FBBF24] text-[10px] font-black flex items-center justify-center border border-white shadow-xs">
                        {group.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-[10px] text-text-secondary font-medium">
                        {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}
                      </span>
                    </div>

                    <CaretRight size={16} className="text-text-secondary group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      )}

      {/* Modal 1: Add Buddy by Code */}
      {isAddBuddyOpen && (
        <div role="dialog" aria-modal="true" data-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-sm bg-surface border border-border rounded-3xl p-5 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-text-primary">Add Partner by Code</h3>
              <button onClick={() => setIsAddBuddyOpen(false)} className="text-text-secondary">
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault()
                if (!buddyCodeInput.trim()) return
                if (!currentUser) {
                  router.push('/login')
                  return
                }

                setSendingBuddyRequest(true)
                setBuddyCodeError(null)

                try {
                  const res = await sendBuddyCodeConnect(buddyCodeInput)
                  if (!res.success) {
                    setBuddyCodeError(res.error || 'Failed to send buddy request.')
                    return
                  }

                  setIsAddBuddyOpen(false)
                  setBuddyCodeInput('')
                  // Reload list
                  const { active, pendingIncoming } = await getMyBuddies(currentUser.id)
                  setIncomingRequests(
                    pendingIncoming.map((c) => ({
                      id: c.id,
                      senderId: c.partnerId,
                      senderName: c.partnerName,
                      senderInitial: c.partnerInitial,
                      senderAvatar: c.partnerAvatar,
                      senderChurch: c.partnerChurch,
                    }))
                  )
                  setBuddies(
                    active.map((c) => ({
                      id: c.partnerId,
                      connectionId: c.id,
                      name: c.partnerName,
                      initial: c.partnerInitial,
                      avatarUrl: c.partnerAvatar,
                      church: c.partnerChurch,
                      isOnline: false,
                      lastActive: 'Active today',
                      lastMessage: 'Let’s clock in together!',
                    }))
                  )
                } catch (err: any) {
                  console.error('Add buddy error:', err)
                  setBuddyCodeError(err?.message || 'Unable to complete request. Please try again.')
                } finally {
                  setSendingBuddyRequest(false)
                }
              }}
              className="space-y-3"
            >
              <p className="text-xs text-text-secondary">
                Enter your friend’s unique 6-character Buddy Code (e.g. SYNC26) to send an invite.
              </p>

              {buddyCodeError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-medium">
                  {buddyCodeError}
                </div>
              )}

              <input
                type="text"
                required
                maxLength={8}
                value={buddyCodeInput}
                onChange={(e) => {
                  setBuddyCodeInput(e.target.value.toUpperCase())
                  setBuddyCodeError(null)
                }}
                placeholder="e.g. SYNC26"
                className="w-full px-4 py-3 bg-card border border-border rounded-xl text-center font-mono font-black text-sm uppercase tracking-widest text-text-primary focus:outline-none focus:border-[#FBBF24] shadow-sm"
              />

              <button
                type="submit"
                disabled={!buddyCodeInput.trim() || sendingBuddyRequest}
                className="w-full bg-[#0E0E0E] dark:bg-neutral-800 border border-transparent dark:border-white/15 text-white py-3 rounded-xl font-bold text-xs shadow-md hover:bg-[#262626] dark:hover:bg-neutral-700 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {sendingBuddyRequest ? (
                  <>
                    <CircleNotch size={16} className="animate-spin" />
                    Connecting...
                  </>
                ) : (
                  'Send Buddy Request'
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Create Group Modal */}
      {isCreateGroupOpen && (
        <div role="dialog" aria-modal="true" data-modal="true" className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="fixed inset-0" onClick={() => setIsCreateGroupOpen(false)} />

          <div className="relative z-10 w-full max-w-md bg-surface border border-border rounded-3xl shadow-2xl p-5 sm:p-6 space-y-4 animate-in zoom-in-95 duration-200 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h3 className="text-sm font-black text-text-primary">
                {createGroupStep === 'form' ? 'Create New Group' : 'Group Created! 🎉'}
              </h3>
              <button onClick={() => setIsCreateGroupOpen(false)} className="text-text-secondary hover:text-text-primary">
                <X size={20} />
              </button>
            </div>

            {createGroupStep === 'form' ? (
              <form onSubmit={handleCreateGroup} className="space-y-4 pt-1">
                {createGroupError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-semibold">
                    {createGroupError}
                  </div>
                )}

                {/* 1. Group Profile Picture Upload */}
                <div className="flex flex-col items-center justify-center space-y-2 py-1">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full bg-[#0E0E0E] text-[#FBBF24] font-black text-lg flex items-center justify-center border-2 border-[#FBBF24]/50 shadow-md">
                      {newGroupName.trim() ? newGroupName.charAt(0).toUpperCase() : 'FS'}
                    </div>
                    <label
                      htmlFor="group-avatar-input"
                      className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#FBBF24] text-text-primary flex items-center justify-center cursor-pointer shadow-md hover:scale-110 transition-transform"
                      title="Upload group picture"
                    >
                      <Camera size={13} weight="bold" />
                    </label>
                    <input
                      id="group-avatar-input"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={() => alert('Profile picture selected from camera roll!')}
                    />
                  </div>
                  <span className="text-[10px] text-text-secondary font-medium">Group Profile Picture</span>
                </div>

                {/* 2. Group Name */}
                <div>
                  <label className="text-[11px] font-bold text-text-secondary block mb-1">Group Name</label>
                  <input
                    type="text"
                    required
                    value={newGroupName}
                    onChange={(e) => {
                      setNewGroupName(e.target.value)
                      setCreateGroupError(null)
                    }}
                    placeholder="e.g. Friday Morning Bible Study"
                    className="w-full px-3.5 py-2.5 bg-card border border-border rounded-xl text-xs font-bold text-text-primary focus:outline-none focus:border-[#FBBF24] shadow-xs"
                  />
                </div>

                {/* 3. Category & Local Assembly */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-text-secondary block mb-1">Category</label>
                    <select
                      value={newGroupCategory}
                      onChange={(e) => setNewGroupCategory(e.target.value)}
                      className="w-full px-3 py-2.5 bg-card border border-border rounded-xl text-xs font-bold text-text-primary focus:outline-none focus:border-[#FBBF24] shadow-xs cursor-pointer"
                    >
                      <option value="Youth">Youth</option>
                      <option value="Men's Ministry">Men&apos;s Ministry</option>
                      <option value="Women's Ministry">Women&apos;s Ministry</option>
                      <option value="Young Adults">Young Adults</option>
                      <option value="Bible Study">Bible Study</option>
                      <option value="Prayer Circle">Prayer Circle</option>
                      <option value="General Fellowship">General Fellowship</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-text-secondary block mb-1">Local Assembly</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={newGroupChurch}
                        onChange={(e) => setNewGroupChurch(e.target.value)}
                        placeholder="e.g. Elevation Church"
                        className="w-full pl-8 pr-3 py-2.5 bg-card border border-border rounded-xl text-xs text-text-primary focus:outline-none focus:border-[#FBBF24] shadow-xs"
                      />
                      <Church size={14} className="absolute left-2.5 top-3 text-text-muted" />
                    </div>
                  </div>
                </div>

                {/* 4. Group Guidelines (Ethos) */}
                <div>
                  <label className="text-[11px] font-bold text-text-secondary block mb-1">
                    Group Guidelines (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={newGroupRules}
                    onChange={(e) => setNewGroupRules(e.target.value)}
                    placeholder="Keep conversations uplifting. Clock in at least once a week."
                    className="w-full px-3.5 py-2 bg-card border border-border rounded-xl text-xs text-text-primary focus:outline-none focus:border-[#FBBF24] resize-none shadow-xs"
                  />
                </div>

                {/* 5. Private Group Toggle */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-card border border-border shadow-xs">
                  <div className="space-y-0.5 max-w-[80%]">
                    <div className="flex items-center gap-1.5">
                      <Lock size={14} className="text-[#FBBF24]" />
                      <p className="text-xs font-bold text-text-primary">Private Group</p>
                    </div>
                    <p className="text-[10px] text-text-secondary leading-tight">
                      Hidden from public directory. Strictly invite-only.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setNewGroupIsPrivate((p) => !p)}
                    className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                      newGroupIsPrivate ? 'bg-[#0E0E0E] dark:bg-amber-400' : 'bg-gray-300 dark:bg-neutral-700'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-card transition-transform ${
                        newGroupIsPrivate ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Submit: Gold Create Group Button */}
                <button
                  type="submit"
                  disabled={!newGroupName.trim() || isCreatingGroup}
                  className="w-full bg-[#0E0E0E] text-white dark:bg-[#FBBF24] dark:text-[#0E0E0E] dark:hover:bg-[#F59E0B] py-3.5 rounded-2xl font-bold text-xs shadow-md hover:bg-[#262626] transition-all disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isCreatingGroup ? (
                    <>
                      <CircleNotch size={16} className="animate-spin text-[#FBBF24] dark:text-[#0E0E0E]" />
                      <span>Creating Group...</span>
                    </>
                  ) : (
                    <span>Create Group</span>
                  )}
                </button>
              </form>
            ) : (
              /* Success Screen */
              <div className="py-4 text-center space-y-4 animate-in zoom-in-95">
                {/* Large Green Checkmark */}
                <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto shadow-sm">
                  <CheckCircle size={38} weight="fill" />
                </div>

                <div className="space-y-1">
                  <h4 className="text-base font-black text-text-primary">{newGroupName}</h4>
                  <p className="text-xs text-text-secondary max-w-xs mx-auto">
                    Your group is live! Share this unique Invite Code with members to join:
                  </p>
                </div>

                {/* Massive Spaced-out Code in Dashed Box */}
                <div
                  onClick={handleCopyInviteCode}
                  className="p-5 rounded-3xl bg-card border-2 border-dashed border-[#FBBF24] cursor-pointer hover:bg-[#FDF9F1] dark:bg-amber-950/30 transition-all group shadow-sm"
                >
                  <p className="text-2xl sm:text-3xl font-black font-mono tracking-[0.35em] text-text-primary">
                    {createdInviteCode.split('').join(' ')}
                  </p>
                  <p className="text-[10px] text-[#FBBF24] font-bold mt-2 flex items-center justify-center gap-1">
                    {copiedInvite ? (
                      <>
                        <Check size={14} weight="bold" className="text-emerald-600" />
                        <span className="text-emerald-600 font-black">Copied to Clipboard! ✓</span>
                      </>
                    ) : (
                      <>
                        <Copy size={14} />
                        <span className="group-hover:underline">Tap to Copy Code</span>
                      </>
                    )}
                  </p>
                </div>

                {/* Direct Action Buttons */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreateGroupOpen(false)
                      router.push(`/group-info/${createdGroupId || 'new'}`)
                    }}
                    className="py-3 px-3 rounded-2xl bg-card border border-border text-xs font-bold text-text-primary hover:bg-surface transition-colors"
                  >
                    View Group Info
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreateGroupOpen(false)
                      router.push(`/group-chat/${createdGroupId || 'new'}`)
                    }}
                    className="py-3 px-3 rounded-2xl bg-[#0E0E0E] dark:bg-white/90 text-white dark:text-[#0E0E0E] text-xs font-bold hover:bg-[#262626] dark:hover:bg-white/80 transition-colors shadow-sm"
                  >
                    Open Group Chat
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal 3: Join with Code Modal */}
      {isJoinGroupOpen && (
        <div role="dialog" aria-modal="true" data-modal="true" className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="fixed inset-0" onClick={() => setIsJoinGroupOpen(false)} />
          <div className="relative z-10 w-full max-w-sm bg-surface border border-border rounded-3xl p-5 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-text-primary">Join Group with Code</h3>
              <button onClick={() => setIsJoinGroupOpen(false)} className="text-text-secondary">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleJoinWithCode} className="space-y-3">
              <p className="text-xs text-text-secondary">
                Enter the invite code provided by your group leader.
              </p>

              {joinError && (
                <p className="text-[11px] font-bold text-rose-600 bg-rose-50 dark:bg-red-950/30 p-2.5 rounded-xl border border-rose-200">
                  {joinError}
                </p>
              )}

              <input
                type="text"
                required
                maxLength={12}
                value={joinCodeInput}
                onChange={(e) => setJoinCodeInput(e.target.value)}
                placeholder="SYNC-XXXXXX"
                className="w-full px-4 py-3 bg-card border border-border rounded-xl text-center font-mono font-black text-sm uppercase tracking-widest text-text-primary focus:outline-none focus:border-[#FBBF24] shadow-sm"
              />

              <button
                type="submit"
                disabled={!joinCodeInput.trim() || joining}
                className="w-full bg-[#0E0E0E] dark:bg-white/90 text-white dark:text-[#0E0E0E] py-3 rounded-xl font-bold text-xs shadow-md hover:bg-[#262626] dark:hover:bg-white/80 transition-all disabled:opacity-40 cursor-pointer"
              >
                {joining ? 'Joining Group...' : 'Join Group'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
