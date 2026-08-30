'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Users,
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

interface SquareActivityItem {
  id: string
  type: 'outgoing' | 'incoming'
  targetName: string
  targetInitial: string
  timeAgo: string
  introMessage: string | null
}

import { fetchGroups, createGroup, joinGroupByCode, GroupItem } from '@/features/groups/services/groupService'
import { normalizeCode, shareOrCopyCode } from '@/lib/utils/syncCodes'
import {
  getMyBuddies,
  searchUserBySyncCode,
  sendBuddyRequest,
  approveBuddyRequest,
  deleteBuddyConnection,
  subscribeToBuddyUpdates,
} from '@/features/buddies/services/buddyService'

export default function SyncPage() {
  const router = useRouter()

  const [activeTab, setActiveTab] = useState<'personal' | 'group' | 'square'>('personal')
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)

  // Personal Tab States
  const [buddies, setBuddies] = useState<BuddyItem[]>([])
  const [incomingRequests, setIncomingRequests] = useState<IncomingRequestItem[]>([])
  const [squareActivities, setSquareActivities] = useState<SquareActivityItem[]>([])

  // Group Tab States
  const [groups, setGroups] = useState<GroupItem[]>([])

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

    async function loadSyncData() {
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        setCurrentUser(user)

        if (!user) {
          setLoading(false)
          return
        }

        // Fetch Real Groups
        const realGroups = await fetchGroups()
        setGroups(realGroups)

        // Fetch Buddy Connections via robust service
        const { active, pendingIncoming } = await getMyBuddies(user.id)

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

        if (!unsubscribe) {
          unsubscribe = subscribeToBuddyUpdates(user.id, () => {
            loadSyncData()
          })
        }
      } catch (err) {
        console.error('Sync load error:', err)
      } finally {
        setLoading(false)
      }
    }

    loadSyncData()

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [])

  // Approve Request (Stage 5)
  const handleApproveRequest = async (reqId: string) => {
    if (!currentUser) return
    try {
      const res = await approveBuddyRequest(reqId, currentUser.id)
      if (res.success) {
        setIncomingRequests((prev) => prev.filter((r) => r.id !== reqId))
        const { active } = await getMyBuddies(currentUser.id)
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
      }
    } catch (err) {
      console.error('Approve error:', err)
    }
  }

  // Ignore Request
  const handleIgnoreRequest = async (reqId: string) => {
    try {
      await deleteBuddyConnection(reqId)
      setIncomingRequests((prev) => prev.filter((r) => r.id !== reqId))
    } catch (err) {
      console.error('Ignore error:', err)
    }
  }

  // Create Group Handler (uses atomic code from backend/service)
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newGroupName.trim()) return

    const res = await createGroup({
      name: newGroupName.trim(),
      category: newGroupCategory,
      church: newGroupChurch.trim() || undefined,
      guidelines: newGroupRules.trim() || undefined,
      is_private: newGroupIsPrivate,
    })

    if (!res) return

    setCreatedGroupId(res.id)
    setCreatedInviteCode(res.code)

    const updatedGroups = await fetchGroups()
    setGroups(updatedGroups)
    setCreateGroupStep('success')
  }

  // Join Group with Code Handler (uses normalizeCode: trims whitespace & uppercases)
  const handleJoinWithCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!joinCodeInput.trim()) return

    setJoining(true)
    setJoinError(null)

    const res = await joinGroupByCode(joinCodeInput)
    if (res.success && res.group) {
      const updatedGroups = await fetchGroups()
      setGroups(updatedGroups)
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
        <h1 className="text-xl sm:text-2xl font-black text-[#0E0E0E] tracking-tight">
          SynC
        </h1>

        <Link
          href="/find-buddy"
          className="p-2 rounded-xl bg-white border border-[#E5E7EB] text-[#0E0E0E] text-xs font-bold shadow-sm hover:border-[#FBBF24] transition-all flex items-center gap-1.5"
        >
          <UserPlus size={14} className="text-[#FBBF24]" />
          <span>Add Buddy</span>
        </Link>
      </div>

      {/* 3-Segment Toggle Navigation Bar */}
      <div className="p-1 rounded-2xl bg-[#F3F4F6]/60 border border-[#E5E7EB] grid grid-cols-3 gap-1">
        {/* Personal Tab */}
        <button
          type="button"
          onClick={() => setActiveTab('personal')}
          className={`py-2 px-3 rounded-xl font-bold text-xs transition-all ${
            activeTab === 'personal'
              ? 'bg-[#0E0E0E] text-white shadow-md'
              : 'text-[#707070] hover:text-[#0E0E0E]'
          }`}
        >
          Personal
        </button>

        {/* Group Tab */}
        <button
          type="button"
          onClick={() => setActiveTab('group')}
          className={`py-2 px-3 rounded-xl font-bold text-xs transition-all ${
            activeTab === 'group'
              ? 'bg-[#0E0E0E] text-white shadow-md'
              : 'text-[#707070] hover:text-[#0E0E0E]'
          }`}
        >
          Groups
        </button>

        {/* Square Tab Shortcut */}
        <button
          type="button"
          onClick={() => router.push('/square')}
          className="py-2 px-3 rounded-xl font-bold text-xs text-[#707070] hover:text-[#0E0E0E] transition-all flex items-center justify-center gap-1"
        >
          <span>Square</span>
          <Globe size={12} className="text-[#FBBF24]" />
        </button>
      </div>

      {/* Personal Tab */}
      {activeTab === 'personal' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Incoming Requests */}
          {incomingRequests.length > 0 && (
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#707070]">
                Incoming Requests ({incomingRequests.length})
              </span>
              <div className="space-y-2">
                {incomingRequests.map((req) => (
                  <div
                    key={req.id}
                    className="faith-card p-3.5 flex items-center justify-between gap-3 bg-[#FDF9F1]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#0E0E0E] text-white font-bold text-xs flex items-center justify-center">
                        {req.senderInitial}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#0E0E0E]">{req.senderName}</p>
                        <p className="text-[10px] text-[#707070]">{req.senderChurch}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleApproveRequest(req.id)}
                        className="bg-[#0E0E0E] text-white py-1.5 px-3 rounded-xl font-bold text-xs shadow-sm hover:bg-[#262626]"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => handleIgnoreRequest(req.id)}
                        className="bg-white border border-[#E5E7EB] text-[#707070] py-1.5 px-2.5 rounded-xl font-bold text-xs hover:border-[#EA2C26] hover:text-[#EA2C26]"
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
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#707070]">
                Active Accountability Buddies
              </span>
              <span className="text-[10px] font-mono text-[#707070]">{buddies.length} Buddies</span>
            </div>

            {loading ? (
              <div className="py-12 text-center text-xs text-[#707070]">Loading buddies...</div>
            ) : buddies.length === 0 ? (
              <div className="faith-card p-8 text-center flex flex-col items-center justify-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-[#FDF9F1] text-[#FBBF24] border border-[#FBBF24]/35 flex items-center justify-center">
                  <Users size={24} />
                </div>
                <div className="space-y-1 max-w-xs">
                  <h3 className="text-xs font-bold text-[#0E0E0E]">Find an accountability buddy</h3>
                  <p className="text-[11px] text-[#707070] leading-relaxed">
                    Connect with believers to encourage daily prayer and scripture study.
                  </p>
                </div>
                <Link href="/find-buddy">
                  <button
                    type="button"
                    className="bg-[#0E0E0E] text-white py-2.5 px-5 rounded-xl font-bold text-xs shadow-md hover:bg-[#262626] transition-all flex items-center gap-1.5"
                  >
                    <UserPlus size={14} className="text-[#FBBF24]" />
                    <span>Add via Buddy Code</span>
                  </button>
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="faith-card divide-y divide-[#F3F4F6] overflow-hidden">
                  {buddies.map((buddy) => (
                    <Link
                      key={buddy.id}
                      href={`/buddy-chat/${buddy.id}`}
                      className="p-3.5 flex items-center justify-between hover:bg-[#FAF6EE] transition-colors block group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-10 h-10 rounded-full bg-[#0E0E0E] text-white font-bold text-xs flex items-center justify-center">
                            {buddy.initial}
                          </div>
                          {buddy.isOnline && (
                            <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#22C55E] border-2 border-white ring-1 ring-black/5" />
                          )}
                        </div>

                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-bold text-[#0E0E0E] group-hover:text-[#FBBF24] transition-colors">
                              {buddy.name}
                            </p>
                            <span className="text-[9px] text-[#9095A1] font-mono">{buddy.lastActive}</span>
                          </div>
                          <p className="text-[11px] text-[#707070] truncate max-w-[200px] sm:max-w-xs">
                            {buddy.lastMessage}
                          </p>
                        </div>
                      </div>

                      <CaretRight size={16} className="text-[#707070] group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                  ))}
                </div>

                <Link
                  href="/find-buddy"
                  className="block text-center p-2.5 rounded-xl border border-dashed border-[#FBBF24]/50 text-xs font-bold text-[#FBBF24] hover:bg-[#FDF9F1] transition-colors"
                >
                  + Find More Buddies
                </Link>
              </div>
            )}
          </div>

          {/* Square Activity Section */}
          <div className="space-y-2 pt-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#707070] block">
              Square Connection Activity
            </span>

            <div className="space-y-2.5">
              {squareActivities.map((sq) => (
                <div key={sq.id} className="faith-card p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-[#FBBF24] text-white font-bold text-[10px] flex items-center justify-center">
                        {sq.targetInitial}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#0E0E0E]">{sq.targetName}</p>
                        <p className="text-[9px] text-[#707070] font-mono">{sq.timeAgo}</p>
                      </div>
                    </div>

                    {sq.type === 'outgoing' ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-[#FAF6EE] text-[#707070] border border-[#E5E7EB] text-[10px] font-bold">
                        Awaiting Response
                      </span>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const supabase = createClient()
                              await supabase.from('buddies').update({ status: 'accepted' }).eq('id', sq.id)
                            } catch {}
                            setSquareActivities((prev) => prev.filter((item) => item.id !== sq.id))
                            router.push('/buddy-chat/sq-partner')
                          }}
                          className="px-2.5 py-1 bg-[#0E0E0E] text-white rounded-lg text-xs font-bold hover:bg-[#262626]"
                        >
                          Accept & Chat
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const supabase = createClient()
                              await supabase.from('buddies').delete().eq('id', sq.id)
                            } catch {}
                            setSquareActivities((prev) => prev.filter((item) => item.id !== sq.id))
                          }}
                          className="px-2 py-1 bg-white border border-[#E5E7EB] text-[#707070] rounded-lg text-xs font-bold hover:text-[#EA2C26]"
                        >
                          Decline
                        </button>
                      </div>
                    )}
                  </div>

                  {sq.introMessage && (
                    <div className="p-2.5 bg-[#FAF6EE] border border-[#E5E7EB] rounded-xl text-xs text-[#0E0E0E] italic flex items-start gap-2">
                      <Quotes size={14} className="text-[#FBBF24] shrink-0 mt-0.5" />
                      <span>&ldquo;{sq.introMessage}&rdquo;</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Group Tab */}
      {activeTab === 'group' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#707070]">
              My Groups ({groups.length})
            </span>
            <button
              type="button"
              onClick={() => {
                setCreateGroupStep('form')
                setIsCreateGroupOpen(true)
              }}
              className="text-xs font-bold text-[#FBBF24] hover:underline flex items-center gap-1"
            >
              <Plus size={14} />
              <span>+ New Group</span>
            </button>
          </div>

          <div className="space-y-3">
            {groups.length === 0 ? (
              <div className="faith-card p-6 text-center space-y-2">
                <p className="text-xs font-bold text-[#0E0E0E]">No groups yet</p>
                <p className="text-[11px] text-[#707070]">
                  Create a new group or join one with an invite code.
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
                        <h3 className="text-sm font-bold text-[#0E0E0E] group-hover:text-[#FBBF24] transition-colors">
                          {group.name}
                        </h3>
                        {group.isLive && (
                          <span className="px-2 py-0.2 rounded-full bg-rose-500/15 text-rose-600 text-[9px] font-extrabold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                            Live
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-[#707070]">
                        {group.category} • {group.church}
                      </p>
                    </div>

                    <span className="text-[10px] font-mono font-bold text-[#FBBF24] bg-[#FDF9F1] px-2 py-0.5 rounded-md border border-[#FBBF24]/35">
                      {group.activeTimeToday} Active
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-3 mt-2 border-t border-[#F3F4F6]">
                    <div className="flex items-center -space-x-1.5">
                      <div className="w-6 h-6 rounded-full bg-[#0E0E0E] text-white text-[9px] font-bold flex items-center justify-center border border-white">
                        D
                      </div>
                      <div className="w-6 h-6 rounded-full bg-[#FBBF24] text-white text-[9px] font-bold flex items-center justify-center border border-white">
                        H
                      </div>
                      <div className="w-6 h-6 rounded-full bg-[#FAF6EE] text-[#0E0E0E] text-[9px] font-bold flex items-center justify-center border border-[#E5E7EB]">
                        +{Math.max(0, group.memberCount - 2)}
                      </div>
                      <span className="text-[10px] text-[#707070] ml-2 font-medium">
                        {group.memberCount} members
                      </span>
                    </div>

                    <CaretRight size={16} className="text-[#707070] group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </Link>
              ))
            )}
          </div>

          {/* Discover / Join with Code Card */}
          <div className="faith-card p-4 flex items-center justify-between bg-[#FDF9F1] border-dashed border-2 border-[#FBBF24]/40">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#FDF9F1] text-[#FBBF24] flex items-center justify-center font-bold">
                <Users size={20} />
              </div>
              <div>
                <p className="text-xs font-bold text-[#0E0E0E]">Have an Invite Code?</p>
                <p className="text-[10px] text-[#707070]">Join a study cohort or youth ministry</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsJoinGroupOpen(true)}
              className="bg-[#0E0E0E] text-white py-2 px-3.5 rounded-xl font-bold text-xs shadow-sm hover:bg-[#262626]"
            >
              Join with Code
            </button>
          </div>
        </div>
      )}

      {/* Modal 1: Add Buddy by Code */}
      {isAddBuddyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-sm bg-[#FAF6EE] border border-[#E5E7EB] rounded-3xl p-5 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#0E0E0E]">Add Partner by Code</h3>
              <button onClick={() => setIsAddBuddyOpen(false)} className="text-[#707070]">
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
                  const { user: found, error: searchErr } = await searchUserBySyncCode(
                    buddyCodeInput,
                    currentUser.id
                  )

                  if (searchErr || !found) {
                    setBuddyCodeError(
                      searchErr || 'No believer found with this Sync Code. Please verify and try again.'
                    )
                    return
                  }

                  const res = await sendBuddyRequest(found.id, currentUser.id)
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
                } catch (err) {
                  console.error('Add buddy error:', err)
                  setBuddyCodeError('Unable to complete request. Please try again.')
                } finally {
                  setSendingBuddyRequest(false)
                }
              }}
              className="space-y-3"
            >
              <p className="text-xs text-[#707070]">
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
                className="w-full px-4 py-3 bg-white border border-[#E5E7EB] rounded-xl text-center font-mono font-black text-sm uppercase tracking-widest text-[#0E0E0E] focus:outline-none focus:border-[#FBBF24] shadow-sm"
              />

              <button
                type="submit"
                disabled={!buddyCodeInput.trim() || sendingBuddyRequest}
                className="w-full bg-[#0E0E0E] text-white py-3 rounded-xl font-bold text-xs shadow-md hover:bg-[#262626] transition-all disabled:opacity-40 flex items-center justify-center gap-2"
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
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
          <div className="fixed inset-0" onClick={() => setIsCreateGroupOpen(false)} />

          <div className="relative z-10 w-full max-w-md bg-[#FAF6EE] border border-[#E5E7EB] rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 sm:p-6 space-y-4 animate-in slide-in-from-bottom duration-300 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-[#E5E7EB]">
              <h3 className="text-sm font-black text-[#0E0E0E]">
                {createGroupStep === 'form' ? 'Create New Group' : 'Group Created! 🎉'}
              </h3>
              <button onClick={() => setIsCreateGroupOpen(false)} className="text-[#707070] hover:text-[#0E0E0E]">
                <X size={20} />
              </button>
            </div>

            {createGroupStep === 'form' ? (
              <form onSubmit={handleCreateGroup} className="space-y-4 pt-1">
                {/* 1. Group Profile Picture Upload */}
                <div className="flex flex-col items-center justify-center space-y-2 py-1">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full bg-[#0E0E0E] text-[#FBBF24] font-black text-lg flex items-center justify-center border-2 border-[#FBBF24]/50 shadow-md">
                      {newGroupName.trim() ? newGroupName.charAt(0).toUpperCase() : 'FS'}
                    </div>
                    <label
                      htmlFor="group-avatar-input"
                      className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#FBBF24] text-[#0E0E0E] flex items-center justify-center cursor-pointer shadow-md hover:scale-110 transition-transform"
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
                  <span className="text-[10px] text-[#707070] font-medium">Group Profile Picture</span>
                </div>

                {/* 2. Group Name */}
                <div>
                  <label className="text-[11px] font-bold text-[#707070] block mb-1">Group Name</label>
                  <input
                    type="text"
                    required
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="e.g. Friday Morning Bible Study"
                    className="w-full px-3.5 py-2.5 bg-white border border-[#E5E7EB] rounded-xl text-xs font-bold text-[#0E0E0E] focus:outline-none focus:border-[#FBBF24] shadow-xs"
                  />
                </div>

                {/* 3. Category & Local Assembly */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-[#707070] block mb-1">Category</label>
                    <select
                      value={newGroupCategory}
                      onChange={(e) => setNewGroupCategory(e.target.value)}
                      className="w-full px-3 py-2.5 bg-white border border-[#E5E7EB] rounded-xl text-xs font-bold text-[#0E0E0E] focus:outline-none focus:border-[#FBBF24] shadow-xs cursor-pointer"
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
                    <label className="text-[11px] font-bold text-[#707070] block mb-1">Local Assembly</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={newGroupChurch}
                        onChange={(e) => setNewGroupChurch(e.target.value)}
                        placeholder="e.g. Elevation Church"
                        className="w-full pl-8 pr-3 py-2.5 bg-white border border-[#E5E7EB] rounded-xl text-xs text-[#0E0E0E] focus:outline-none focus:border-[#FBBF24] shadow-xs"
                      />
                      <Church size={14} className="absolute left-2.5 top-3 text-[#9095A1]" />
                    </div>
                  </div>
                </div>

                {/* 4. Group Guidelines (Ethos) */}
                <div>
                  <label className="text-[11px] font-bold text-[#707070] block mb-1">
                    Group Guidelines (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={newGroupRules}
                    onChange={(e) => setNewGroupRules(e.target.value)}
                    placeholder="Keep conversations uplifting. Clock in at least once a week."
                    className="w-full px-3.5 py-2 bg-white border border-[#E5E7EB] rounded-xl text-xs text-[#0E0E0E] focus:outline-none focus:border-[#FBBF24] resize-none shadow-xs"
                  />
                </div>

                {/* 5. Private Group Toggle */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-white border border-[#E5E7EB] shadow-xs">
                  <div className="space-y-0.5 max-w-[80%]">
                    <div className="flex items-center gap-1.5">
                      <Lock size={14} className="text-[#FBBF24]" />
                      <p className="text-xs font-bold text-[#0E0E0E]">Private Group</p>
                    </div>
                    <p className="text-[10px] text-[#707070] leading-tight">
                      Hidden from public directory. Strictly invite-only.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setNewGroupIsPrivate((p) => !p)}
                    className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                      newGroupIsPrivate ? 'bg-[#0E0E0E]' : 'bg-[#E5E7EB]'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white transition-transform ${
                        newGroupIsPrivate ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Submit: Gold Create Group Button */}
                <button
                  type="submit"
                  disabled={!newGroupName.trim()}
                  className="w-full bg-[#0E0E0E] text-white py-3.5 rounded-2xl font-bold text-xs shadow-md hover:bg-[#262626] transition-all disabled:opacity-40"
                >
                  Create Group
                </button>
              </form>
            ) : (
              /* Success Screen */
              <div className="py-4 text-center space-y-4 animate-in zoom-in-95">
                {/* Large Green Checkmark */}
                <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto shadow-sm">
                  <CheckCircle size={38} weight="fill" />
                </div>

                <div className="space-y-1">
                  <h4 className="text-base font-black text-[#0E0E0E]">{newGroupName}</h4>
                  <p className="text-xs text-[#707070] max-w-xs mx-auto">
                    Your group is live! Share this unique Invite Code with members to join:
                  </p>
                </div>

                {/* Massive Spaced-out Code in Dashed Box */}
                <div
                  onClick={handleCopyInviteCode}
                  className="p-5 rounded-3xl bg-white border-2 border-dashed border-[#FBBF24] cursor-pointer hover:bg-[#FDF9F1] transition-all group shadow-sm"
                >
                  <p className="text-2xl sm:text-3xl font-black font-mono tracking-[0.35em] text-[#0E0E0E]">
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
                    className="py-3 px-3 rounded-2xl bg-white border border-[#E5E7EB] text-xs font-bold text-[#0E0E0E] hover:bg-[#FAF6EE] transition-colors"
                  >
                    View Group Info
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreateGroupOpen(false)
                      router.push(`/group-chat/${createdGroupId || 'new'}`)
                    }}
                    className="py-3 px-3 rounded-2xl bg-[#0E0E0E] text-white text-xs font-bold hover:bg-[#262626] transition-colors shadow-sm"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-sm bg-[#FAF6EE] border border-[#E5E7EB] rounded-3xl p-5 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#0E0E0E]">Join Group with Code</h3>
              <button onClick={() => setIsJoinGroupOpen(false)} className="text-[#707070]">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleJoinWithCode} className="space-y-3">
              <p className="text-xs text-[#707070]">
                Enter the invite code provided by your group leader.
              </p>

              {joinError && (
                <p className="text-[11px] font-bold text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-200">
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
                className="w-full px-4 py-3 bg-white border border-[#E5E7EB] rounded-xl text-center font-mono font-black text-sm uppercase tracking-widest text-[#0E0E0E] focus:outline-none focus:border-[#FBBF24] shadow-sm"
              />

              <button
                type="submit"
                disabled={!joinCodeInput.trim() || joining}
                className="w-full bg-[#0E0E0E] text-white py-3 rounded-xl font-bold text-xs shadow-md hover:bg-[#262626] transition-all disabled:opacity-40 cursor-pointer"
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
