import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifySuperAdmin } from '@/lib/admin/adminAuth'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { user, isAuthorized } = await verifySuperAdmin(supabase)

    if (!isAuthorized || !user) {
      return NextResponse.json({ error: 'Forbidden: Super Admin Access Required' }, { status: 403 })
    }

    const body = await req.json()
    const { title, message, actionUrl } = body

    if (!message || !message.trim()) {
      return NextResponse.json({ error: 'Broadcast message is required' }, { status: 400 })
    }

    // 1. Fetch all user IDs
    const { data: users, error: userErr } = await supabase
      .from('profiles')
      .select('id')

    if (userErr) throw userErr

    if (!users || users.length === 0) {
      return NextResponse.json({ success: true, count: 0, message: 'No registered users found' })
    }

    // 2. Prepare bulk notification payloads
    const notifications = users.map((u) => ({
      user_id: u.id,
      type: 'system_announcement',
      title: title?.trim() || 'FaithSync Community Announcement',
      body: message.trim(),
      data: {
        actionUrl: actionUrl?.trim() || '/',
        broadcastBy: user.email,
        sentAt: new Date().toISOString(),
      },
    }))

    // 3. Batch insert in chunks of 500
    const chunkSize = 500
    let insertedCount = 0

    for (let i = 0; i < notifications.length; i += chunkSize) {
      const chunk = notifications.slice(i, i + chunkSize)
      const { error: insertErr } = await (supabase.from('notifications') as any).insert(chunk)
      if (!insertErr) {
        insertedCount += chunk.length
      } else {
        console.warn('Batch notification insert error:', insertErr)
      }
    }

    return NextResponse.json({
      success: true,
      deliveredToUsers: insertedCount,
      totalUsers: users.length,
    })
  } catch (err: any) {
    console.error('Admin broadcast error:', err)
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 })
  }
}
