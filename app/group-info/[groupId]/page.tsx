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
    name: 'Friday Morning Bible Study',
    category: 'Community Group',
    church: 'Elevation Church',
    rules:
      'Keep all conversations uplifting and focused on Scripture. Respect everyone’s prayer requests and privacy, and encourage daily habit consistency.',
    inviteCode: 'SYNC-7721',
    isPrivate: true,
    memberCount: 12,
  })

  const [members, setMembers] = useState<GroupMember[]>([
    { id: 'm-1', name: 'Sarah Gold', initial: 'S', role: 'admin', streakDays: 24 },
    { id: 'm-2', name: 'Pastor David', initial: 'D', role: 'member', streakDays: 31 },
    { id: 'm-3', name: 'Hannah Grace', initial: 'H', role: 'member', streakDays: 14 },
    { id: 'm-4', name: 'Emmanuel Vance', initial: 'E', role: 'member', streakDays: 7 },
    { id: 'm-5', name: 'John Mark', initial: 'J', role: 'member', streakDays: 19 },
    { id: 'm-6', name: 'Deborah K.', initial: 'D', role: 'member', streakDays: 12 },
  ])

  const [copied, setCopied] = useState(false)
  const [isMember, setIsMember] = useState(!isPreview)
  const [isAdmin, setIsAdmin] = useState(true)
  const [isEditingRules, setIsEditingRules] = useState(false)
  const [tempRules, setTempRules] = useState('')

  useEffect(() => {
    async function loadGroupData() {
      if (!groupId) return
      const realGroup = await fetchGroupById(groupId)
      if (realGroup) {
        setGroup({
          id: realGroup.id,
          name: realGroup.name,
          category: realGroup.category,
          church: realGroup.church,
          rules: realGroup.guidelines || 'Daily Clock-in • Respect Fellow Members',
          memberCount: realGroup.memberCount || 1,
          inviteCode: realGroup.code || `SYNC-${realGroup.id.slice(0, 6).toUpperCase()}`,
          isPrivate: true,
        })
      } else {
        const stored = localStorage.getItem(`fs_group_${groupId}`)
        if (stored) {
          try {
            setGroup(JSON.parse(stored))
          } catch {}
        }
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

  const handleJoinGroup = () => {
    setIsMember(true)
    router.push(`/group-chat/${groupId}`)
  }

  const handleSaveRules = () => {
    if (tempRules.trim()) {
      setGroup((prev) => {
        const next = { ...prev, rules: tempRules.trim() }
        localStorage.setItem(`fs_group_${groupId}`, JSON.stringify(next))
        return next
      })
    }
    setIsEditingRules(false)
  }

  const handleKickMember = (memberId: string) => {
    setMembers((prev) => prev.filter((m) => m.id !== memberId))
    setGroup((prev) => ({ ...prev, memberCount: Math.max(1, prev.memberCount - 1) }))
  }

  const handleLeaveGroup = () => {
    setIsMember(false)
    router.push('/sync')
  }

  return (
    <div className="command-center-container px-4 sm:px-6 pt-3 pb-32 min-h-[92vh] space-y-5">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-2 border-b border-[#E5E7EB]">
        <button
          type="button"
          onClick={() => router.back()}
          className="p-2 rounded-xl text-[#707070] hover:text-[#0E0E0E] hover:bg-[#F3F4F6]/50 transition-colors flex items-center gap-1 text-xs font-bold"
        >
          <CaretLeft size={18} />
          <span>Back</span>
        </button>

        <h1 className="text-sm font-extrabold text-[#0E0E0E]">Group Profile</h1>
        <div className="w-8" />
      </div>

      {/* A. The Identity Section */}
      <div className="faith-card p-6 text-center space-y-3 bg-white border border-[#E5E7EB]">
        {/* Massive Centered Group Avatar */}
        <div className="relative flex items-center justify-center mx-auto">
          <div className="w-20 h-20 rounded-full bg-[#0E0E0E] text-white flex items-center justify-center text-2xl font-black border-4 border-white shadow-xl ring-2 ring-[#FBBF24]/40">
            <Users size={36} className="text-[#FBBF24]" />
          </div>
        </div>

        {/* Group Name in Large Bold Text */}
        <div className="space-y-1">
          <h2 className="text-xl font-black text-[#0E0E0E] tracking-tight">{group.name}</h2>
          <div className="flex items-center justify-center gap-2 text-xs font-bold text-[#707070]">
            <span>{group.category}</span>
            <span>•</span>
            <span className="flex items-center gap-1 text-[#0E0E0E]">
              <MapPin size={13} weight="fill" className="text-[#EA2C26]" />
              <span>{group.church}</span>
            </span>
          </div>
        </div>

        <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#FAF6EE] border border-[#E5E7EB] text-[11px] font-bold text-[#0E0E0E]">
          <Users size={13} className="text-[#FBBF24]" />
          <span>{group.memberCount} members active</span>
        </div>
      </div>

      {/* B. Group Guidelines */}
      <div className="faith-card p-5 space-y-2 bg-[#F3F4F6]/70 border border-[#E5E7EB]">
        {/* Guidelines Header with Admin Edit Button */}
        <div className="flex items-center justify-between text-[#0E0E0E]">
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
        <p className="text-xs text-[#374151] leading-relaxed italic">
          &ldquo;{group.rules}&rdquo;
        </p>
      </div>

      {/* C. The Members Roster */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#707070] block">
            Members Roster ({members.length})
          </span>
        </div>

        <div className="space-y-2">
          {members.map((member) => (
            <div
              key={member.id}
              className="faith-card p-3.5 flex items-center justify-between bg-white border border-[#E5E7EB]"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#0E0E0E] text-white text-xs font-black flex items-center justify-center shadow-xs">
                  {member.initial}
                </div>

                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-black text-[#0E0E0E]">{member.name}</p>
                    {/* The Gold Pill Badge for Admins */}
                    {member.role === 'admin' && (
                      <span className="px-2 py-0.5 rounded-full bg-[#FDF9F1] border border-[#FBBF24]/60 text-[#B45309] text-[9px] font-black uppercase flex items-center gap-0.5">
                        <Crown size={10} weight="fill" className="text-[#FBBF24]" />
                        ADMIN
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-[#707070] font-mono-tabular">
                    {member.streakDays}d Streak
                  </span>
                </div>
              </div>

              {/* Admin Authority: Kick abusive members */}
              {isAdmin && member.role !== 'admin' && (
                <button
                  type="button"
                  onClick={() => handleKickMember(member.id)}
                  className="px-2.5 py-1 rounded-xl text-[10px] font-bold text-[#EA2C26] bg-[#FFF0F0] border border-[#EA2C26]/20 hover:bg-[#EA2C26] hover:text-white transition-colors"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* D. The Sticky Action Footer */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-md border-t border-[#E5E7EB] z-30 flex items-center justify-center max-w-md mx-auto">
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
              className="p-3.5 rounded-2xl bg-[#FDF9F1] border border-[#FBBF24]/40 text-[#0E0E0E] hover:bg-[#FBBF24] hover:text-white transition-all shadow-xs"
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
            className="w-full py-4 px-6 rounded-2xl bg-[#FBBF24] text-[#0E0E0E] font-black text-sm shadow-lg hover:bg-[#F59E0B] active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <UserPlus size={18} weight="bold" />
            <span>Join Group</span>
          </button>
        )}
      </div>

      {/* Edit Guidelines Modal (Admin Only) */}
      {isEditingRules && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-[#FAF6EE] border border-[#E5E7EB] rounded-3xl p-5 space-y-3 shadow-2xl animate-in zoom-in-95">
            <h3 className="text-xs font-black text-[#0E0E0E]">Edit Group Guidelines</h3>
            <textarea
              rows={4}
              value={tempRules}
              onChange={(e) => setTempRules(e.target.value)}
              className="w-full p-3 bg-white border border-[#E5E7EB] rounded-2xl text-xs text-[#0E0E0E] focus:outline-none focus:border-[#FBBF24]"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsEditingRules(false)}
                className="flex-1 py-2.5 rounded-xl border border-[#E5E7EB] text-xs font-bold text-[#707070]"
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
