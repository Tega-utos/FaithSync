'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ShieldCheck,
  Users,
  ChatText,
  Megaphone,
  ChartBar,
  Trash,
  Fire,
  Clock,
  CircleNotch,
  MagnifyingGlass,
  Prohibit,
  SpeakerSlash,
  CaretLeft,
  Sparkle,
  Check,
  HandsPraying,
  BookOpen,
  ArrowSquareOut,
  Sliders,
  Medal,
} from '@phosphor-icons/react'
import { createClient } from '@/lib/supabase/client'
import { isSuperAdmin } from '@/lib/admin/adminAuth'

type TabType = 'vitals' | 'square' | 'users' | 'broadcast'

export default function SuperAdminPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>('vitals')
  const [adminEmail, setAdminEmail] = useState<string | null>(null)

  // Vitals State
  const [stats, setStats] = useState<any>(null)
  const [recentSessions, setRecentSessions] = useState<any[]>([])

  // Square Moderation State
  const [squarePosts, setSquarePosts] = useState<any[]>([])
  const [squareSearch, setSquareSearch] = useState('')
  const [loadingSquare, setLoadingSquare] = useState(false)
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null)

  // User Management State
  const [users, setUsers] = useState<any[]>([])
  const [userSearch, setUserSearch] = useState('')
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [selectedUser, setSelectedUser] = useState<any | null>(null)
  const [streakModalOpen, setStreakModalOpen] = useState(false)
  const [newStreakValue, setNewStreakValue] = useState(0)
  const [badgeModalOpen, setBadgeModalOpen] = useState(false)
  const [selectedBadge, setSelectedBadge] = useState('Ministry Leader')

  // Broadcast State
  const [broadcastTitle, setBroadcastTitle] = useState('')
  const [broadcastMessage, setBroadcastMessage] = useState('')
  const [broadcastUrl, setBroadcastUrl] = useState('/')
  const [broadcasting, setBroadcasting] = useState(false)
  const [broadcastResult, setBroadcastResult] = useState<string | null>(null)

  // 1. Verify Super Admin Access
  useEffect(() => {
    async function checkAuth() {
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user || !isSuperAdmin(user.email)) {
          router.push('/')
          return
        }

        setAdminEmail(user.email)
        setAuthorized(true)
        loadVitals()
      } catch (err) {
        console.error('Admin auth check error:', err)
        router.push('/')
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [])

  // 2. Load Platform Vitals
  const loadVitals = async () => {
    try {
      const res = await fetch('/api/admin/stats')
      const data = await res.json()
      if (data.success) {
        setStats(data.stats)
        setRecentSessions(data.recentSessions || [])
      }
    } catch (err) {
      console.error('Failed to load vitals:', err)
    }
  }

  // 3. Load Square Posts for Moderation
  const loadSquarePosts = async (query = '') => {
    setLoadingSquare(true)
    try {
      const res = await fetch(`/api/admin/square?q=${encodeURIComponent(query)}`)
      const data = await res.json()
      if (data.success) {
        setSquarePosts(data.posts || [])
      }
    } catch (err) {
      console.error('Failed to load square posts:', err)
    } finally {
      setLoadingSquare(false)
    }
  }

  // 4. Load Users
  const loadUsers = async (query = '') => {
    setLoadingUsers(true)
    try {
      const res = await fetch(`/api/admin/users?q=${encodeURIComponent(query)}`)
      const data = await res.json()
      if (data.success) {
        setUsers(data.users || [])
      }
    } catch (err) {
      console.error('Failed to load users:', err)
    } finally {
      setLoadingUsers(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'square') {
      loadSquarePosts(squareSearch)
    } else if (activeTab === 'users') {
      loadUsers(userSearch)
    }
  }, [activeTab])

  // Moderation: Delete Post
  const handleDeletePost = async (postId: string) => {
    if (!confirm('Are you sure you want to permanently delete this post as Super Admin?')) return
    setDeletingPostId(postId)
    try {
      const res = await fetch('/api/admin/square', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId }),
      })
      const data = await res.json()
      if (data.success) {
        setSquarePosts((prev) => prev.filter((p) => p.id !== postId))
      }
    } catch (err) {
      console.error('Delete error:', err)
    } finally {
      setDeletingPostId(null)
    }
  }

  // User Actions: Streak, Mute, Ban, Badge
  const handleUserAction = async (targetUserId: string, action: string, value: any) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId, action, value }),
      })
      const data = await res.json()
      if (data.success) {
        loadUsers(userSearch)
      }
    } catch (err) {
      console.error('User action error:', err)
    }
  }

  // Broadcast Action
  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!broadcastMessage.trim()) return
    setBroadcasting(true)
    setBroadcastResult(null)
    try {
      const res = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: broadcastTitle,
          message: broadcastMessage,
          actionUrl: broadcastUrl,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setBroadcastResult(`Broadcast successfully dispatched to ${data.deliveredToUsers} believers!`)
        setBroadcastTitle('')
        setBroadcastMessage('')
      } else {
        setBroadcastResult(`Error: ${data.error || 'Failed to dispatch broadcast'}`)
      }
    } catch (err: any) {
      setBroadcastResult(`Error: ${err?.message || 'Server error'}`)
    } finally {
      setBroadcasting(false)
    }
  }

  if (loading || !authorized) {
    return (
      <div className="command-center-container min-h-screen flex flex-col items-center justify-center space-y-3">
        <CircleNotch size={32} className="animate-spin text-[#FBBF24]" />
        <p className="text-xs font-bold text-text-secondary">Verifying Super Admin Authorization...</p>
      </div>
    )
  }

  return (
    <div className="command-center-container px-4 sm:px-6 pt-4 pb-32 min-h-screen space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push('/profile')}
            className="p-1.5 rounded-xl text-text-secondary hover:text-text-primary hover:bg-card transition-colors flex items-center gap-1 text-xs font-bold"
          >
            <CaretLeft size={18} />
            <span>Profile</span>
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-text-primary tracking-tight">Super Admin Command Center</h1>
              <span className="px-2 py-0.5 rounded-full bg-[#FBBF24]/10 text-[#FBBF24] border border-[#FBBF24]/30 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                <ShieldCheck size={12} weight="fill" />
                Root
              </span>
            </div>
            <p className="text-[11px] text-text-secondary font-mono">{adminEmail}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            if (activeTab === 'vitals') loadVitals()
            if (activeTab === 'square') loadSquarePosts(squareSearch)
            if (activeTab === 'users') loadUsers(userSearch)
          }}
          className="px-3 py-1.5 rounded-xl bg-card border border-border text-text-primary text-xs font-bold hover:bg-surface transition-all shadow-2xs cursor-pointer"
        >
          Refresh
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="grid grid-cols-4 gap-1.5 bg-card/60 p-1.5 rounded-2xl border border-border">
        {[
          { id: 'vitals', label: 'Vitals', icon: ChartBar },
          { id: 'square', label: 'Square Mod', icon: ChatText },
          { id: 'users', label: 'Users & Streaks', icon: Users },
          { id: 'broadcast', label: 'Broadcast', icon: Megaphone },
        ].map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-bold transition-all ${
                isActive
                  ? 'bg-[#0E0E0E] dark:bg-[#FBBF24] text-white dark:text-[#1A1610] shadow-sm scale-[1.02]'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface/50'
              }`}
            >
              <Icon size={16} weight={isActive ? 'fill' : 'regular'} />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: PLATFORM VITALS                                                    */}
      {/* ========================================================================= */}
      {activeTab === 'vitals' && (
        <div className="space-y-6 animate-in fade-in-50 duration-300">
          {/* KPI Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="faith-card p-4 bg-card border border-border space-y-1">
              <span className="text-[11px] font-bold text-text-secondary flex items-center gap-1">
                <Users size={14} className="text-[#FBBF24]" />
                Registered Believers
              </span>
              <p className="text-2xl font-black text-text-primary font-mono-tabular">
                {stats?.totalUsers ?? '—'}
              </p>
            </div>

            <div className="faith-card p-4 bg-card border border-border space-y-1">
              <span className="text-[11px] font-bold text-text-secondary flex items-center gap-1">
                <Clock size={14} className="text-emerald-500" />
                Total Devotion Hours
              </span>
              <p className="text-2xl font-black text-text-primary font-mono-tabular">
                {stats?.totalGlobalDevotionHours ?? '—'} <span className="text-xs font-sans text-text-muted">hrs</span>
              </p>
            </div>

            <div className="faith-card p-4 bg-card border border-border space-y-1">
              <span className="text-[11px] font-bold text-text-secondary flex items-center gap-1">
                <Fire size={14} className="text-[#EA2C26]" weight="fill" />
                Total Sessions Logged
              </span>
              <p className="text-2xl font-black text-text-primary font-mono-tabular">
                {stats?.totalSessions ?? '—'}
              </p>
            </div>

            <div className="faith-card p-4 bg-card border border-border space-y-1">
              <span className="text-[11px] font-bold text-text-secondary flex items-center gap-1">
                <HandsPraying size={14} className="text-[#234537] dark:text-emerald-400" weight="fill" />
                Today's Prayer Mins
              </span>
              <p className="text-2xl font-black text-text-primary font-mono-tabular">
                {stats?.totalPrayerMinsToday ?? '—'} <span className="text-xs font-sans text-text-muted">min</span>
              </p>
            </div>

            <div className="faith-card p-4 bg-card border border-border space-y-1">
              <span className="text-[11px] font-bold text-text-secondary flex items-center gap-1">
                <BookOpen size={14} className="text-[#FBBF24]" weight="fill" />
                Today's Study Mins
              </span>
              <p className="text-2xl font-black text-text-primary font-mono-tabular">
                {stats?.totalStudyMinsToday ?? '—'} <span className="text-xs font-sans text-text-muted">min</span>
              </p>
            </div>

            <div className="faith-card p-4 bg-card border border-border space-y-1">
              <span className="text-[11px] font-bold text-text-secondary flex items-center gap-1">
                <ChatText size={14} className="text-indigo-500" />
                Square Posts & Records
              </span>
              <p className="text-2xl font-black text-text-primary font-mono-tabular">
                {stats?.totalPosts ?? '—'}
              </p>
            </div>
          </div>

          {/* Recent Live Activity Stream */}
          <div className="faith-card p-5 bg-card border border-border space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-text-secondary">
              Recent Devotion Activity Stream
            </h3>
            <div className="divide-y divide-border">
              {recentSessions.length === 0 ? (
                <p className="text-xs text-text-muted py-3">No recent sessions recorded.</p>
              ) : (
                recentSessions.map((s) => (
                  <div key={s.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div className="space-y-0.5">
                      <p className="font-bold text-text-primary">
                        {s.profiles?.display_name || 'Anonymous Believer'}
                        {s.profiles?.church && (
                          <span className="ml-1.5 text-[10px] font-normal text-text-secondary">
                            ({s.profiles.church})
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-text-secondary flex items-center gap-2">
                        <span className="capitalize font-semibold text-[#FBBF24]">{s.type}</span>
                        <span>•</span>
                        <span>{Math.round((s.duration_seconds || 0) / 60)} min</span>
                        <span>•</span>
                        <span>{new Date(s.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      Verified ✓
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: SQUARE MODERATION                                                  */}
      {/* ========================================================================= */}
      {activeTab === 'square' && (
        <div className="space-y-4 animate-in fade-in-50 duration-300">
          {/* Search Box */}
          <div className="relative">
            <MagnifyingGlass size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary" />
            <input
              type="text"
              placeholder="Search posts by keyword or author..."
              value={squareSearch}
              onChange={(e) => {
                setSquareSearch(e.target.value)
                loadSquarePosts(e.target.value)
              }}
              className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-2xl text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-[#FBBF24]"
            />
          </div>

          {/* Posts List */}
          {loadingSquare ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-2">
              <CircleNotch size={24} className="animate-spin text-[#FBBF24]" />
              <p className="text-xs text-text-secondary">Loading Square Posts...</p>
            </div>
          ) : squarePosts.length === 0 ? (
            <div className="faith-card p-8 text-center text-xs text-text-secondary">
              No posts found matching your search.
            </div>
          ) : (
            <div className="space-y-3">
              {squarePosts.map((post) => (
                <div
                  key={post.id}
                  className="faith-card p-4 bg-card border border-border space-y-2.5 transition-all hover:border-border-hover"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-text-primary">
                          {post.profiles?.display_name || post.profiles?.full_name || 'Unknown Author'}
                        </p>
                        {post.is_anonymous && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[9px] font-bold">
                            Anon on Square (Real author revealed)
                          </span>
                        )}
                        <span className="text-[10px] text-text-muted font-mono">{post.profiles?.email}</span>
                      </div>
                      <p className="text-[10px] text-text-secondary">
                        {new Date(post.created_at).toLocaleString()} • Type: <span className="font-semibold">{post.post_type}</span>
                      </p>
                    </div>

                    {/* Admin Delete Action */}
                    <button
                      type="button"
                      disabled={deletingPostId === post.id}
                      onClick={() => handleDeletePost(post.id)}
                      className="px-2.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500 text-rose-600 hover:text-white border border-rose-500/20 text-xs font-bold transition-all flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      {deletingPostId === post.id ? (
                        <CircleNotch size={14} className="animate-spin" />
                      ) : (
                        <Trash size={14} />
                      )}
                      <span>Delete</span>
                    </button>
                  </div>

                  <p className="text-xs text-text-primary leading-relaxed bg-surface/60 p-2.5 rounded-xl border border-border">
                    {post.content}
                  </p>

                  {post.verse_reference && (
                    <div className="text-[10px] font-bold text-[#FBBF24] flex items-center gap-1">
                      <BookOpen size={12} weight="fill" />
                      <span>{post.verse_reference}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: USER MANAGEMENT & STREAK REPAIR                                    */}
      {/* ========================================================================= */}
      {activeTab === 'users' && (
        <div className="space-y-4 animate-in fade-in-50 duration-300">
          {/* Search Box */}
          <div className="relative">
            <MagnifyingGlass size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary" />
            <input
              type="text"
              placeholder="Search user by name, email, church, or buddy code..."
              value={userSearch}
              onChange={(e) => {
                setUserSearch(e.target.value)
                loadUsers(e.target.value)
              }}
              className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-2xl text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-[#FBBF24]"
            />
          </div>

          {/* Users List */}
          {loadingUsers ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-2">
              <CircleNotch size={24} className="animate-spin text-[#FBBF24]" />
              <p className="text-xs text-text-secondary">Searching believers...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="faith-card p-8 text-center text-xs text-text-secondary">
              No users found matching your search.
            </div>
          ) : (
            <div className="space-y-3">
              {users.map((u) => {
                const isBanned = u.preferences?.is_banned
                const isMuted = u.preferences?.is_muted_square
                const badges = u.preferences?.special_badges || []

                return (
                  <div
                    key={u.id}
                    className={`faith-card p-4 bg-card border rounded-2xl space-y-3 transition-all ${
                      isBanned ? 'border-rose-500/40 bg-rose-500/5' : 'border-border'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-text-primary">
                            {u.display_name || u.full_name || 'Believer'}
                          </p>
                          {u.church && (
                            <span className="text-[10px] text-text-secondary font-medium">({u.church})</span>
                          )}
                          {isBanned && (
                            <span className="px-1.5 py-0.5 rounded bg-rose-500 text-white text-[9px] font-black uppercase">
                              Banned
                            </span>
                          )}
                          {isMuted && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[9px] font-bold">
                              Muted on Square
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-text-secondary font-mono">{u.email} • Code: {u.buddy_code || '—'}</p>
                      </div>

                      {/* Stats Pills */}
                      <div className="flex items-center gap-2 text-xs">
                        <span className="px-2 py-1 rounded-xl bg-surface border border-border font-bold text-text-primary flex items-center gap-1">
                          <Fire size={13} className="text-[#EA2C26]" weight="fill" />
                          <span>{u.current_streak || 0}d Streak</span>
                        </span>
                        <span className="px-2 py-1 rounded-xl bg-surface border border-border font-bold text-text-primary flex items-center gap-1">
                          <Clock size={13} className="text-[#FBBF24]" />
                          <span>{Math.round((u.total_devotion_mins || 0) / 60)}h Total</span>
                        </span>
                      </div>
                    </div>

                    {/* Special Badges List */}
                    {badges.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {badges.map((b: string) => (
                          <span
                            key={b}
                            className="px-2 py-0.5 rounded-full bg-[#FBBF24]/10 text-[#FBBF24] border border-[#FBBF24]/30 text-[10px] font-bold flex items-center gap-1"
                          >
                            <Medal size={11} weight="fill" />
                            {b}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Action Buttons Toolbar */}
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
                      {/* Streak Repair Button */}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedUser(u)
                          setNewStreakValue(u.current_streak || 0)
                          setStreakModalOpen(true)
                        }}
                        className="px-2.5 py-1 rounded-lg bg-surface hover:bg-card-hover border border-border text-xs font-bold text-text-primary flex items-center gap-1 transition-all"
                      >
                        <Fire size={13} className="text-[#EA2C26]" />
                        <span>Repair Streak</span>
                      </button>

                      {/* Grant Badge Button */}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedUser(u)
                          setBadgeModalOpen(true)
                        }}
                        className="px-2.5 py-1 rounded-lg bg-surface hover:bg-card-hover border border-border text-xs font-bold text-text-primary flex items-center gap-1 transition-all"
                      >
                        <Medal size={13} className="text-[#FBBF24]" />
                        <span>Grant Badge</span>
                      </button>

                      {/* Mute Square Toggle */}
                      <button
                        type="button"
                        onClick={() => handleUserAction(u.id, 'mute_square', !isMuted)}
                        className={`px-2.5 py-1 rounded-lg border text-xs font-bold flex items-center gap-1 transition-all ${
                          isMuted
                            ? 'bg-amber-500 text-white border-amber-600'
                            : 'bg-surface border-border text-text-secondary hover:text-text-primary'
                        }`}
                      >
                        <SpeakerSlash size={13} />
                        <span>{isMuted ? 'Unmute' : 'Mute Square'}</span>
                      </button>

                      {/* Ban Account Toggle */}
                      <button
                        type="button"
                        onClick={() => handleUserAction(u.id, 'ban_user', !isBanned)}
                        className={`px-2.5 py-1 rounded-lg border text-xs font-bold flex items-center gap-1 transition-all ${
                          isBanned
                            ? 'bg-rose-500 text-white border-rose-600'
                            : 'bg-surface border-border text-rose-500 hover:bg-rose-500/10'
                        }`}
                      >
                        <Prohibit size={13} />
                        <span>{isBanned ? 'Lift Ban' : 'Ban Account'}</span>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Adjust Streak Modal */}
          {streakModalOpen && selectedUser && (
            <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-surface border border-border rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
                <h3 className="text-sm font-black text-text-primary flex items-center gap-1.5">
                  <Fire size={18} className="text-[#EA2C26]" weight="fill" />
                  <span>Manual Streak Repair</span>
                </h3>
                <p className="text-xs text-text-secondary">
                  Adjust consecutive active days for <strong>{selectedUser.display_name || selectedUser.email}</strong>.
                </p>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-text-secondary">New Streak Count (Days):</label>
                  <input
                    type="number"
                    min={0}
                    max={9999}
                    value={newStreakValue}
                    onChange={(e) => setNewStreakValue(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-card border border-border rounded-xl text-sm font-black font-mono text-text-primary focus:outline-none focus:border-[#FBBF24]"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setStreakModalOpen(false)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-text-secondary hover:text-text-primary"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await handleUserAction(selectedUser.id, 'adjust_streak', newStreakValue)
                      setStreakModalOpen(false)
                    }}
                    className="px-4 py-1.5 rounded-xl bg-[#0E0E0E] dark:bg-[#FBBF24] text-white dark:text-[#1A1610] text-xs font-bold shadow-md"
                  >
                    Save Streak
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Grant Badge Modal */}
          {badgeModalOpen && selectedUser && (
            <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-surface border border-border rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
                <h3 className="text-sm font-black text-text-primary flex items-center gap-1.5">
                  <Medal size={18} className="text-[#FBBF24]" weight="fill" />
                  <span>Grant Ministry Badge</span>
                </h3>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-text-secondary">Select Badge:</label>
                  <select
                    value={selectedBadge}
                    onChange={(e) => setSelectedBadge(e.target.value)}
                    className="w-full px-3 py-2 bg-card border border-border rounded-xl text-xs font-bold text-text-primary focus:outline-none focus:border-[#FBBF24]"
                  >
                    <option value="Ministry Leader">Ministry Leader</option>
                    <option value="Verified Pastor">Verified Pastor</option>
                    <option value="Prayer Warrior">Prayer Warrior</option>
                    <option value="Community Moderator">Community Moderator</option>
                    <option value="Core Contributor">Core Contributor</option>
                  </select>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setBadgeModalOpen(false)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-text-secondary hover:text-text-primary"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await handleUserAction(selectedUser.id, 'set_badge', selectedBadge)
                      setBadgeModalOpen(false)
                    }}
                    className="px-4 py-1.5 rounded-xl bg-[#0E0E0E] dark:bg-[#FBBF24] text-white dark:text-[#1A1610] text-xs font-bold shadow-md"
                  >
                    Grant Badge
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: GLOBAL BROADCAST                                                   */}
      {/* ========================================================================= */}
      {activeTab === 'broadcast' && (
        <div className="space-y-5 animate-in fade-in-50 duration-300 max-w-xl">
          <div className="space-y-1">
            <h2 className="text-sm font-black text-text-primary">Send Platform Broadcast Announcement</h2>
            <p className="text-xs text-text-secondary">
              Dispatches an in-app community notification and alert to every registered believer on FaithSync.
            </p>
          </div>

          <form onSubmit={handleSendBroadcast} className="faith-card p-5 bg-card border border-border space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-text-primary">Announcement Title</label>
              <input
                type="text"
                placeholder="e.g. Global 15m Fasting & Prayer Hour"
                value={broadcastTitle}
                onChange={(e) => setBroadcastTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-surface border border-border rounded-xl text-xs text-text-primary focus:outline-none focus:border-[#FBBF24]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-text-primary">Message Body</label>
              <textarea
                rows={4}
                required
                placeholder="Write the message to all believers across the platform..."
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-surface border border-border rounded-xl text-xs text-text-primary focus:outline-none focus:border-[#FBBF24] resize-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-text-primary">Action Link (Optional)</label>
              <input
                type="text"
                placeholder="/square or /clock-in"
                value={broadcastUrl}
                onChange={(e) => setBroadcastUrl(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-surface border border-border rounded-xl text-xs font-mono text-text-primary focus:outline-none focus:border-[#FBBF24]"
              />
            </div>

            {broadcastResult && (
              <div
                className={`p-3 rounded-xl text-xs font-bold ${
                  broadcastResult.startsWith('Error')
                    ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                }`}
              >
                {broadcastResult}
              </div>
            )}

            <button
              type="submit"
              disabled={broadcasting || !broadcastMessage.trim()}
              className="w-full py-3.5 px-6 rounded-2xl bg-[#0E0E0E] dark:bg-[#FBBF24] text-white dark:text-[#1A1610] font-black text-xs shadow-lg hover:bg-neutral-800 dark:hover:bg-[#F59E0B] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {broadcasting ? (
                <>
                  <CircleNotch size={16} className="animate-spin" />
                  <span>Dispatching to all believers...</span>
                </>
              ) : (
                <>
                  <Megaphone size={16} weight="fill" />
                  <span>Send Platform Announcement</span>
                </>
              )}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
