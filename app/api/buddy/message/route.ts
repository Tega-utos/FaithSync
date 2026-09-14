import { NextResponse, NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getAuthenticatedUser(req: NextRequest | Request, supabase: any) {
  const authHeader = req.headers.get('Authorization') || req.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1]
    const { data: userData } = await supabase.auth.getUser(token)
    if (userData?.user) return userData.user
  }
  const { data: userData } = await supabase.auth.getUser()
  return userData?.user || null
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const buddyId = searchParams.get('buddyId')

    if (!buddyId) {
      return NextResponse.json({ error: 'buddyId is required' }, { status: 400 })
    }

    const supabase = await createClient()
    const user = await getAuthenticatedUser(req, supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: messages, error } = await (supabase
      .from('messages') as any)
      .select('id, sender_id, recipient_id, content, message_type, meta, created_at')
      .or(`and(sender_id.eq.${user.id},recipient_id.eq.${buddyId}),and(sender_id.eq.${buddyId},recipient_id.eq.${user.id})`)
      .order('created_at', { ascending: true })

    if (error) throw error

    return NextResponse.json({
      success: true,
      messages: messages || [],
    })
  } catch (error: any) {
    console.error('Buddy messages GET error:', error)
    return NextResponse.json({ error: error?.message || 'Failed to fetch messages' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { recipientId, content, messageType = 'text', meta = {} } = body

    if (!recipientId || !content?.trim()) {
      return NextResponse.json({ error: 'Recipient and content are required' }, { status: 400 })
    }

    const supabase = await createClient()
    const user = await getAuthenticatedUser(req, supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 1. Verify Connection & Type (Square Connection vs True Buddy)
    const { data: connection } = await (supabase
      .from('buddies') as any)
      .select('id, status, connection_type')
      .or(`and(user_id.eq.${user.id},buddy_id.eq.${recipientId}),and(user_id.eq.${recipientId},buddy_id.eq.${user.id})`)
      .maybeSingle()

    const isSquareConn = connection?.connection_type === 'square'

    // Feature Throttling for Square Connections (no nudges or clockin invites)
    if (isSquareConn && (messageType === 'nudge' || messageType === 'clockin_invite')) {
      return NextResponse.json(
        { error: 'Nudges and Clock-Ins are disabled for Square Connections. Plain messaging only.' },
        { status: 403 }
      )
    }

    // 3-Message Daily Limit for Square Connections
    if (isSquareConn) {
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)

      const { count } = await (supabase
        .from('messages') as any)
        .select('id', { count: 'exact', head: true })
        .eq('sender_id', user.id)
        .eq('recipient_id', recipientId)
        .gte('created_at', todayStart.toISOString())

      if ((count || 0) >= 3) {
        return NextResponse.json(
          { error: 'Daily limit reached (3/3 messages for Square Connections).' },
          { status: 429 }
        )
      }
    }

    // 2. Insert Message into Messages table
    const { data: newMsg, error: msgError } = await (supabase
      .from('messages') as any)
      .insert({
        sender_id: user.id,
        recipient_id: recipientId,
        content: content.trim(),
        message_type: messageType,
        meta,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (msgError) throw msgError

    // 3. Dispatch Notification (In-App + Web Push) to Recipient
    let notifType = messageType === 'nudge' ? 'nudge' : 'buddy_message'
    const senderName =
      user.user_metadata?.full_name ||
      user.user_metadata?.display_name ||
      user.user_metadata?.name ||
      'Accountability Buddy'
    let notifTitle = senderName
    let notifIcon = 'chat_circle'
    let notifBody = content.trim().slice(0, 120)

    if (messageType === 'nudge') {
      notifType = 'nudge'
      notifTitle = `${senderName} nudged you!`
      notifIcon = 'hand_waving'
      notifBody = content.trim() || 'Tap to respond in your Sanctuary fellowship room.'
    } else if (messageType === 'clockin_invite') {
      if (meta?.isScheduled) {
        notifType = 'buddy_scheduled_clockin'
        notifTitle = `Clock-In Scheduled with ${senderName}`
        notifIcon = 'clock'
        notifBody = `Scheduled ${meta?.discipline === 'study' ? 'Scripture Study' : 'Prayer'} for ${meta?.durationMins || 15} mins.`
      } else {
        notifType = 'buddy_clockin_started'
        notifTitle = `${senderName} invited you to Clock-In!`
        notifIcon = 'timer'
        notifBody = `🔥 ${senderName} tapped into the Altar for ${meta?.durationMins || 15}m — tap to join live!`
      }
    }

    const { dispatchServerNotification } = await import('@/lib/notifications/pushDispatcher')
    await dispatchServerNotification({
      supabase,
      senderId: user.id,
      senderName,
      targetUserIds: [recipientId],
      type: notifType,
      title: notifTitle,
      message: notifBody,
      url: `/buddy-chat/${user.id}`,
      icon: notifIcon,
    })

    return NextResponse.json({
      success: true,
      message: newMsg,
    })
  } catch (error: any) {
    console.error('Buddy message send error:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to send message' },
      { status: 500 }
    )
  }
}
