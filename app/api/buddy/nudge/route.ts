import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { buddyConnectionId, buddyId } = await request.json()

    if (!buddyConnectionId && !buddyId) {
      return NextResponse.json({ error: 'Missing buddy info' }, { status: 400 })
    }

    // 1. Fetch sender's profile
    const { data: senderProfile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .single()

    const senderName = senderProfile?.display_name || 'Your buddy'

    // 2. Insert notification
    if (buddyId) {
      await supabase.from('notifications').insert({
        user_id: buddyId,
        type: 'nudge',
        text: `⚡ ${senderName} sent you an accountability nudge!`,
        icon_type: 'nudge',
      })
    }

    // 3. Insert encouragement chat message
    if (buddyConnectionId) {
      await supabase.from('messages').insert({
        chat_id: buddyConnectionId,
        sender_id: user.id,
        content: `⚡ ${senderName} sent you a spiritual encouragement nudge! "Let us run with endurance the race set before us." (Hebrews 12:1)`,
        message_type: 'nudge',
      })
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: 'Failed to send nudge' }, { status: 500 })
  }
}
