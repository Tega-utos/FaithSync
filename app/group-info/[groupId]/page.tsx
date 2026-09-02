'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  CaretLeft,
  Users,
  Copy,
  Check,
  ShieldCheck,
  BookOpen,
  SignOut,
  Bell,
  Sparkle,
  MapPin,
  Church,
  Crown,
  ShareNetwork,
  UserPlus,
} from '@phosphor-icons/react'
import { createClient } from '@/lib/supabase/client'
import { fetchGroupById } from '@/features/groups/services/groupService'
import { shareOrCopyCode } from '@/lib/utils/syncCodes'

interface GroupMember {
  id: string
  name: string
  initial: string
  role: 'admin' | 'member'
  avatarUrl?: string | null
  streakDays: number
}

export default function GroupInfoPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const groupId = params?.groupId as string

  const isPreview = searchParams.get('preview') === 'true'

  const [group, setGroup] = useState({
    id: (groupId as string) || '',
    name: 'Group Fellowship',
    category: 'Bible Study',
    church: 'Local Assembly',
    rules: 'Keep all conversations uplifting and focused on Scripture. Encourage daily consistency.',
    inviteCode: '',
    isPrivate: false,
    memberCount: 1,
  })

  const [members, setMembers] = useState<GroupMember[]>([])
  const [copied, setCopied] = useState(false)
  const [isMember, setIsMember] = useState(!isPreview)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isEditingRules, setIsEditingRules] = useState(false)
  const [tempRules, setTempRules] = useState('')

  useEffect(() => {
    async function loadGroupData() {
      if (!groupId) return
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const { data: grpData } = await (supabase
        .from('groups') as any)
        .select(`
          id,
          name,
          category,
          church,
          code,
          invite_code,
          guidelines,
          is_private,
          created_by,
          group_members (count)
        `)
        .eq('id', groupId)
        .maybeSingle()

      const isCreator = Boolean(user && grpData?.created_by === user.id)

      if (grpData) {
        setGroup({
          id: grpData.id,
          name: grpData.name,
          category: grpData.category,
          church: grpData.church || 'Local Assembly',
          rules: grpData.guidelines || 'Keep conversations uplifting. Clock in together regularly.',
          memberCount: grpData.group_members?.[0]?.count || 1,
          inviteCode: grpData.invite_code || grpData.code || `SYNC-${grpData.id.slice(0, 6).toUpperCase()}`,
          isPrivate: grpData.is_private || false,
        })
      }

      // Fetch Real Members
      try {
        const { data: memberRows } = await (supabase
          .from('group_members') as any)
          .select(`
            id,
            role,
            user_id,
            user_profile:profiles!group_members_user_id_fkey(id, display_name, avatar_url)
          `)
          .eq('group_id', groupId)

        if (memberRows && memberRows.length > 0) {
          const loadedMembers: GroupMember[] = memberRows.map((m: any) => {
            const pName = m.user_profile?.display_name || 'Believer'
            const isThisUserCreator = grpData?.created_by === m.user_id
            return {
              id: m.user_id,
              name: pName,
              initial: pName.charAt(0).toUpperCase(),
              role: isThisUserCreator || m.role === 'owner' || m.role === 'admin' ? 'admin' : 'member',
              avatarUrl: m.user_profile?.avatar_url || null,
              streakDays: 0,
            }
          })
          setMembers(loadedMembers)

          if (user) {
            const myMembership = memberRows.find((m: any) => m.user_id === user.id)
            if (myMembership || isCreator) {
              setIsMember(true)
              setIsAdmin(isCreator || myMembership?.role === 'owner' || myMembership?.role === 'admin')
            }
          }
        } else if (user) {
          setMembers([
            {
              id: user.id,
              name: user.user_metadata?.full_name || 'Me',
              initial: (user.user_metadata?.full_name || 'M').charAt(0).toUpperCase(),
              role: 'admin',
              streakDays: 0,
            },
          ])
          setIsMember(true)
          setIsAdmin(true)
        }
      } catch (err) {
        console.error('Error loading real group members:', err)
      }
    }
    loadGroupData()
  }, [groupId])

  const handleCopy = async () => {
    await shareOrCopyCode({
      code: group.inviteCode,
      title: `Join ${group.name} on FaithSync`,
      text: `Join our group ${group.name} on FaithSync using invite code: ${group.inviteCode}`,
    })
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleShare = async () => {
    await shareOrCopyCode({
      code: group.inviteCode,
      title: `Join ${group.name} on FaithSync`,
      text: `Join our group ${group.name} on FaithSync using invite code: ${group.inviteCode}`,
    })
  }

  const handleJoinGroup = async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      await (supabase.from('group_members') as any).upsert({
        group_id: groupId,
        user_id: user.id,
        role: 'member',
      })
    }
    setIsMember(true)
    router.push(`/group-chat/${groupId}`)
  }

  const handleSaveRules = async () => {
    if (tempRules.trim()) {
      setGroup((prev) => ({ ...prev, rules: tempRules.trim() }))
      const supabase = createClient()
      await (supabase.from('groups') as any)
        .update({ guidelines: tempRules.trim() })
        .eq('id', groupId)
    }
    setIsEditingRules(false)
  }

  const handleKickMember = async (memberId: string) => {
    setMembers((prev) => prev.filter((m) => m.id !== memberId))
    setGroup((prev) => ({ ...prev, memberCount: Math.max(1, prev.memberCount - 1) }))
    const supabase = createClient()
    await (supabase.from('group_members') as any)
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', memberId)
  }

  const handleToggleAdminRole = async (memberId: string, currentRole: 'admin' | 'member') => {
    const nextRole = currentRole === 'admin' ? 'member' : 'admin'
    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, role: nextRole } : m))
    )
    const supabase = createClient()
    await (supabase.from('group_members') as any)
      .update({ role: nextRole })
      .eq('group_id', groupId)
      .eq('user_id', memberId)
  }

  const handleLeaveGroup = async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      await (supabase.from('group_members') as any)
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', user.id)
    }
    setIsMember(false)
    router.push('/sync')
  }

  return (
    <div className="command-center-container px-4 sm:px-6 pt-3 pb-32 min-h-[92vh] space-y-5">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <button
          type="button"
          onClick={() => router.back()}
          className="p-2 rounded-xl text-text-secondary hover:text-text-primary hover:bg-subtle/50 transition-colors flex items-center gap-1 text-xs font-bold"
        >
          <CaretLeft size={18} />
          <span>Back</span>
        </button>

        <h1 className="text-sm font-extrabold text-text-primary">Group Profile</h1>
        <div className="w-8" />
      </div>

      {/* A. The Identity Section */}
      <div className="faith-card p-6 text-center space-y-3 bg-card border border-border">
        {/* Massive Centered Group Avatar */}
        <div className="relative flex items-center justify-center mx-auto">
          <div className="w-20 h-20 rounded-full bg-[#0E0E0E] text-white flex items-center justify-center text-2xl font-black border-4 border-white shadow-xl ring-2 ring-[#FBBF24]/40">
            <Users size={36} className="text-[#FBBF24]" />
          </div>
        </div>

        {/* Group Name in Large Bold Text */}
        <div className="space-y-1">
          <h2 className="text-xl font-black text-text-primary tracking-tight">{group.name}</h2>
          <div className="flex items-center justify-center gap-2 text-xs font-bold text-text-secondary">
            <span>{group.category}</span>
            <span>•</span>
            <span className="flex items-center gap-1 text-text-primary">
              <MapPin size={13} weight="fill" className="text-[#EA2C26]" />
              <span>{group.church}</span>
            </span>
          </div>
        </div>

        <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-surface border border-border text-[11px] font-bold text-text-primary">
          <Users size={13} className="text-[#FBBF24]" />
          <span>{group.memberCount} members active</span>
        </div>
      </div>

      {/* B. Group Guidelines */}
      <div className="faith-card p-5 space-y-2 bg-subtle/70 border border-border">
        {/* Guidelines Header with Admin Edit Button */}
        <div className="flex items-center justify-between text-text-primary">
          <div className="flex items-center gap-1.5">
            <ShieldCheck size={16} className="text-[#FBBF24]" />
            <span className="text-[11px] font-black uppercase tracking-wider">
              Group Guidelines
            </span>
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                setTempRules(group.rules)
                setIsEditingRules(true)
              }}
              className="text-[10px] font-bold text-[#FBBF24] hover:underline"
            >
              Edit Guidelines
            </button>
          )}
        </div>
        <p className="text-xs text-text-primary leading-relaxed italic">
          &ldquo;{group.rules}&rdquo;
        </p>
      </div>

      {/* C. The Members Roster */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary block">
            Members Roster ({members.length})
          </span>
        </div>

        <div className="space-y-2">
          {members.map((member) => (
            <div
              key={member.id}
              className="faith-card p-3.5 flex items-center justify-between bg-card border border-border"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#0E0E0E] text-white text-xs font-black flex items-center justify-center shadow-xs">
                  {member.initial}
                </div>

                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-black text-text-primary">{member.name}</p>
                    {/* The Gold Pill Badge for Admins */}
                    {member.role === 'admin' && (
                      <span className="px-2 py-0.5 rounded-full bg-[#FDF9F1] border border-[#FBBF24]/60 text-[#B45309] text-[9px] font-black uppercase flex items-center gap-0.5">
                        <Crown size={10} weight="fill" className="text-[#FBBF24]" />
                        ADMIN
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-text-secondary font-mono-tabular">
                    {member.streakDays}d Streak
                  </span>
                </div>
              </div>

              {/* Admin Authority: Promote/Demote and Kick abusive members */}
              {isAdmin && member.id !== group.id && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleToggleAdminRole(member.id, member.role)}
                    className={`px-2 py-1 rounded-xl text-[10px] font-bold border transition-colors ${
                      member.role === 'admin'
                        ? 'bg-amber-50 border-[#FBBF24]/50 text-[#B45309] hover:bg-amber-100'
                        : 'bg-gray-50 border-border text-text-secondary hover:bg-subtle'
                    }`}
                    title={member.role === 'admin' ? 'Demote from Admin' : 'Make Co-Admin'}
                  >
                    {member.role === 'admin' ? 'Demote' : '+ Admin'}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleKickMember(member.id)}
                    className="px-2 py-1 rounded-xl text-[10px] font-bold text-[#EA2C26] bg-[#FFF0F0] border border-[#EA2C26]/20 hover:bg-[#EA2C26] hover:text-white transition-colors"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* D. The Sticky Action Footer */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-card/90 backdrop-blur-md border-t border-border z-30 flex items-center justify-center max-w-md mx-auto">
        {isMember ? (
          <div className="w-full flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="flex-1 py-3.5 px-4 rounded-2xl bg-[#0E0E0E] text-white font-black text-xs shadow-md hover:bg-[#262626] active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              {copied ? (
                <>
                  <Check size={16} weight="bold" className="text-emerald-400" />
                  <span>Code Copied! ✓</span>
                </>
              ) : (
                <>
                  <Copy size={16} className="text-[#FBBF24]" />
                  <span>Copy Invite Code ({group.inviteCode})</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleShare}
              className="p-3.5 rounded-2xl bg-[#FDF9F1] border border-[#FBBF24]/40 text-text-primary hover:bg-[#FBBF24] hover:text-white transition-all shadow-xs"
              title="Share Group Invite"
            >
              <ShareNetwork size={18} />
            </button>

            {!isAdmin && (
              <button
                type="button"
                onClick={handleLeaveGroup}
                className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-[#EA2C26] hover:bg-rose-100 transition-all shadow-xs"
                title="Leave Group"
              >
                <SignOut size={18} />
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={handleJoinGroup}
            className="w-full py-4 px-6 rounded-2xl bg-[#FBBF24] text-text-primary font-black text-sm shadow-lg hover:bg-[#F59E0B] active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <UserPlus size={18} weight="bold" />
            <span>Join Group</span>
          </button>
        )}
      </div>

      {/* Edit Guidelines Modal (Admin Only) */}
      {isEditingRules && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-surface border border-border rounded-3xl p-5 space-y-3 shadow-2xl animate-in zoom-in-95">
            <h3 className="text-xs font-black text-text-primary">Edit Group Guidelines</h3>
            <textarea
              rows={4}
              value={tempRules}
              onChange={(e) => setTempRules(e.target.value)}
              className="w-full p-3 bg-card border border-border rounded-2xl text-xs text-text-primary focus:outline-none focus:border-[#FBBF24]"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsEditingRules(false)}
                className="flex-1 py-2.5 rounded-xl border border-border text-xs font-bold text-text-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveRules}
                className="flex-1 py-2.5 rounded-xl bg-[#0E0E0E] text-white text-xs font-bold"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
