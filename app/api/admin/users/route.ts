import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifySuperAdmin } from '@/lib/admin/adminAuth'

// GET: Search users with stats & preferences
export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const { user, isAuthorized } = await verifySuperAdmin(supabase)

    if (!isAuthorized || !user) {
      return NextResponse.json({ error: 'Forbidden: Super Admin Access Required' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const query = searchParams.get('q') || ''
    const limit = parseInt(searchParams.get('limit') || '50')

    let dbQuery = supabase
      .from('profiles')
      .select('id, display_name, full_name, church, email, buddy_code, created_at, preferences')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (query.trim()) {
      dbQuery = dbQuery.or(
        `display_name.ilike.%${query.trim()}%,full_name.ilike.%${query.trim()}%,church.ilike.%${query.trim()}%,buddy_code.ilike.%${query.trim()}%`
      )
    }

    const { data: users, error } = await dbQuery
    if (error) throw error

    // Fetch user stats for these users
    const userIds = (users || []).map((u) => u.id)
    let statsMap: Record<string, any> = {}

    if (userIds.length > 0) {
      const { data: stats } = await (supabase.from('user_stats') as any)
        .select('*')
        .in('user_id', userIds)

      if (stats && Array.isArray(stats)) {
        for (const s of stats) {
          statsMap[s.user_id] = s
        }
      }
    }

    const enrichedUsers = (users || []).map((u) => {
      const uStats = statsMap[u.id] || {}
      return {
        ...u,
        total_devotion_mins: uStats.total_devotion_mins || 0,
        total_sessions: uStats.total_sessions || 0,
        current_streak: uStats.current_streak || 0,
        longest_streak: uStats.longest_streak || 0,
      }
    })

    return NextResponse.json({ success: true, users: enrichedUsers })
  } catch (err: any) {
    console.error('Admin users fetch error:', err)
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 })
  }
}

// PATCH: User management actions (adjust streak, mute, ban, assign badges)
export async function PATCH(req: Request) {
  try {
    const supabase = await createClient()
    const { user, isAuthorized } = await verifySuperAdmin(supabase)

    if (!isAuthorized || !user) {
      return NextResponse.json({ error: 'Forbidden: Super Admin Access Required' }, { status: 403 })
    }

    const body = await req.json()
    const { targetUserId, action, value } = body

    if (!targetUserId || !action) {
      return NextResponse.json({ error: 'targetUserId and action are required' }, { status: 400 })
    }

    // 1. Fetch current profile preferences
    const { data: prof, error: profErr } = await supabase
      .from('profiles')
      .select('preferences')
      .eq('id', targetUserId)
      .single()

    if (profErr) throw profErr

    const currentPrefs = (prof?.preferences as any) || {}

    if (action === 'adjust_streak') {
      const newStreak = Number(value) || 0
      // Update in user_stats
      await (supabase.from('user_stats') as any).upsert({
        user_id: targetUserId,
        current_streak: newStreak,
        updated_at: new Date().toISOString(),
      })

      // Also update in preferences for fallback
      await supabase
        .from('profiles')
        .update({
          preferences: {
            ...currentPrefs,
            admin_adjusted_streak: newStreak,
          },
        })
        .eq('id', targetUserId)

      return NextResponse.json({ success: true, message: `Streak adjusted to ${newStreak} days` })
    }

    if (action === 'mute_square') {
      const isMuted = Boolean(value)
      await supabase
        .from('profiles')
        .update({
          preferences: {
            ...currentPrefs,
            is_muted_square: isMuted,
          },
        })
        .eq('id', targetUserId)

      return NextResponse.json({ success: true, message: isMuted ? 'User muted from Square' : 'User unmuted' })
    }

    if (action === 'ban_user') {
      const isBanned = Boolean(value)
      await supabase
        .from('profiles')
        .update({
          preferences: {
            ...currentPrefs,
            is_banned: isBanned,
          },
        })
        .eq('id', targetUserId)

      return NextResponse.json({ success: true, message: isBanned ? 'User banned' : 'User unbanned' })
    }

    if (action === 'set_badge') {
      const badge = String(value || '').trim()
      const existingBadges = currentPrefs.special_badges || []
      const updatedBadges = badge
        ? Array.from(new Set([...existingBadges, badge]))
        : existingBadges

      await supabase
        .from('profiles')
        .update({
          preferences: {
            ...currentPrefs,
            special_badges: updatedBadges,
          },
        })
        .eq('id', targetUserId)

      return NextResponse.json({ success: true, message: `Badge ${badge} granted`, badges: updatedBadges })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err: any) {
    console.error('Admin user update error:', err)
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 })
  }
}
