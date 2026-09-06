import { NextRequest, NextResponse } from 'next/server'
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

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000 // 72 hours

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const user = await getAuthenticatedUser(req, supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = Date.now()

    // 1. Fetch permanent buddy count for slot checking
    const { data: permanentBuddies } = await (supabase
      .from('buddies') as any)
      .select('id, connection_type, status')
      .or(`user_id.eq.${user.id},buddy_id.eq.${user.id}`)
      .eq('status', 'accepted')

    const activePermanentCount = (permanentBuddies || []).filter(
      (b: any) => b.connection_type !== 'square'
    ).length

    // 2. Fetch incoming Square requests
    const { data: incomingRows } = await (supabase
      .from('buddies') as any)
      .select('id, user_id, buddy_id, status, connection_type, created_at, updated_at')
      .eq('buddy_id', user.id)
      .eq('status', 'pending')
      .eq('connection_type', 'square')
      .order('created_at', { ascending: false })

    const senderIds = Array.from(new Set((incomingRows || []).map((r: any) => r.user_id)))
    const profileMap: Record<string, any> = {}

    const formatBelieverName = (prof: any) => {
      if (prof?.display_name && prof.display_name.trim()) return prof.display_name.trim()
      if (prof?.full_name && prof.full_name.trim()) return prof.full_name.trim()
      if (prof?.username && prof.username.trim()) return prof.username.trim()
      if (prof?.email && typeof prof.email === 'string' && prof.email.includes('@')) {
        const handle = prof.email.split('@')[0].replace(/[._-]+/g, ' ').trim()
        if (handle) {
          return handle
            .split(' ')
            .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
            .join(' ')
        }
      }
      return 'Believer'
    }

    if (senderIds.length > 0) {
      const { data: senderProfiles } = await (supabase
        .from('profiles') as any)
        .select('id, display_name, full_name, username, avatar_url, church, email')
        .in('id', senderIds)

      ;(senderProfiles || []).forEach((p: any) => {
        profileMap[p.id] = p
      })
    }

    // Fetch intro messages for incoming requests
    const incomingRequests = (incomingRows || []).map((reqRow: any) => {
      const prof = profileMap[reqRow.user_id] || {}
      const rawName = formatBelieverName(prof)
      return {
        id: reqRow.id,
        senderId: reqRow.user_id,
        senderName: rawName,
        senderAvatar: prof.avatar_url || null,
        senderChurch: prof.church || 'Local Assembly',
        createdAt: reqRow.created_at,
      }
    })

    // 3. Fetch active Square connections (accepted within 72 hours)
    const { data: activeSquareRows } = await (supabase
      .from('buddies') as any)
      .select('id, user_id, buddy_id, status, connection_type, created_at, updated_at')
      .or(`user_id.eq.${user.id},buddy_id.eq.${user.id}`)
      .eq('status', 'accepted')
      .eq('connection_type', 'square')
      .order('updated_at', { ascending: false })

    const activePartnerIds = Array.from(
      new Set(
        (activeSquareRows || []).map((r: any) => (r.user_id === user.id ? r.buddy_id : r.user_id))
      )
    )

    if (activePartnerIds.length > 0) {
      const { data: partnerProfiles } = await (supabase
        .from('profiles') as any)
        .select('id, display_name, full_name, username, avatar_url, church, email')
        .in('id', activePartnerIds)

      ;(partnerProfiles || []).forEach((p: any) => {
        profileMap[p.id] = p
      })
    }

    const activeConnections: any[] = []

    for (const row of activeSquareRows || []) {
      const partnerId = row.user_id === user.id ? row.buddy_id : row.user_id
      const startTime = new Date(row.updated_at || row.created_at).getTime()
      const expiresAtMs = startTime + THREE_DAYS_MS
      const remainingMs = expiresAtMs - now

      // If expired beyond 72h, skip
      if (remainingMs <= 0) {
        continue
      }

      const prof = profileMap[partnerId] || {}
      const partnerName = prof.display_name || prof.full_name || prof.username || 'A Believer'

      // Fetch last message preview
      const { data: lastMsg } = await (supabase
        .from('messages') as any)
        .select('content, created_at, sender_id')
        .or(
          `and(sender_id.eq.${user.id},recipient_id.eq.${partnerId}),and(sender_id.eq.${partnerId},recipient_id.eq.${user.id})`
        )
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      activeConnections.push({
        id: row.id,
        partnerId,
        partnerName,
        partnerAvatar: prof.avatar_url || null,
        partnerChurch: prof.church || 'Local Assembly',
        createdAt: row.created_at,
        acceptedAt: row.updated_at || row.created_at,
        expiresAt: new Date(expiresAtMs).toISOString(),
        remainingMs,
        lastMessage: lastMsg?.content || 'Intercession window active',
        lastMessageTime: lastMsg?.created_at || row.updated_at || row.created_at,
      })
    }

    return NextResponse.json({
      success: true,
      incomingRequests,
      activeConnections,
      permanentBuddyCount: activePermanentCount,
      maxBuddySlots: 3,
    })
  } catch (error: any) {
    console.error('Square connect GET error:', error)
    return NextResponse.json({ error: error?.message || 'Failed to fetch Square connections' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const user = await getAuthenticatedUser(req, supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { action, targetUserId, connectionId, message, postContext } = body

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 })
    }

    // 1. REQUEST: Send connection request from Community Square
    if (action === 'request') {
      if (!targetUserId) {
        return NextResponse.json({ error: 'targetUserId is required' }, { status: 400 })
      }

      if (targetUserId === user.id) {
        return NextResponse.json({ error: 'Cannot connect with yourself' }, { status: 400 })
      }

      // Check existing connection
      const { data: existing } = await (supabase
        .from('buddies') as any)
        .select('*')
        .or(
          `and(user_id.eq.${user.id},buddy_id.eq.${targetUserId}),and(user_id.eq.${targetUserId},buddy_id.eq.${user.id})`
        )
        .maybeSingle()

      let connectionRecord = existing

      if (existing) {
        if (existing.status === 'accepted' && existing.connection_type !== 'square') {
          return NextResponse.json({
            success: true,
            status: 'already_permanent',
            message: 'You are already permanent accountability buddies!',
          })
        }

        // Update existing to pending square connection
        const { data: updated } = await (supabase
          .from('buddies') as any)
          .update({
            status: 'pending',
            connection_type: 'square',
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select()
          .single()

        connectionRecord = updated
      } else {
        // Insert new square connection
        const { data: inserted, error: insErr } = await (supabase
          .from('buddies') as any)
          .insert({
            user_id: user.id,
            buddy_id: targetUserId,
            status: 'pending',
            connection_type: 'square',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select()
          .single()

        if (insErr) throw insErr
        connectionRecord = inserted
      }

      // Send initial intro message if provided
      if (message && message.trim()) {
        const finalMsg = postContext
          ? `[Regarding: "${postContext.slice(0, 80)}"]\n\n${message.trim()}`
          : message.trim()

        await (supabase.from('messages') as any).insert({
          sender_id: user.id,
          recipient_id: targetUserId,
          content: finalMsg,
          message_type: 'text',
          created_at: new Date().toISOString(),
        })
      }

      // Dispatch alert notification
      const { data: senderProf } = await (supabase
        .from('profiles') as any)
        .select('display_name, full_name')
        .eq('id', user.id)
        .maybeSingle()

      const senderName = senderProf?.display_name || senderProf?.full_name || user.user_metadata?.full_name || 'A Believer'

      await (supabase.from('notifications') as any).insert({
        user_id: targetUserId,
        sender_id: user.id,
        type: 'square_connect_request',
        title: `${senderName} wants to connect`,
        text: message ? `"${message.slice(0, 80)}"` : 'Sent a 3-Day Intercession request from Community Square.',
        route_url: '/sync',
        created_at: new Date().toISOString(),
      })

      return NextResponse.json({
        success: true,
        message: '3-Day Intercession Request sent!',
        connectionId: connectionRecord?.id,
      })
    }

    // 2. ACCEPT: Accept incoming Square request
    if (action === 'accept') {
      if (!connectionId) {
        return NextResponse.json({ error: 'connectionId is required' }, { status: 400 })
      }

      const { data: updated, error: updateErr } = await (supabase
        .from('buddies') as any)
        .update({
          status: 'accepted',
          connection_type: 'square',
          updated_at: new Date().toISOString(),
        })
        .eq('id', connectionId)
        .select('id, user_id, buddy_id')
        .single()

      if (updateErr || !updated) {
        throw updateErr || new Error('Failed to accept request')
      }

      // Ensure buddy_chats room exists
      const { data: existingChat } = await (supabase
        .from('buddy_chats') as any)
        .select('id')
        .eq('buddy_connection_id', connectionId)
        .maybeSingle()

      if (!existingChat) {
        await (supabase.from('buddy_chats') as any).insert({
          buddy_connection_id: connectionId,
        })
      }

      const partnerId = updated.user_id === user.id ? updated.buddy_id : updated.user_id

      // Notify requester
      const { data: approverProf } = await (supabase
        .from('profiles') as any)
        .select('display_name, full_name')
        .eq('id', user.id)
        .maybeSingle()

      const approverName = approverProf?.display_name || approverProf?.full_name || user.user_metadata?.full_name || 'A Believer'

      await (supabase.from('notifications') as any).insert({
        user_id: partnerId,
        sender_id: user.id,
        type: 'square_connect_accepted',
        title: 'Intercession Fellowship Accepted',
        text: `${approverName} accepted your 3-Day Intercession window!`,
        route_url: `/buddy-chat/${user.id}?type=square`,
        created_at: new Date().toISOString(),
      })

      return NextResponse.json({
        success: true,
        message: 'Intercession Window Opened!',
        partnerId,
      })
    }

    // 3. DECLINE: Dismiss Square request
    if (action === 'decline') {
      if (!connectionId) {
        return NextResponse.json({ error: 'connectionId is required' }, { status: 400 })
      }

      await (supabase.from('buddies') as any).delete().eq('id', connectionId)

      return NextResponse.json({ success: true, message: 'Request declined' })
    }

    // 4. UPGRADE: Promote Square Connection to Permanent Accountability Buddy
    if (action === 'upgrade') {
      const { partnerId: targetPartnerId, connectionId: targetConnId } = body

      // Verify slot availability (< 3 active permanent buddies)
      const { data: permanentBuddies } = await (supabase
        .from('buddies') as any)
        .select('id, connection_type, status')
        .or(`user_id.eq.${user.id},buddy_id.eq.${user.id}`)
        .eq('status', 'accepted')

      const activePermanentCount = (permanentBuddies || []).filter(
        (b: any) => b.connection_type !== 'square'
      ).length

      if (activePermanentCount >= 3) {
        return NextResponse.json(
          {
            error: 'Accountability slots full (3/3). You must free an active buddy slot before upgrading.',
            slotsFull: true,
            activeCount: activePermanentCount,
          },
          { status: 400 }
        )
      }

      let query = (supabase.from('buddies') as any).update({
        connection_type: 'permanent',
        updated_at: new Date().toISOString(),
      })

      if (targetConnId) {
        query = query.eq('id', targetConnId)
      } else if (targetPartnerId) {
        query = query.or(
          `and(user_id.eq.${user.id},buddy_id.eq.${targetPartnerId}),and(user_id.eq.${targetPartnerId},buddy_id.eq.${user.id})`
        )
      } else {
        return NextResponse.json({ error: 'connectionId or partnerId is required' }, { status: 400 })
      }

      const { data: upgraded, error: upgradeErr } = await query.select().single()

      if (upgradeErr) throw upgradeErr

      const finalPartnerId = targetPartnerId || (upgraded.user_id === user.id ? upgraded.buddy_id : upgraded.user_id)

      // Notify partner
      const { data: myProf } = await (supabase
        .from('profiles') as any)
        .select('display_name, full_name')
        .eq('id', user.id)
        .maybeSingle()

      const myName = myProf?.display_name || myProf?.full_name || 'Your Partner'

      await (supabase.from('notifications') as any).insert({
        user_id: finalPartnerId,
        sender_id: user.id,
        type: 'buddy_upgraded',
        title: 'Permanent Buddy Partnership Sealed!',
        text: `${myName} upgraded your fellowship into a permanent Accountability Partnership.`,
        route_url: `/buddy-chat/${user.id}`,
        created_at: new Date().toISOString(),
      })

      return NextResponse.json({
        success: true,
        message: 'Successfully upgraded to Permanent Accountability Buddy!',
        connection: upgraded,
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error: any) {
    console.error('Square connect POST error:', error)
    return NextResponse.json({ error: error?.message || 'Failed to process request' }, { status: 500 })
  }
}
