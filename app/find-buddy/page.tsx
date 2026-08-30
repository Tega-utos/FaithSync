'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  CaretLeft,
  MagnifyingGlass,
  SlidersHorizontal,
  UserPlus,
  Fire,
  Check,
  Copy,
  ShareNetwork,
  X,
  Users,
  Sparkle,
  Church,
  Clock,
  ShieldWarning,
  CircleNotch,
  CheckCircle,
} from '@phosphor-icons/react'
import { createClient } from '@/lib/supabase/client'
import { normalizeCode, shareOrCopyCode } from '@/lib/utils/syncCodes'
import {
  searchUserBySyncCode,
  sendBuddyRequest,
  sendBuddyCodeConnect,
  approveBuddyRequest,
  deleteBuddyConnection,
  subscribeToBuddyUpdates,
} from '@/features/buddies/services/buddyService'

interface DirectoryUserItem {
  id: string
  name: string
  initial: string
  avatarUrl: string | null
  church: string
  buddyCode: string
  streakDays: number
  activityLevel: string
  goalLength: string
  connectionStatus: 'none' | 'pending' | 'accepted' | 'self'
}

interface PendingRequest {
  id: string
  senderId: string
  name: string
  initial: string
  church: string
}

export default function FindBuddyPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [myBuddyCode, setMyBuddyCode] = useState('')
  const [myChurch, setMyChurch] = useState('')

  // Search & Filter States
  const [codeQuery, setCodeQuery] = useState('')
  const [searchingCode, setSearchingCode] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Filter Modal (Bottom Sheet) States
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false)
  const [filterScope, setFilterScope] = useState<'global' | 'my_church'>('global')
  const [filterActivity, setFilterActivity] = useState<'all' | 'daily' | 'active'>('all')
  const [filterDuration, setFilterDuration] = useState<'all' | '15m' | '30m' | '60m'>('all')

  // Invite Bottom Sheet Modal State
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)

  // Data
  const [users, setUsers] = useState<DirectoryUserItem[]>([])
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([])
  const [activeBuddyCount, setActiveBuddyCount] = useState(0)
  const [codeLookupError, setCodeLookupError] = useState<string | null>(null)
  const [codeLookupSuccess, setCodeLookupSuccess] = useState<string | null>(null)
  const [searchingDirectory, setSearchingDirectory] = useState(false)

  useEffect(() => {
    let unsubscribe: (() => void) | null = null

    async function loadDirectoryData() {
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        setCurrentUser(user)

        if (user) {
          const { data: myProfile } = await supabase
            .from('profiles')
            .select('buddy_code, church')
            .eq('id', user.id)
            .single()

          if (myProfile?.buddy_code) {
            setMyBuddyCode(myProfile.buddy_code)
          }
          if (myProfile?.church) {
            setMyChurch(myProfile.church)
          }

          // Fetch pending requests sent to me
          const { data: incoming } = await supabase
            .from('buddies')
            .select(`
              id,
              user_id,
              user_profile:profiles!buddies_user_id_fkey(display_name)
            `)
            .eq('buddy_id', user.id)
            .eq('status', 'pending')

          if (incoming) {
            setPendingRequests(
              incoming.map((r: any) => ({
                id: r.id,
                senderId: r.user_id,
                name: r.user_profile?.display_name || 'A Believer',
                initial: (r.user_profile?.display_name || 'B').charAt(0).toUpperCase(),
                church: 'Local Assembly',
              }))
            )
          }

          // Fetch all active connections to mark statuses
          const { data: myBuddies } = await supabase
            .from('buddies')
            .select('user_id, buddy_id, status')
            .or(`user_id.eq.${user.id},buddy_id.eq.${user.id}`)

          const statusMap: Record<string, 'pending' | 'accepted'> = {}
          let acceptedCount = 0
          ;(myBuddies || []).forEach((b: any) => {
            const otherId = b.user_id === user.id ? b.buddy_id : b.user_id
            statusMap[otherId] = b.status
            if (b.status === 'accepted') acceptedCount++
          })
          setActiveBuddyCount(acceptedCount)

          // Fetch directory users via search API
          const res = await fetch('/api/buddy/search')
          if (res.ok) {
            const data = await res.json()
            if (data.results) {
              setUsers(data.results)
            }
          }
        }
      } catch (err) {
        console.error('Directory load error:', err)
      } finally {
        setLoading(false)
      }
    }

    loadDirectoryData()

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [])

  // Join by exact code (Stage 2 & 3)
  const handleSearchByCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!codeQuery.trim()) return

    setCodeLookupError(null)
    setCodeLookupSuccess(null)

    if (activeBuddyCount >= 3) {
      setCodeLookupError(
        'The Trinity Limit: You have reached the maximum limit of 3 active accountability buddies.'
      )
      return
    }

    if (!currentUser) {
      router.push('/login')
      return
    }

    setSearchingCode(true)
    try {
      const res = await sendBuddyCodeConnect(codeQuery)
      if (!res.success) {
        setCodeLookupError(res.error || 'Failed to connect with buddy.')
        return
      }

      setCodeLookupSuccess(
        res.message ||
          (res.status === 'accepted'
            ? '✓ Connected! You and your buddy are now linked.'
            : '✓ Buddy request sent! They will appear in your buddies as soon as they accept.')
      )
      setCodeQuery('')

      // Reload directory data
      const searchRes = await fetch(`/api/buddy/search?q=${encodeURIComponent(searchQuery)}`)
      if (searchRes.ok) {
        const data = await searchRes.json()
        if (data.results) setUsers(data.results)
      }
    } catch (err: any) {
      console.error('Code lookup error:', err)
      setCodeLookupError(err?.message || 'Unable to complete lookup. Please try again.')
    } finally {
      setSearchingCode(false)
    }
  }

  // Active Directory Search form handler (triggered on Enter or Search button)
  const handleDirectorySearch = async (e: React.FormEvent) => {
    e.preventDefault()
    setSearchingDirectory(true)
    try {
      const res = await fetch(`/api/buddy/search?q=${encodeURIComponent(searchQuery.trim())}`)
      if (res.ok) {
        const data = await res.json()
        if (data.results) {
          setUsers(data.results)
        }
      }
    } catch (err) {
      console.error('Search error:', err)
    } finally {
      setSearchingDirectory(false)
    }
  }

  // Connect Button Handler (Stage 3)
  const handleSendConnect = async (targetUser: DirectoryUserItem) => {
    if (!currentUser) {
      router.push('/login')
      return
    }

    if (targetUser.id === currentUser.id) return

    if (activeBuddyCount >= 3) {
      setCodeLookupError(
        'The Trinity Limit: You have reached the maximum limit of 3 active accountability buddies.'
      )
      return
    }

    setUsers((prev) =>
      prev.map((u) => (u.id === targetUser.id ? { ...u, connectionStatus: 'pending' } : u))
    )

    try {
      const res = await sendBuddyRequest(targetUser.id, currentUser.id)
      if (res.success) {
        setUsers((prev) =>
          prev.map((u) => (u.id === targetUser.id ? { ...u, connectionStatus: res.status } : u))
        )
      }
    } catch (err) {
      console.error('Connect error:', err)
    }
  }

  // Approve / Ignore Handlers (Stage 5)
  const handleApprove = async (reqId: string) => {
    if (activeBuddyCount >= 3) {
      setCodeLookupError(
        'The Trinity Limit: You can have a maximum of 3 active accountability buddies. Remove a buddy before adding another.'
      )
      return
    }

    if (!currentUser) return

    try {
      const res = await approveBuddyRequest(reqId, currentUser.id)
      if (res.success) {
        setPendingRequests((prev) => prev.filter((r) => r.id !== reqId))
        setActiveBuddyCount((prev) => prev + 1)
      }
    } catch (err) {
      console.error('Approve error:', err)
    }
  }

  const handleIgnore = async (reqId: string) => {
    try {
      await deleteBuddyConnection(reqId)
      setPendingRequests((prev) => prev.filter((r) => r.id !== reqId))
    } catch (err) {
      console.error('Ignore error:', err)
    }
  }

  // Copy & Share code handler
  const handleCopyMyCode = async () => {
    await shareOrCopyCode({
      code: myBuddyCode,
      title: 'Join me on FaithSync',
      text: `Let's sync our spiritual habits on FaithSync! Add my buddy code: ${myBuddyCode}`,
    })
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  // Filtered Users (Global 3-Field Search + My Church Smart Filter)
  const filteredUsers = users.filter((u) => {
    // 1. My Church Smart Filter
    if (filterScope === 'my_church') {
      if (myChurch) {
        const userChurch = u.church.toLowerCase().trim()
        const targetChurch = myChurch.toLowerCase().trim()
        if (userChurch !== targetChurch) return false
      }
    }

    // 2. Global Text Search across Name, Sync Code, and Church (Local Assembly)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      const matchesName = u.name.toLowerCase().includes(q)
      const matchesChurch = u.church.toLowerCase().includes(q)
      const matchesCode = u.buddyCode.toLowerCase().includes(q)

      if (!matchesName && !matchesChurch && !matchesCode) return false
    }

    // 3. Activity Level Filter
    if (filterActivity === 'daily' && u.activityLevel !== 'Daily Active') {
      return false
    }

    return true
  })

  const handleShareInvite = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Join me on FaithSync',
        text: `Let’s hold each other accountable in prayer and study on FaithSync! Add me with my code: ${myBuddyCode}`,
        url: window.location.origin,
      }).catch(() => {})
    } else {
      handleCopyMyCode()
    }
  }

  return (
    <div className="command-center-container px-4 sm:px-6 pt-3 pb-28 min-h-[92vh] space-y-5">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-2 border-b border-[#E5E7EB]">
        <button
          type="button"
          onClick={() => router.back()}
          className="p-2 rounded-xl text-[#707070] hover:text-[#0E0E0E] hover:bg-[#F3F4F6]/50 transition-colors flex items-center gap-1.5 text-xs font-bold"
        >
          <CaretLeft size={18} />
          <span>Back</span>
        </button>

        <h1 className="text-sm font-extrabold text-[#0E0E0E]">Find Buddy</h1>
        <div className="w-8" />
      </div>

      <div className="space-y-1">
        <h2 className="text-xl font-black text-[#0E0E0E] tracking-tight">Buddy Finder</h2>
        <p className="text-xs text-[#707070] leading-relaxed">
          Connect securely using a unique Sync Code, or browse the directory to find new buddies.
        </p>
      </div>

      {/* Incoming Requests */}
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
                      {req.name} <span className="text-[10px] font-normal text-[#707070] underline ml-1">Preview Profile</span>
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

      {/* Search Modalities */}
      <div className="space-y-4">
        {/* A. Join by Sync Code */}
        <div className="faith-card p-4 space-y-2.5 bg-[#FDF9F1]">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#707070] block">
            A. Add by Sync Code (Exact Match)
          </span>

          {codeLookupError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center justify-between gap-2">
              <span>{codeLookupError}</span>
              <button
                type="button"
                onClick={() => setCodeLookupError(null)}
                className="text-red-700 hover:opacity-75"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {codeLookupSuccess && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between gap-2 animate-in fade-in">
              <span>{codeLookupSuccess}</span>
              <button
                type="button"
                onClick={() => setCodeLookupSuccess(null)}
                className="text-emerald-800 hover:opacity-75"
              >
                <X size={14} />
              </button>
            </div>
          )}

          <form onSubmit={handleSearchByCode} className="flex items-center gap-2">
            <input
              type="text"
              value={codeQuery}
              onChange={(e) => {
                setCodeQuery(e.target.value.toUpperCase())
                setCodeLookupError(null)
                setCodeLookupSuccess(null)
              }}
              placeholder="e.g. SYNC26"
              className="flex-1 px-3.5 py-2.5 bg-white border border-[#E5E7EB] rounded-xl font-mono font-bold text-xs uppercase tracking-widest text-[#0E0E0E] focus:outline-none focus:border-[#FBBF24] shadow-sm"
            />
            <button
              type="submit"
              disabled={!codeQuery.trim() || searchingCode}
              className="bg-[#0E0E0E] text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-sm hover:bg-[#262626] transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
            >
              {searchingCode ? <CircleNotch size={14} className="animate-spin" /> : 'Add'}
            </button>
          </form>
        </div>

        {/* OR Divider */}
        <div className="relative flex items-center justify-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[#E5E7EB]" />
          </div>
          <span className="relative bg-[#FAF6EE] px-4 text-[11px] font-bold text-[#9095A1] uppercase tracking-widest">
            OR
          </span>
        </div>

        {/* B. Browse Directory */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#707070]">
              B. Browse Believer Directory
            </span>

            <button
              type="button"
              onClick={() => setIsFilterModalOpen(true)}
              className="text-xs font-bold text-[#FBBF24] hover:underline flex items-center gap-1"
            >
              <SlidersHorizontal size={14} />
              <span>Refine Filters</span>
            </button>
          </div>

          <form onSubmit={handleDirectorySearch} className="flex items-center gap-2">
            <div className="relative flex-1">
              <MagnifyingGlass size={16} className="text-[#9095A1] absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by Name, Sync Code, or Church..."
                className="w-full pl-9 pr-4 py-2.5 bg-white border border-[#E5E7EB] rounded-xl text-xs text-[#0E0E0E] placeholder-[#9095A1] focus:outline-none focus:border-[#FBBF24] shadow-sm"
              />
            </div>
            <button
              type="submit"
              disabled={searchingDirectory}
              className="bg-[#0E0E0E] text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-sm hover:bg-[#262626] transition-all flex items-center gap-1 shrink-0"
            >
              {searchingDirectory ? <CircleNotch size={14} className="animate-spin" /> : 'Search'}
            </button>
          </form>
        </div>
      </div>

      {/* Directory Matches */}
      <div className="space-y-3 pt-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#707070] block">
            Directory Matches ({filteredUsers.length})
          </span>

          {filterScope === 'my_church' && myChurch && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FDF9F1] border border-[#FBBF24]/40 text-[#0E0E0E] flex items-center gap-1">
              <Church size={11} className="text-[#FBBF24]" />
              <span>{myChurch}</span>
            </span>
          )}
        </div>

        {filteredUsers.length === 0 ? (
          <div className="faith-card p-8 text-center flex flex-col items-center justify-center space-y-3 my-4">
            <div className="w-12 h-12 rounded-2xl bg-[#FDF9F1] text-[#FBBF24] border border-[#FBBF24]/35 flex items-center justify-center">
              <Users size={24} />
            </div>
            <div className="space-y-1 max-w-xs">
              <h3 className="text-xs font-bold text-[#0E0E0E]">No users found</h3>
              <p className="text-[11px] text-[#707070] leading-relaxed">
                We couldn&apos;t find anyone matching your search criteria. Invite your friends to join you on FaithSync!
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsInviteModalOpen(true)}
              className="bg-[#0E0E0E] text-white py-2.5 px-5 rounded-xl font-bold text-xs shadow-md hover:bg-[#262626] transition-all flex items-center gap-1.5"
            >
              <ShareNetwork size={14} className="text-[#FBBF24]" />
              <span>Share Invite Link</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredUsers.map((userItem) => {
              return (
                <div
                  key={userItem.id}
                  className="faith-card p-4 flex items-center justify-between gap-3 hover:border-[#FBBF24]/40 transition-colors"
                >
                  <Link
                    href={`/profile/${userItem.id}`}
                    className="flex items-center gap-3 flex-1 min-w-0 group"
                  >
                    <div className="w-11 h-11 rounded-full bg-[#0E0E0E] text-white font-bold text-sm flex items-center justify-center shadow-sm overflow-hidden shrink-0">
                      {userItem.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={userItem.avatarUrl}
                          alt={userItem.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span>{userItem.initial}</span>
                      )}
                    </div>

                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-[#0E0E0E] group-hover:text-[#FBBF24] transition-colors truncate">
                          {userItem.name}
                        </p>
                        <span className="px-2 py-0.2 rounded-full bg-emerald-500/15 text-emerald-700 text-[9px] font-bold shrink-0">
                          {userItem.activityLevel}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[10px] text-[#707070]">
                        <span className="flex items-center gap-1 font-bold text-[#0E0E0E] truncate max-w-[120px]">
                          <Church size={12} className="text-[#FBBF24] shrink-0" />
                          <span className="truncate">{userItem.church}</span>
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-0.5 text-[#234537] font-bold shrink-0">
                          <Fire size={12} weight="fill" className="text-[#234537]" />
                          {userItem.streakDays}d Streak
                        </span>
                      </div>
                    </div>
                  </Link>

                  <div>
                    {userItem.connectionStatus === 'self' ? (
                      <span className="px-3 py-1.5 rounded-xl bg-[#F3F4F6] text-[#707070] text-xs font-bold block cursor-not-allowed">
                        This is you
                      </span>
                    ) : userItem.connectionStatus === 'accepted' ? (
                      <span className="px-3 py-1.5 rounded-xl bg-emerald-500/15 text-emerald-700 text-xs font-bold flex items-center gap-1">
                        <Check size={14} weight="bold" />
                        <span>Buddies</span>
                      </span>
                    ) : userItem.connectionStatus === 'pending' ? (
                      <span className="px-3 py-1.5 rounded-xl bg-[#FDF9F1] text-[#FBBF24] border border-[#FBBF24]/35 text-xs font-bold block cursor-not-allowed">
                        Request Sent
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSendConnect(userItem)}
                        className="px-3.5 py-1.5 rounded-xl bg-[#0E0E0E] text-white text-xs font-bold shadow-sm hover:bg-[#262626] active:scale-95 transition-all flex items-center gap-1.5"
                      >
                        <UserPlus size={14} className="text-[#FBBF24]" />
                        <span>Connect</span>
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Refine Search Filter Modal */}
      {isFilterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
          <div className="fixed inset-0" onClick={() => setIsFilterModalOpen(false)} />

          <div className="relative z-10 w-full max-w-md bg-[#FAF6EE] border border-[#E5E7EB] rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 sm:p-6 space-y-4 animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between pb-2 border-b border-[#E5E7EB]">
              <h3 className="text-sm font-bold text-[#0E0E0E]">Refine Directory Search</h3>
              <button onClick={() => setIsFilterModalOpen(false)} className="text-[#707070]">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4 pt-1">
              <div>
                <label className="text-[11px] font-bold text-[#707070] block mb-1.5">
                  Community Scope
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFilterScope('global')}
                    className={`py-2.5 px-3 rounded-xl font-bold text-xs border ${
                      filterScope === 'global'
                        ? 'bg-[#0E0E0E] text-white border-[#0E0E0E]'
                        : 'bg-white text-[#707070] border-[#E5E7EB]'
                    }`}
                  >
                    Global
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterScope('my_church')}
                    className={`py-2.5 px-3 rounded-xl font-bold text-xs border ${
                      filterScope === 'my_church'
                        ? 'bg-[#0E0E0E] text-white border-[#0E0E0E]'
                        : 'bg-white text-[#707070] border-[#E5E7EB]'
                    }`}
                  >
                    My Church
                  </button>
                </div>

                {filterScope === 'my_church' && (
                  <p className="text-[10px] text-[#707070] mt-1.5 flex items-center gap-1">
                    <Church size={12} className="text-[#FBBF24]" />
                    <span>
                      {myChurch
                        ? `Filtered to members from "${myChurch}"`
                        : 'Set your church in profile to filter automatically.'}
                    </span>
                  </p>
                )}
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#707070] block mb-1.5">
                  Activity Level
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFilterActivity('all')}
                    className={`py-2.5 px-3 rounded-xl font-bold text-xs border ${
                      filterActivity === 'all'
                        ? 'bg-[#0E0E0E] text-white border-[#0E0E0E]'
                        : 'bg-white text-[#707070] border-[#E5E7EB]'
                    }`}
                  >
                    Any Activity
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterActivity('daily')}
                    className={`py-2.5 px-3 rounded-xl font-bold text-xs border ${
                      filterActivity === 'daily'
                        ? 'bg-[#0E0E0E] text-white border-[#0E0E0E]'
                        : 'bg-white text-[#707070] border-[#E5E7EB]'
                    }`}
                  >
                    Daily Active Only
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsFilterModalOpen(false)}
                className="w-full bg-[#0E0E0E] text-white py-3.5 rounded-xl font-bold text-xs shadow-md mt-2"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
          <div className="fixed inset-0" onClick={() => setIsInviteModalOpen(false)} />

          <div className="relative z-10 w-full max-w-md bg-[#FAF6EE] border border-[#E5E7EB] rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 sm:p-6 space-y-4 animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between pb-2 border-b border-[#E5E7EB]">
              <h3 className="text-sm font-bold text-[#0E0E0E]">Invite Your Buddies</h3>
              <button onClick={() => setIsInviteModalOpen(false)} className="text-[#707070]">
                <X size={20} />
              </button>
            </div>

            <div className="text-center space-y-3 py-2">
              <p className="text-xs text-[#707070]">
                Share your personal Sync Code with friends so they can add you directly.
              </p>

              <div
                onClick={handleCopyMyCode}
                className="p-4 rounded-2xl bg-white border-2 border-dashed border-[#FBBF24] cursor-pointer"
              >
                <p className="text-2xl font-black font-mono tracking-widest text-[#0E0E0E]">
                  {myBuddyCode}
                </p>
                <p className="text-[10px] text-[#FBBF24] font-bold mt-1">
                  {copiedCode ? 'Copied! ✓' : 'Tap to Copy Code'}
                </p>
              </div>

              <button
                type="button"
                onClick={handleShareInvite}
                className="w-full bg-[#0E0E0E] text-white py-3.5 rounded-xl font-bold text-xs shadow-md flex items-center justify-center gap-2"
              >
                <ShareNetwork size={16} />
                <span>Share Invite via Message / Apps</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
