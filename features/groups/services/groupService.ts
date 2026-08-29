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

  // Generate unambiguous code from database RPC if available, or generate client fallback
  let generatedCode = ''
  try {
    const { data: rpcCode } = await (supabase.rpc as any)('generate_unique_code', {
      target_table: 'groups',
      target_column: 'code',
      code_length: 6,
      code_prefix: 'SYNC-',
    })
    if (rpcCode) generatedCode = rpcCode
  } catch {}

  if (!generatedCode) {
    generatedCode = generateUnambiguousCode(6, 'SYNC-')
  }

  const { data: newGroup, error } = await (supabase
    .from('groups') as any)
    .insert({
      name: data.name,
      category: data.category,
      church: data.church || null,
      code: generatedCode,
      guidelines: data.guidelines || null,
      is_private: data.is_private || false,
      created_by: user.id,
    })
    .select('id, code')
    .single()

  if (error || !newGroup) {
    // If table doesn't have code column yet, insert without code
    const { data: fallbackGroup } = await (supabase
      .from('groups') as any)
      .insert({
        name: data.name,
        category: data.category,
        church: data.church || null,
        guidelines: data.guidelines || null,
        is_private: data.is_private || false,
        created_by: user.id,
      })
      .select('id')
      .single()

    if (!fallbackGroup) return null

    await (supabase.from('group_members') as any).insert({
      group_id: fallbackGroup.id,
      user_id: user.id,
      role: 'owner',
    })

    return { id: fallbackGroup.id, code: generatedCode }
  }

  await (supabase.from('group_members') as any).insert({
    group_id: newGroup.id,
    user_id: user.id,
    role: 'owner',
  })

  return { id: newGroup.id, code: newGroup.code || generatedCode }
}

export async function joinGroupByCode(rawCode: string): Promise<{ success: boolean; group?: GroupItem; error?: string }> {
  const normalized = normalizeCode(rawCode)
  if (!normalized) return { success: false, error: 'Please enter a group code.' }

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { success: false, error: 'Please sign in first.' }

  try {
    // Search by code or formatted code or ID prefix
    let { data: group } = await supabase
      .from('groups')
      .select('*')
      .eq('code', normalized)
      .maybeSingle()

    if (!group) {
      // Try without SYNC- prefix or with SYNC- prefix
      const altCode = normalized.startsWith('SYNC-') ? normalized.replace('SYNC-', '') : `SYNC-${normalized}`
      const { data: altGroup } = await supabase
        .from('groups')
        .select('*')
        .eq('code', altCode)
        .maybeSingle()
      group = altGroup
    }

    if (!group) {
      return { success: false, error: 'No group found matching this code.' }
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
        code: group.code || normalized,
        memberCount: 1,
        isLive: false,
        activeTimeToday: '0m',
      },
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to join group.' }
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
