import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculateUserStreak } from '@/lib/utils/streak'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const query = (searchParams.get('q') || '').trim()
    const churchFilter = (searchParams.get('church') || '').trim()

    // 1. Fetch user's existing connections
    const { data: myBuddies } = await supabase
      .from('buddies')
      .select('id, user_id, buddy_id, status')
      .or(`user_id.eq.${user.id},buddy_id.eq.${user.id}`)

    const statusMap: Record<string, { status: string; connectionId: string }> = {}
    ;(myBuddies || []).forEach((b: any) => {
      const otherId = b.user_id === user.id ? b.buddy_id : b.user_id
      statusMap[otherId] = { status: b.status, connectionId: b.id }
    })

    // 2. Query profiles with comprehensive search fields
    let profilesQuery = supabase
      .from('profiles')
      .select('id, display_name, full_name, username, avatar_url, buddy_code, church, preferences, email')
      .neq('id', user.id)

    if (churchFilter) {
      profilesQuery = profilesQuery.ilike('church', `%${churchFilter}%`)
    }

    if (query) {
      const sanitized = query.replace(/[(),.*%"']/g, ' ').replace(/\s+/g, ' ').trim()
      if (sanitized) {
        const cleanCode = query.toUpperCase().replace(/^(FS|SYNC)[-_]?/, '').replace(/[^A-Z0-9]/g, '')
        const orClauses = [
          `display_name.ilike.%${sanitized}%`,
          `full_name.ilike.%${sanitized}%`,
          `username.ilike.%${sanitized}%`,
          `church.ilike.%${sanitized}%`,
          `buddy_code.ilike.%${sanitized}%`,
        ]
        if (cleanCode && cleanCode !== sanitized) {
          orClauses.push(`buddy_code.ilike.%${cleanCode}%`)
        }
        profilesQuery = profilesQuery.or(orClauses.join(','))
      }
    }

    const { data: profiles, error } = await profilesQuery.limit(60)

    if (error) {
      console.error('Search query error:', error)
      // Fallback: simple query without complex OR clause
      const { data: fallbackProfiles } = await supabase
        .from('profiles')
        .select('id, display_name, full_name, username, avatar_url, buddy_code, church, preferences, email')
        .neq('id', user.id)
        .limit(60)

      if (!fallbackProfiles) return NextResponse.json({ results: [] })
      return NextResponse.json({ results: await formatResults(fallbackProfiles, statusMap, supabase) })
    }

    const formatted = await formatResults(profiles || [], statusMap, supabase)
    return NextResponse.json({ results: formatted })
  } catch (error: any) {
    console.error('API /api/buddy/search error:', error)
    return NextResponse.json({ error: error?.message || 'Search failed' }, { status: 500 })
  }
}

async function formatResults(
  profiles: any[],
  statusMap: Record<string, { status: string; connectionId: string }>,
  supabase: any
) {
  const profileIds = profiles.map((p: any) => p.id)
  const streakMap: Record<string, number> = {}

  if (profileIds.length > 0) {
    await Promise.all(
      profileIds.map(async (pid: string) => {
        try {
          streakMap[pid] = await calculateUserStreak(pid, supabase)
        } catch {
          streakMap[pid] = 0
        }
      })
    )
  }

  return profiles.map((p: any) => {
    const conn = statusMap[p.id]
    const rawName =
      p.display_name?.trim() ||
      p.full_name?.trim() ||
      p.username?.trim() ||
      (p.email ? p.email.split('@')[0] : 'A Believer')

    const streak = streakMap[p.id] ?? (p.preferences?.admin_adjusted_streak ?? 0)
    const isDailyActive = streak > 0

    return {
      id: p.id,
      name: rawName,
      initial: rawName.charAt(0).toUpperCase(),
      avatarUrl: p.avatar_url || null,
      church: p.church || '',
      buddyCode: p.buddy_code || '',
      streakDays: streak,
      activityLevel: streak > 0 ? `${streak}d Streak` : isDailyActive ? 'Active' : 'Believer',
      goalLength: 'Daily Devotion',
      connectionStatus: conn ? conn.status : 'none',
      connectionId: conn ? conn.connectionId : null,
    }
  })
}
