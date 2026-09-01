import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { recipientId, content, messageType = 'text', meta = {} } = body

    if (!recipientId || !content?.trim()) {
      return NextResponse.json({ error: 'Recipient and content are required' }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

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

    // 3. Dispatch In-App Notification to Recipient
    let notifType = messageType === 'nudge' ? 'nudge' : 'general'
    let notifTitle = user.user_metadata?.full_name || 'Accountability Buddy'
    let notifIcon = 'quotes'

    if (messageType === 'nudge') {
      notifType = 'nudge'
      notifTitle = `${user.user_metadata?.full_name || 'Buddy'} nudged you!`
      notifIcon = 'hand_waving'
    } else if (messageType === 'clockin_invite') {
      if (meta?.isScheduled) {
        notifType = 'buddy_scheduled_clockin'
        notifTitle = `Clock-In Scheduled with ${user.user_metadata?.full_name || 'Buddy'}`
        notifIcon = 'clock'
      } else {
        notifType = 'buddy_clockin_started'
        notifTitle = `${user.user_metadata?.full_name || 'Buddy'} invited you to Clock-In!`
        notifIcon = 'timer'
      }
    }

    await (supabase.from('notifications') as any).insert({
      user_id: recipientId,
      sender_id: user.id,
      type: notifType,
      title: notifTitle,
      text: content.trim().slice(0, 100),
      route_url: `/buddy-chat/${user.id}`,
      icon_type: notifIcon,
      is_read: false,
      created_at: new Date().toISOString(),
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
