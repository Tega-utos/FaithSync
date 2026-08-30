import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { groupId, action, targetUserId, newGuidelines, newName, newChurch, newCategory, messageId } = body

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

    // 1. Verify User Membership and Admin Role or Group Creator
    const { data: grpData } = await (supabase
      .from('groups') as any)
      .select('id, name, created_by')
      .eq('id', groupId)
      .maybeSingle()

    const isCreator = grpData?.created_by === user.id

    const { data: member } = await (supabase
      .from('group_members') as any)
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', user.id)
      .maybeSingle()

    const isAdmin = isCreator || member?.role === 'admin' || member?.role === 'owner'

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

    if (action === 'update_guidelines' || action === 'update_group_info') {
      const updatePayload: any = { updated_at: new Date().toISOString() }
      if (newGuidelines?.trim()) updatePayload.guidelines = newGuidelines.trim()
      if (newName?.trim()) updatePayload.name = newName.trim()
      if (newChurch?.trim()) updatePayload.church = newChurch.trim()
      if (newCategory?.trim()) updatePayload.category = newCategory.trim()

      await (supabase.from('groups') as any)
        .update(updatePayload)
        .eq('id', groupId)

      return NextResponse.json({ success: true, message: 'Group details updated successfully' })
    }

    if (action === 'remove_member' || action === 'kick_member') {
      if (!targetUserId || targetUserId === user.id) {
        return NextResponse.json({ error: 'Invalid target user for removal' }, { status: 400 })
      }

      await (supabase.from('group_members') as any)
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', targetUserId)

      return NextResponse.json({ success: true, message: 'Member removed from group' })
    }

    if (action === 'promote_member') {
      if (!targetUserId) {
        return NextResponse.json({ error: 'targetUserId required' }, { status: 400 })
      }

      await (supabase.from('group_members') as any)
        .update({ role: 'admin' })
        .eq('group_id', groupId)
        .eq('user_id', targetUserId)

      return NextResponse.json({ success: true, message: 'Member promoted to co-admin' })
    }

    if (action === 'demote_member') {
      if (!targetUserId) {
        return NextResponse.json({ error: 'targetUserId required' }, { status: 400 })
      }

      await (supabase.from('group_members') as any)
        .update({ role: 'member' })
        .eq('group_id', groupId)
        .eq('user_id', targetUserId)

      return NextResponse.json({ success: true, message: 'Admin demoted to member' })
    }

    if (action === 'delete_message') {
      if (!messageId) {
        return NextResponse.json({ error: 'messageId required' }, { status: 400 })
      }

      await (supabase.from('group_messages') as any)
        .delete()
        .eq('id', messageId)
        .eq('group_id', groupId)

      return NextResponse.json({ success: true, message: 'Message moderated and removed' })
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
