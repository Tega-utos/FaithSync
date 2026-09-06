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
    const groupId = searchParams.get('groupId')

    if (!groupId) {
      return NextResponse.json({ error: 'groupId is required' }, { status: 400 })
    }

    const supabase = await createClient()
    const user = await getAuthenticatedUser(req, supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: messages, error } = await (supabase
      .from('group_messages') as any)
      .select('id, group_id, sender_id, content, message_type, meta, created_at')
      .eq('group_id', groupId)
      .order('created_at', { ascending: true })

    if (error) throw error

    const senderIds = Array.from(new Set((messages || []).map((m: any) => m.sender_id))).filter(Boolean) as string[]
    const profileMap: Record<string, string> = {}

    if (senderIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, username')
        .in('id', senderIds)

      ;(profiles || []).forEach((p: any) => {
        profileMap[p.id] = p.display_name || p.username || 'Member'
      })
    }

    const formatted = (messages || []).map((m: any) => {
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

    return NextResponse.json({
      success: true,
      messages: formatted,
    })
  } catch (error: any) {
    console.error('Group messages GET error:', error)
    return NextResponse.json({ error: error?.message || 'Failed to fetch group messages' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { groupId, content, messageType = 'text', meta = {} } = body

    if (!groupId || !content?.trim()) {
      return NextResponse.json({ error: 'groupId and content are required' }, { status: 400 })
    }

    const supabase = await createClient()
    const user = await getAuthenticatedUser(req, supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: newMsg, error: msgError } = await (supabase
      .from('group_messages') as any)
      .insert({
        group_id: groupId,
        sender_id: user.id,
        content: content.trim(),
        message_type: messageType,
        meta: meta || null,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (msgError) throw msgError

    const senderName = user.user_metadata?.full_name || user.user_metadata?.display_name || 'A Member'
    const formatted = {
      id: newMsg.id,
      sender_id: newMsg.sender_id,
      sender_name: senderName,
      sender_initial: senderName.charAt(0).toUpperCase(),
      content: newMsg.content,
      created_at: newMsg.created_at,
      message_type: newMsg.message_type,
      meta: newMsg.meta,
    }

    return NextResponse.json({
      success: true,
      message: formatted,
    })
  } catch (error: any) {
    console.error('Group message POST error:', error)
    return NextResponse.json({ error: error?.message || 'Failed to send group message' }, { status: 500 })
  }
}
