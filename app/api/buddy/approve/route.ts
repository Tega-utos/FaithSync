import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await req.json().catch(() => ({}))

    let user: { id: string } | null = null

    const authHeader = req.headers.get('Authorization')
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '').trim()
      const { data: tokenUser } = await supabase.auth.getUser(token)
      if (tokenUser?.user) {
        user = tokenUser.user
      }
    }

    if (!user) {
      const { data: cookieUser } = await supabase.auth.getUser()
      if (cookieUser?.user) {
        user = cookieUser.user
      }
    }

    if (!user && body.userId) {
      user = { id: body.userId }
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Please log in.' }, { status: 401 })
    }

    const connectionId = body.connectionId

    if (!connectionId) {
      return NextResponse.json({ error: 'Missing connectionId.' }, { status: 400 })
    }

    // 1. Update status to accepted
    const { data: updated, error: updateErr } = await supabase
      .from('buddies')
      .update({ status: 'accepted' })
      .eq('id', connectionId)
      .select('id, user_id, buddy_id')
      .single()

    if (updateErr || !updated) {
      return NextResponse.json(
        { error: updateErr?.message || 'Failed to approve buddy request.' },
        { status: 500 }
      )
    }

    // 2. Ensure buddy_chats room exists
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

    // 3. Notify requester
    try {
      const partnerId = updated.user_id === user.id ? updated.buddy_id : updated.user_id
      const { data: approverProf } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', user.id)
        .single()

      const approverName = approverProf?.display_name || 'A Believer'
      await supabase.from('notifications').insert({
        user_id: partnerId,
        sender_id: user.id,
        type: 'buddy_accepted',
        title: 'Buddy Request Accepted',
        text: `**${approverName}** accepted your accountability buddy request!`,
        route_url: `/buddy-chat/${user.id}`,
      })
    } catch {}

    return NextResponse.json({ success: true, message: 'Buddy request approved!' })
  } catch (error: any) {
    console.error('API /api/buddy/approve fatal error:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to approve buddy request.' },
      { status: 500 }
    )
  }
}
