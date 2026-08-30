import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await req.json().catch(() => ({}))

    // 1. Try resolving user from Bearer header, cookies, or body
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
      const { data: senderProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', body.userId)
        .maybeSingle()
      if (senderProfile) {
        user = { id: body.userId }
      }
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Please log in.' }, { status: 401 })
    }

    const rawCode = body.code || ''
    const normalized = rawCode.trim().toUpperCase()

    if (!normalized) {
      return NextResponse.json({ error: 'Please enter a valid Buddy Sync Code.' }, { status: 400 })
    }

    // 1. Search for target profile by buddy_code with fuzzy prefix matching (supports FS-, SYNC-, raw codes)
    const cleanCore = normalized.replace(/^(FS|SYNC)[-_]?/, '')
    const possibleCodes = [
      normalized,
      cleanCore,
      `FS-${cleanCore}`,
      `FS${cleanCore}`,
      `SYNC-${cleanCore}`,
      `SYNC${cleanCore}`,
    ]

    const { data: targetProfile, error: searchErr } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url, buddy_code')
      .in('buddy_code', possibleCodes)
      .maybeSingle()

    if (searchErr || !targetProfile) {
      // Secondary fallback search with ilike
      const { data: fallbackProf } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, buddy_code')
        .ilike('buddy_code', `%${cleanCore}%`)
        .maybeSingle()

      if (!fallbackProf) {
        return NextResponse.json(
          { error: 'No believer found with this Sync Code. Please verify the code and try again.' },
          { status: 404 }
        )
      }
      return await processBuddyConnect(supabase, user, fallbackProf)
    }

    return await processBuddyConnect(supabase, user, targetProfile)
  } catch (error: any) {
    console.error('API /api/buddy/connect fatal error:', error)
    return NextResponse.json(
      { error: error?.message || 'An unexpected error occurred while adding buddy.' },
      { status: 500 }
    )
  }
}

async function processBuddyConnect(supabase: any, user: { id: string }, targetProfile: any) {
  // 2. Anti-Solo Rule: Cannot add self
  if (targetProfile.id === user.id) {
    return NextResponse.json(
      { error: 'The Anti-Solo Rule: You cannot add yourself as an accountability buddy.' },
      { status: 400 }
    )
  }

  // 3. Trinity Limit Rule: Max 3 active buddies
  const { data: activeBuddies } = await supabase
    .from('buddies')
    .select('id')
    .or(`user_id.eq.${user.id},buddy_id.eq.${user.id}`)
    .eq('status', 'accepted')

  if (activeBuddies && activeBuddies.length >= 3) {
    return NextResponse.json(
      {
        error:
          'The Trinity Limit: You have reached the maximum limit of 3 active accountability buddies. Remove a buddy to add another.',
      },
      { status: 400 }
    )
  }

  // 4. Check if an existing connection exists
  const { data: existingConnection } = await supabase
    .from('buddies')
    .select('id, user_id, buddy_id, status')
    .or(
      `and(user_id.eq.${user.id},buddy_id.eq.${targetProfile.id}),and(user_id.eq.${targetProfile.id},buddy_id.eq.${user.id})`
    )
    .maybeSingle()

  if (existingConnection) {
    if (existingConnection.status === 'accepted') {
      return NextResponse.json({
        success: true,
        status: 'accepted',
        message: `You and ${targetProfile.display_name || 'this believer'} are already connected buddies!`,
        target: targetProfile,
      })
    }

    // If target had already sent a request to the current user, automatically accept it!
    if (existingConnection.status === 'pending' && existingConnection.user_id === targetProfile.id) {
      await supabase
        .from('buddies')
        .update({ status: 'accepted' })
        .eq('id', existingConnection.id)

      // Ensure buddy_chats conversation exists
      const { data: existingChat } = await supabase
        .from('buddy_chats')
        .select('id')
        .eq('buddy_connection_id', existingConnection.id)
        .maybeSingle()

      if (!existingChat) {
        await supabase.from('buddy_chats').insert({
          buddy_connection_id: existingConnection.id,
        })
      }

      return NextResponse.json({
        success: true,
        status: 'accepted',
        message: `Mutual request matched! You and ${targetProfile.display_name || 'your buddy'} are now linked!`,
        target: targetProfile,
      })
    }

    return NextResponse.json({
      success: true,
      status: 'pending',
      message: 'A buddy request is already pending for this believer.',
      target: targetProfile,
    })
  }

  // 5. Insert new pending request
  const { data: newRow, error: insertErr } = await supabase
    .from('buddies')
    .insert({
      user_id: user.id,
      buddy_id: targetProfile.id,
      status: 'pending',
      connection_type: 'sync_code',
      permissions: {
        shareHistory: true,
        allowNudge: true,
        shareLiveSession: true,
      },
    })
    .select('id')
    .single()

  if (insertErr || !newRow) {
    console.error('Buddy request insertion error:', insertErr)
    return NextResponse.json(
      { error: insertErr?.message || 'Failed to send buddy request to database.' },
      { status: 500 }
    )
  }

  // 6. Dispatch in-app notification to target user
  try {
    const { data: senderProf } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .single()

    const senderName = senderProf?.display_name || 'A Believer'
    await supabase.from('notifications').insert({
      user_id: targetProfile.id,
      sender_id: user.id,
      type: 'buddy_request',
      title: 'New Buddy Request',
      text: `**${senderName}** sent you an accountability buddy request!`,
      route_url: '/sync',
    })
  } catch {}

  return NextResponse.json({
    success: true,
    status: 'pending',
    message: `Buddy request sent to ${targetProfile.display_name || 'believer'}!`,
    target: targetProfile,
  })
}
