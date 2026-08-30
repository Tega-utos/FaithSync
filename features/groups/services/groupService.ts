import { createClient } from '@/lib/supabase/client'
import { normalizeCode, generateUnambiguousCode } from '@/lib/utils/syncCodes'

export interface GroupItem {
  id: string
  name: string
  category: string
  church: string
  code?: string
  guidelines?: string
  memberCount: number
  isLive: boolean
  activeTimeToday: string
}

export interface GroupChatMessage {
  id: string
  sender_id: string
  sender_name: string
  sender_initial: string
  content: string
  created_at: string
  message_type?: 'text' | 'clockin_invite' | 'nudge' | 'system'
  meta?: {
    discipline?: 'prayer' | 'study'
    durationMins?: number
    focusText?: string
    startedAt?: string
    scheduledAt?: string
    isScheduled?: boolean
  }
}

export async function fetchGroups(): Promise<GroupItem[]> {
  const supabase = createClient()
  const { data: groups, error } = await supabase
    .from('groups')
    .select(`
      id,
      name,
      category,
      church,
      code,
      guidelines,
      is_private,
      group_members (count)
    `)
    .eq('is_private', false)
    .order('created_at', { ascending: false })

  if (error || !groups) return []

  return groups.map((g: any) => ({
    id: g.id,
    name: g.name,
    category: g.category,
    church: g.church || 'Local Assembly',
    code: g.code || `SYNC-${g.id.slice(0, 6).toUpperCase()}`,
    guidelines: g.guidelines,
    memberCount: g.group_members?.[0]?.count || 1,
    isLive: false,
    activeTimeToday: '30m',
  }))
}

export async function fetchGroupById(groupId: string): Promise<GroupItem | null> {
  const supabase = createClient()
  const { data: g, error } = await supabase
    .from('groups')
    .select(`
      id,
      name,
      category,
      church,
      code,
      guidelines,
      is_private,
      group_members (count)
    `)
    .eq('id', groupId)
    .maybeSingle()

  if (error || !g) return null

  return {
    id: g.id,
    name: g.name,
    category: g.category,
    church: g.church || 'Local Assembly',
    code: g.code || `SYNC-${g.id.slice(0, 6).toUpperCase()}`,
    guidelines: g.guidelines || undefined,
    memberCount: (g as any).group_members?.[0]?.count || 1,
    isLive: false,
    activeTimeToday: '30m',
  }
}

export async function createGroup(data: {
  name: string
  category: string
  church?: string
  guidelines?: string
  is_private?: boolean
}): Promise<{ id: string; code: string } | null> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  // Generate unambiguous 6-character group sync code
  const randomSuffix = generateUnambiguousCode(6, '')
  const generatedCode = `SYNC-${randomSuffix}`

  const insertPayload: any = {
    name: data.name,
    category: data.category,
    church: data.church || 'Local Assembly',
    code: generatedCode,
    invite_code: generatedCode,
    guidelines: data.guidelines || null,
    is_private: data.is_private || false,
    created_by: user.id,
  }

  const { data: newGroup, error } = await (supabase
    .from('groups') as any)
    .insert(insertPayload)
    .select('id, code, invite_code')
    .single()

  if (error || !newGroup) {
    console.error('Group create error:', error)
    return null
  }

  // Add creator as owner
  await (supabase.from('group_members') as any).insert({
    group_id: newGroup.id,
    user_id: user.id,
    role: 'owner',
  })

  return { id: newGroup.id, code: newGroup.invite_code || newGroup.code || generatedCode }
}

export async function joinGroupByCode(rawCode: string): Promise<{ success: boolean; group?: GroupItem; error?: string }> {
  const normalized = normalizeCode(rawCode)
  if (!normalized) return { success: false, error: 'Please enter a group sync code.' }

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { success: false, error: 'Please sign in first.' }

  try {
    const cleanCore = normalized.replace(/^(SYNC|GRP)[-_]?/, '')
    const possibleCodes = [
      normalized,
      cleanCore,
      `SYNC-${cleanCore}`,
      `SYNC${cleanCore}`,
      `GRP-${cleanCore}`,
      `GRP${cleanCore}`,
    ]

    // Search by invite_code or code
    let { data: group } = await (supabase
      .from('groups') as any)
      .select('*')
      .or(`invite_code.in.(${possibleCodes.join(',')}),code.in.(${possibleCodes.join(',')})`)
      .maybeSingle()

    if (!group) {
      // Fallback search with ilike
      const { data: fallbackGroup } = await (supabase
        .from('groups') as any)
        .select('*')
        .or(`invite_code.ilike.%${cleanCore}%,code.ilike.%${cleanCore}%`)
        .maybeSingle()
      group = fallbackGroup
    }

    if (!group) {
      return { success: false, error: 'No group found matching this Sync Code. Please verify the code.' }
    }

    // Join the group member table
    await (supabase.from('group_members') as any).upsert(
      {
        group_id: group.id,
        user_id: user.id,
        role: 'member',
      },
      { onConflict: 'group_id,user_id' }
    )

    return {
      success: true,
      group: {
        id: group.id,
        name: group.name,
        category: group.category,
        church: group.church || 'Local Assembly',
        code: group.invite_code || group.code,
        memberCount: 1,
        isLive: false,
        activeTimeToday: '0m',
      },
    }
  } catch (err: any) {
    console.error('joinGroupByCode fatal error:', err)
    return { success: false, error: err?.message || 'Failed to join group.' }
  }
}

export async function fetchGroupMessages(groupId: string): Promise<GroupChatMessage[]> {
  const supabase = createClient()

  const { data: messages, error } = await (supabase
    .from('group_messages') as any)
    .select(`
      id,
      sender_id,
      content,
      message_type,
      meta,
      created_at
    `)
    .eq('group_id', groupId)
    .order('created_at', { ascending: true })

  if (error || !messages) return []

  const senderIds = Array.from(new Set(messages.map((m: any) => m.sender_id))).filter(Boolean) as string[]
  const profileMap: Record<string, string> = {}

  if (senderIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, username')
      .in('id', senderIds)

    ;(profiles || []).forEach((p) => {
      profileMap[p.id] = p.display_name || p.username || 'Member'
    })
  }

  return messages.map((m: any) => {
    const pName = profileMap[m.sender_id] || 'Member'
    return {
      id: m.id,
      sender_id: m.sender_id,
      sender_name: pName,
      sender_initial: pName.charAt(0).toUpperCase(),
      content: m.content,
      created_at: m.created_at,
      message_type: m.message_type,
      meta: m.meta,
    }
  })
}

export async function sendGroupMessage(
  groupId: string,
  content: string,
  messageType: string = 'text',
  meta?: any
): Promise<GroupChatMessage | null> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: newMsg, error } = await (supabase
    .from('group_messages') as any)
    .insert({
      group_id: groupId,
      sender_id: user.id,
      content,
      message_type: messageType,
      meta: meta || null,
    })
    .select('*')
    .single()

  if (error || !newMsg) return null

  const pName = user.user_metadata?.full_name || user.user_metadata?.display_name || 'Me'
  return {
    id: newMsg.id,
    sender_id: newMsg.sender_id,
    sender_name: pName,
    sender_initial: pName.charAt(0).toUpperCase(),
    content: newMsg.content,
    created_at: newMsg.created_at,
    message_type: newMsg.message_type,
    meta: newMsg.meta,
  }
}
