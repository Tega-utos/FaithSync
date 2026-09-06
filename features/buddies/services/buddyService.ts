import { createClient } from '@/lib/supabase/client'
import { normalizeCode } from '@/lib/utils/syncCodes'
import { getMemoryCache, setMemoryCache, invalidateMemoryCache } from '@/lib/cache/clientCache'

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
  isOnline?: boolean
  isLiveNow?: boolean
  liveDiscipline?: 'prayer' | 'study'
  lastActive?: string
  lastMessage?: string
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

export async function getMyBuddies(currentUserId: string, forceFresh = false): Promise<{
  active: BuddyConnectionItem[]
  pendingIncoming: BuddyConnectionItem[]
  pendingOutgoing: BuddyConnectionItem[]
}> {
  const cacheKey = `buddies_list_${currentUserId}`
  if (!forceFresh) {
    const cached = getMemoryCache<{
      active: BuddyConnectionItem[]
      pendingIncoming: BuddyConnectionItem[]
      pendingOutgoing: BuddyConnectionItem[]
    }>(cacheKey, 90_000)
    if (cached) return cached
  }

  const supabase = createClient()
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()

  try {
    // 1. Fetch buddy connections
    const { data: buddiesRows, error: buddiesErr } = await supabase
      .from('buddies')
      .select('id, user_id, buddy_id, status, created_at')
      .or(`user_id.eq.${currentUserId},buddy_id.eq.${currentUserId}`)
      .order('created_at', { ascending: false })

    if (buddiesErr || !buddiesRows || buddiesRows.length === 0) {
      if (buddiesErr) console.error('getMyBuddies error:', buddiesErr)
      return { active: [], pendingIncoming: [], pendingOutgoing: [] }
    }

    // 2. Collect unique partner IDs
    const partnerIds = Array.from(
      new Set(
        buddiesRows.map((r: any) => (r.user_id === currentUserId ? r.buddy_id : r.user_id)).filter(Boolean)
      )
    )

    // 3. Fetch partner profiles, active sessions, and live messages in parallel
    const [profilesRes, sessionsRes, messagesRes] = await Promise.all([
      partnerIds.length > 0
        ? supabase.from('profiles').select('id, display_name, avatar_url, buddy_code').in('id', partnerIds)
        : Promise.resolve({ data: [] }),
      supabase
        .from('sessions')
        .select('id, user_id, type, started_at')
        .eq('is_complete', false)
        .gte('started_at', twoHoursAgo),
      supabase
        .from('messages')
        .select('id, sender_id, recipient_id, content, message_type, meta, created_at')
        .eq('message_type', 'clockin_invite')
        .gte('created_at', twoHoursAgo),
    ])

    const profilesMap = new Map<string, any>()
    if (profilesRes.data) {
      profilesRes.data.forEach((p: any) => {
        if (p?.id) profilesMap.set(p.id, p)
      })
    }

    // 4. Build live users map
    const liveUsersMap = new Map<string, { discipline: 'prayer' | 'study'; focusText?: string }>()

    if (sessionsRes.data) {
      sessionsRes.data.forEach((s: any) => {
        if (s.user_id) {
          liveUsersMap.set(s.user_id, {
            discipline: s.type === 'study' ? 'study' : 'prayer',
          })
        }
      })
    }

    if (messagesRes.data) {
      const now = Date.now()
      messagesRes.data.forEach((m: any) => {
        if (m.meta) {
          const startMs = m.meta.startedAt
            ? new Date(m.meta.startedAt).getTime()
            : new Date(m.created_at).getTime()
          const durationMins = Number(m.meta.durationMins) || 15
          if (now < startMs + durationMins * 60 * 1000) {
            if (m.sender_id) {
              liveUsersMap.set(m.sender_id, {
                discipline: m.meta.discipline === 'study' ? 'study' : 'prayer',
                focusText: m.meta.focusText,
              })
            }
          }
        }
      })
    }

    const active: BuddyConnectionItem[] = []
    const pendingIncoming: BuddyConnectionItem[] = []
    const pendingOutgoing: BuddyConnectionItem[] = []

    buddiesRows.forEach((row: any) => {
      const isRequester = row.user_id === currentUserId
      const partnerId = isRequester ? row.buddy_id : row.user_id
      const partner = profilesMap.get(partnerId)
      const partnerName = partner?.display_name || 'A Believer'

      const liveInfo = liveUsersMap.get(partnerId)
      const isLive = Boolean(liveInfo)
      const liveDisc = liveInfo?.discipline || 'prayer'

      const item: BuddyConnectionItem = {
        id: row.id,
        userId: row.user_id,
        buddyId: row.buddy_id,
        status: row.status,
        partnerId,
        partnerName,
        partnerInitial: partnerName.charAt(0).toUpperCase(),
        partnerAvatar: partner?.avatar_url || null,
        partnerChurch: 'Local Assembly',
        partnerBuddyCode: partner?.buddy_code || '',
        isRequester,
        createdAt: row.created_at,
        isOnline: isLive,
        isLiveNow: isLive,
        liveDiscipline: liveDisc,
        lastActive: isLive ? 'Clocked in now' : 'Active today',
        lastMessage: isLive
          ? `🔴 ${liveDisc === 'prayer' ? 'Prayer' : 'Scripture Study'} Clock-In Ongoing • Tap to join!`
          : 'Let’s clock in together!',
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

    const result = { active, pendingIncoming, pendingOutgoing }
    setMemoryCache(cacheKey, result)
    return result
  } catch (err) {
    console.error('getMyBuddies unexpected error:', err)
    return { active: [], pendingIncoming: [], pendingOutgoing: [] }
  }
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
 * Real-time Chat Functions with Persistent Backend & Local Cache
 */
export async function fetchBuddyMessages(buddyId: string, currentUserId: string): Promise<BuddyChatMessage[]> {
  const cacheKey = `faithsync_buddy_msgs_${buddyId}`

  // 1. Try server API route first
  try {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`
    }

    const res = await fetch(`/api/buddy/message?buddyId=${encodeURIComponent(buddyId)}`, {
      method: 'GET',
      headers,
    })

    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data.messages)) {
        const msgs: BuddyChatMessage[] = data.messages.map((m: any) => ({
          id: m.id,
          sender_id: m.sender_id,
          content: m.content,
          message_type: m.message_type as any,
          meta: m.meta,
          created_at: m.created_at,
        }))

        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(cacheKey, JSON.stringify(msgs))
          } catch (_) {}
        }
        return msgs
      }
    }
  } catch (apiErr) {
    console.warn('Buddy messages server fetch note:', apiErr)
  }

  // 2. Direct client query fallback
  try {
    const supabase = createClient()
    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .or(
        `and(sender_id.eq.${currentUserId},recipient_id.eq.${buddyId}),and(sender_id.eq.${buddyId},recipient_id.eq.${currentUserId})`
      )
      .order('created_at', { ascending: true })

    if (!error && Array.isArray(messages)) {
      const msgs: BuddyChatMessage[] = messages.map((m: any) => ({
        id: m.id,
        sender_id: m.sender_id,
        content: m.content,
        message_type: m.message_type as any,
        meta: m.meta,
        created_at: m.created_at,
      }))

      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(cacheKey, JSON.stringify(msgs))
        } catch (_) {}
      }
      return msgs
    }
  } catch (clientErr) {
    console.warn('Buddy messages client fetch note:', clientErr)
  }

  // 3. Return local storage cache if offline or error
  if (typeof window !== 'undefined') {
    try {
      const cached = localStorage.getItem(cacheKey)
      if (cached) {
        return JSON.parse(cached)
      }
    } catch (_) {}
  }

  return []
}

export async function sendBuddyMessage(
  buddyId: string,
  currentUserId: string,
  content: string,
  messageType: string = 'text',
  meta?: any
): Promise<BuddyChatMessage | null> {
  const cacheKey = `faithsync_buddy_msgs_${buddyId}`
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`
  }

  // 1. Try server API route first for authenticated server-side insertion & notification dispatch
  try {
    const res = await fetch('/api/buddy/message', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        recipientId: buddyId,
        content: content.trim(),
        messageType,
        meta,
      }),
    })
    const data = await res.json()
    if (res.ok && data.message) {
      const msg: BuddyChatMessage = {
        id: data.message.id,
        sender_id: data.message.sender_id,
        content: data.message.content,
        message_type: data.message.message_type as any,
        meta: data.message.meta,
        created_at: data.message.created_at,
      }

      // Update local cache
      if (typeof window !== 'undefined') {
        try {
          const cached = JSON.parse(localStorage.getItem(cacheKey) || '[]')
          const updated = [...cached.filter((m: any) => m.id !== msg.id), msg]
          localStorage.setItem(cacheKey, JSON.stringify(updated))
        } catch (_) {}
      }

      return msg
    }
  } catch (apiErr) {
    console.warn('Send buddy message API route note:', apiErr)
  }

  // 2. Direct client fallback insert
  try {
    const { data: newMsg, error } = await (supabase
      .from('messages') as any)
      .insert({
        sender_id: currentUserId,
        recipient_id: buddyId,
        content: content.trim(),
        message_type: messageType,
        meta: meta || null,
        created_at: new Date().toISOString(),
      })
      .select('*')
      .single()

    if (error || !newMsg) {
      console.error('Failed to send buddy message client-side:', error)
      return null
    }

    const msg: BuddyChatMessage = {
      id: newMsg.id,
      sender_id: newMsg.sender_id,
      content: newMsg.content,
      message_type: newMsg.message_type as any,
      meta: (newMsg as any).meta,
      created_at: newMsg.created_at,
    }

    // Update local cache
    if (typeof window !== 'undefined') {
      try {
        const cached = JSON.parse(localStorage.getItem(cacheKey) || '[]')
        const updated = [...cached.filter((m: any) => m.id !== msg.id), msg]
        localStorage.setItem(cacheKey, JSON.stringify(updated))
      } catch (_) {}
    }

    return msg
  } catch (clientErr) {
    console.error('Client message insert exception:', clientErr)
    return null
  }
}

/**
 * Full CRUD real-time subscription scoped to buddy pair
 */
export function subscribeToBuddyMessages(
  buddyId: string,
  currentUserId: string,
  onChange: () => void
): () => void {
  const supabase = createClient()
  const pairKey = [currentUserId, buddyId].sort().join('_')
  const channel = supabase
    .channel(`buddy_chat_${pairKey}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'messages',
      },
      (payload) => {
        const rec = (payload.new || payload.old) as any
        if (
          rec &&
          ((rec.sender_id === currentUserId && rec.recipient_id === buddyId) ||
            (rec.sender_id === buddyId && rec.recipient_id === currentUserId))
        ) {
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
 * Delete a message by ID
 */
export async function deleteBuddyMessage(messageId: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.from('messages').delete().eq('id', messageId)
  return !error
}

