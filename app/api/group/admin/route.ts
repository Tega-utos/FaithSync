import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { groupId, action, targetUserId, newGuidelines, newName } = body

    if (!groupId || !action) {
      return NextResponse.json({ error: 'groupId and action are required' }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 1. Verify User Membership and Admin Role
    const { data: member } = await (supabase
      .from('group_members') as any)
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', user.id)
      .maybeSingle()

    const isAdmin = member?.role === 'admin'

    if (action === 'leave') {
      await (supabase.from('group_members') as any)
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', user.id)

      return NextResponse.json({ success: true, message: 'Left group successfully' })
    }

    // All subsequent actions require Admin Authority
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Admin authority required to perform this action.' },
        { status: 403 }
      )
    }

    if (action === 'update_guidelines') {
      if (!newGuidelines?.trim()) {
        return NextResponse.json({ error: 'Guidelines cannot be empty' }, { status: 400 })
      }

      await (supabase.from('groups') as any)
        .update({
          guidelines: newGuidelines.trim(),
          name: newName?.trim() || undefined,
          updated_at: new Date().toISOString(),
        })
        .eq('id', groupId)

      return NextResponse.json({ success: true, message: 'Guidelines updated successfully' })
    }

    if (action === 'remove_member') {
      if (!targetUserId || targetUserId === user.id) {
        return NextResponse.json({ error: 'Invalid target user for removal' }, { status: 400 })
      }

      await (supabase.from('group_members') as any)
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', targetUserId)

      return NextResponse.json({ success: true, message: 'Member removed from group' })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error: any) {
    console.error('Group admin action error:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to execute group admin action' },
      { status: 500 }
    )
  }
}
