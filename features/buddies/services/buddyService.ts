import { createClient } from '@/lib/supabase/client'
import { normalizeCode } from '@/lib/utils/syncCodes'

export interface BuddyProfile {
  id: string
  displayName: string
  avatarUrl: string | null
  church: string
  buddyCode: string
}

export interface BuddyConnectionItem {
  id: string
  userId: string
  buddyId: string
  status: 'pending' | 'accepted' | 'declined' | 'blocked'
  partnerId: string
  partnerName: string
  partnerInitial: string
  partnerAvatar: string | null
  partnerChurch: string
  partnerBuddyCode: string
  isRequester: boolean
  createdAt: string
}

export interface BuddyChatMessage {
  id: string
  sender_id: string
  sender_name?: string
  sender_initial?: string
  content: string
  created_at: string
  message_type?: 'text' | 'clockin_invite' | 'nudge' | 'prayer_request'
  meta?: {
    discipline?: 'prayer' | 'study'
    durationMins?: number
    focusText?: string
    startedAt?: string
    scheduledAt?: string
    isScheduled?: boolean
  }
}

/**
 * Stage 2: Search user by exact normalized Sync Code with Anti-Solo validation
 */
export async function searchUserBySyncCode(
  code: string,
  currentUserId?: string
): Promise<{ user: BuddyProfile | null; error?: string }> {
  const normalized = normalizeCode(code)
  if (!normalized) {
    return { user: null, error: 'Please enter a Sync Code.' }
  }

  const supabase = createClient()
  const cleanCore = normalized.replace(/^(FS|SYNC)[-_]?/, '')
  const possibleCodes = [
    normalized,
    cleanCore,
    `FS-${cleanCore}`,
    `FS${cleanCore}`,
    `SYNC-${cleanCore}`,
    `SYNC${cleanCore}`,
  ]

  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url, buddy_code')
    .in('buddy_code', possibleCodes)
    .maybeSingle()

  if (error || !data) {
    return { user: null, error: 'No believer found with this Sync Code. Please verify and try again.' }
  }

  if (currentUserId && data.id === currentUserId) {
    return { user: null, error: 'The Anti-Solo Rule: You cannot add yourself as an accountability buddy.' }
  }

  return {
    user: {
      id: data.id,
      displayName: data.display_name || 'A Believer',
      avatarUrl: data.avatar_url,
      church: 'Local Assembly',
      buddyCode: data.buddy_code || normalized,
    },
  }
}

/**
 * Stage 3: Send a buddy request by code via server API (bypasses any client RLS restrictions)
 */
export async function sendBuddyCodeConnect(
  code: string
): Promise<{ success: boolean; status?: 'pending' | 'accepted'; message?: string; error?: string }> {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const userId = session?.user?.id

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`
    }

    const res = await fetch('/api/buddy/connect', {
      method: 'POST',
      headers,
      body: JSON.stringify({ code, userId }),
    })
    const data = await res.json()
    if (!res.ok) {
      return { success: false, error: data.error || 'Failed to connect with buddy.' }
    }
    return { success: true, status: data.status, message: data.message }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error while adding buddy.' }
  }
}

/**
 * Stage 3: Send a buddy request by User ID or auto-accept if mutual request exists
 */
export async function sendBuddyRequest(
  targetUserId: string,
  currentUserId: string
): Promise<{ success: boolean; status: 'pending' | 'accepted'; connectionId?: string; error?: string }> {
  if (targetUserId === currentUserId) {
    return { success: false, status: 'pending', error: 'You cannot connect with yourself.' }
  }

  const supabase = createClient()

  // 1. Check existing connection between the two users
  const { data: existing } = await supabase
    .from('buddies')
    .select('id, user_id, buddy_id, status')
    .or(`and(user_id.eq.${currentUserId},buddy_id.eq.${targetUserId}),and(user_id.eq.${targetUserId},buddy_id.eq.${currentUserId})`)
    .maybeSingle()

  if (existing) {
    if (existing.status === 'accepted') {
      return { success: true, status: 'accepted', connectionId: existing.id }
    }

    // If target previously sent request to current user, auto-approve!
    if (existing.status === 'pending' && existing.user_id === targetUserId) {
      const { error: updateErr } = await supabase
        .from('buddies')
        .update({ status: 'accepted' })
        .eq('id', existing.id)

      if (!updateErr) {
        return { success: true, status: 'accepted', connectionId: existing.id }
      }
    }

    return { success: true, status: 'pending', connectionId: existing.id }
  }

  // 2. Insert new pending buddy request
  const { data: inserted, error: insertErr } = await supabase
    .from('buddies')
    .insert({
      user_id: currentUserId,
      buddy_id: targetUserId,
      status: 'pending',
      permissions: {
        canInviteToClockIn: true,
        sendNotificationOnStart: true,
        shareHistory: true,
      },
    })
    .select('id, status')
    .single()

  if (insertErr || !inserted) {
    console.error('Failed to insert buddy request:', insertErr)
    return { success: false, status: 'pending', error: insertErr?.message || 'Failed to send buddy request.' }
  }

  // 3. Dispatch notification to target user
  try {
    const { data: senderProf } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', currentUserId)
      .single()

    const senderName = senderProf?.display_name || 'A Believer'
    await supabase.from('notifications').insert({
      user_id: targetUserId,
      sender_id: currentUserId,
      type: 'buddy_request',
      title: 'New Buddy Request',
      text: `**${senderName}** sent you an accountability buddy request!`,
      route_url: '/sync',
    })
  } catch (notifErr) {
    console.error('Notification dispatch error (non-fatal):', notifErr)
  }

  return { success: true, status: 'pending', connectionId: inserted.id }
}

/**
 * Stage 5: Approve an incoming buddy request
 */
export async function approveBuddyRequest(
  connectionId: string,
  currentUserId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`
    }

    const res = await fetch('/api/buddy/approve', {
      method: 'POST',
      headers,
      body: JSON.stringify({ connectionId, userId: currentUserId }),
    })
    const data = await res.json()
    if (res.ok && data.success) {
      return { success: true }
    }
  } catch {}

  // Fallback direct update
  const { data: updated, error } = await supabase
    .from('buddies')
    .update({ status: 'accepted' })
    .eq('id', connectionId)
    .select('id, user_id, buddy_id')
    .single()

  if (error || !updated) {
    console.error('Approve buddy error:', error)
    return { success: false, error: error?.message || 'Failed to approve buddy request.' }
  }

  // Ensure buddy_chats conversation exists
  try {
    const { data: existingChat } = await supabase
      .from('buddy_chats')
      .select('id')
      .eq('buddy_connection_id', connectionId)
      .maybeSingle()

    if (!existingChat) {
      await supabase.from('buddy_chats').insert({
        buddy_connection_id: connectionId,
      })
    }
  } catch (chatErr) {
    console.error('Chat creation error:', chatErr)
  }

  return { success: true }
}

/**
 * Reject or delete a buddy request/connection
 */
export async function deleteBuddyConnection(
  connectionId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient()
  const { error } = await supabase.from('buddies').delete().eq('id', connectionId)
  if (error) {
    return { success: false, error: error.message }
  }
  return { success: true }
}

/**
 * Stage 6: Get all buddy relationships (both incoming pending & accepted active)
 */
export async function getMyBuddies(currentUserId: string): Promise<{
  active: BuddyConnectionItem[]
  pendingIncoming: BuddyConnectionItem[]
  pendingOutgoing: BuddyConnectionItem[]
}> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('buddies')
    .select(`
      id,
      user_id,
      buddy_id,
      status,
      created_at,
      user_profile:profiles!buddies_user_id_fkey(display_name, avatar_url, buddy_code),
      buddy_profile:profiles!buddies_buddy_id_fkey(display_name, avatar_url, buddy_code)
    `)
    .or(`user_id.eq.${currentUserId},buddy_id.eq.${currentUserId}`)
    .order('created_at', { ascending: false })

  if (error || !data) {
    console.error('getMyBuddies error:', error)
    return { active: [], pendingIncoming: [], pendingOutgoing: [] }
  }

  const active: BuddyConnectionItem[] = []
  const pendingIncoming: BuddyConnectionItem[] = []
  const pendingOutgoing: BuddyConnectionItem[] = []

  data.forEach((row: any) => {
    const isRequester = row.user_id === currentUserId
    const partner = isRequester ? row.buddy_profile : row.user_profile
    const partnerId = isRequester ? row.buddy_id : row.user_id
    const partnerName = partner?.display_name || 'A Believer'

    const item: BuddyConnectionItem = {
      id: row.id,
      userId: row.user_id,
      buddyId: row.buddy_id,
      status: row.status,
      partnerId,
      partnerName,
      partnerInitial: partnerName.charAt(0).toUpperCase(),
      partnerAvatar: partner?.avatar_url || null,
      partnerChurch: partner?.church || 'Local Assembly',
      partnerBuddyCode: partner?.buddy_code || '',
      isRequester,
      createdAt: row.created_at,
    }

    if (row.status === 'accepted') {
      active.push(item)
    } else if (row.status === 'pending') {
      if (isRequester) {
        pendingOutgoing.push(item)
      } else {
        pendingIncoming.push(item)
      }
    }
  })

  return { active, pendingIncoming, pendingOutgoing }
}

/**
 * Real-time subscription to automatically refresh buddy state on changes
 */
export function subscribeToBuddyUpdates(
  currentUserId: string,
  onChange: () => void
): () => void {
  const supabase = createClient()
  const channel = supabase
    .channel(`buddies_realtime_${currentUserId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'buddies',
      },
      (payload) => {
        const record = (payload.new || payload.old) as any
        if (record && (record.user_id === currentUserId || record.buddy_id === currentUserId)) {
          onChange()
        }
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

/**
 * Real-time Chat Functions
 */
export async function fetchBuddyMessages(buddyId: string, currentUserId: string): Promise<BuddyChatMessage[]> {
  const supabase = createClient()

  // 1. Fetch messages matching sender/recipient pair
  const { data: messages, error } = await supabase
    .from('messages')
    .select('*')
    .or(
      `and(sender_id.eq.${currentUserId},recipient_id.eq.${buddyId}),and(sender_id.eq.${buddyId},recipient_id.eq.${currentUserId})`
    )
    .order('created_at', { ascending: true })

  if (error || !messages) return []

  return (messages || []).map((m: any) => ({
    id: m.id,
    sender_id: m.sender_id,
    content: m.content,
    message_type: m.message_type as any,
    meta: m.meta,
    created_at: m.created_at,
  }))
}

export async function sendBuddyMessage(
  buddyId: string,
  currentUserId: string,
  content: string,
  messageType: string = 'text',
  meta?: any
): Promise<BuddyChatMessage | null> {
  const supabase = createClient()

  const { data: newMsg, error } = await supabase
    .from('messages')
    .insert({
      sender_id: currentUserId,
      recipient_id: buddyId,
      content,
      message_type: messageType,
      meta: meta || null,
    })
    .select('*')
    .single()

  if (error || !newMsg) {
    console.error('Failed to send buddy message:', error)
    return null
  }

  // Dispatch in-app notification to buddy
  try {
    const { data: senderProf } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', currentUserId)
      .single()

    const sName = senderProf?.display_name || 'Accountability Buddy'
    await (supabase.from('notifications') as any).insert({
      user_id: buddyId,
      sender_id: currentUserId,
      type: messageType === 'nudge' ? 'nudge' : 'system',
      title: sName,
      text: content.trim().slice(0, 80),
      route_url: `/buddy-chat/${currentUserId}`,
      icon_type: messageType === 'nudge' ? 'hand_waving' : 'quotes',
    })
  } catch {}

  return {
    id: newMsg.id,
    sender_id: newMsg.sender_id,
    content: newMsg.content,
    message_type: newMsg.message_type as any,
    meta: (newMsg as any).meta,
    created_at: newMsg.created_at,
  }
}
