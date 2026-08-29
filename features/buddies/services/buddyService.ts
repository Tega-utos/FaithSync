import { createClient } from '@/lib/supabase/client'

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

export async function fetchBuddyMessages(buddyId: string, currentUserId: string): Promise<BuddyChatMessage[]> {
  const supabase = createClient()

  // 1. Locate the buddy connection
  const { data: connection } = await supabase
    .from('buddies')
    .select('id')
    .or(`and(user_id.eq.${currentUserId},buddy_id.eq.${buddyId}),and(user_id.eq.${buddyId},buddy_id.eq.${currentUserId})`)
    .maybeSingle()

  if (!connection) return []

  // 2. Locate or get buddy chat
  const { data: chat } = await supabase
    .from('buddy_chats')
    .select('id')
    .eq('buddy_connection_id', connection.id)
    .maybeSingle()

  if (!chat) return []

  // 3. Fetch real messages ordered by created_at
  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .eq('chat_id', chat.id)
    .order('created_at', { ascending: true })

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

  let { data: connection } = await supabase
    .from('buddies')
    .select('id')
    .or(`and(user_id.eq.${currentUserId},buddy_id.eq.${buddyId}),and(user_id.eq.${buddyId},buddy_id.eq.${currentUserId})`)
    .maybeSingle()

  if (!connection) {
    const { data: newConn } = await supabase
      .from('buddies')
      .insert({
        user_id: currentUserId,
        buddy_id: buddyId,
        status: 'accepted',
      })
      .select('id')
      .single()
    connection = newConn
  }

  if (!connection) return null

  let { data: chat } = await supabase
    .from('buddy_chats')
    .select('id')
    .eq('buddy_connection_id', connection.id)
    .maybeSingle()

  if (!chat) {
    const { data: newChat } = await supabase
      .from('buddy_chats')
      .insert({
        buddy_connection_id: connection.id,
      })
      .select('id')
      .single()
    chat = newChat
  }

  if (!chat) return null

  const { data: newMsg, error } = await supabase
    .from('messages')
    .insert({
      chat_id: chat.id,
      sender_id: currentUserId,
      content,
      message_type: messageType,
      meta: meta || null,
    })
    .select('*')
    .single()

  if (error || !newMsg) return null

  return {
    id: newMsg.id,
    sender_id: newMsg.sender_id,
    content: newMsg.content,
    message_type: newMsg.message_type as any,
    meta: (newMsg as any).meta,
    created_at: newMsg.created_at,
  }
}
