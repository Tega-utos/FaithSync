import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

    // 2. Query profiles
    let profilesQuery = supabase
      .from('profiles')
      .select('id, display_name, avatar_url, buddy_code, church, preferences')
      .neq('id', user.id)

    if (query) {
      const cleanCode = query.toUpperCase().replace(/^(FS|SYNC)[-_]?/, '')
      profilesQuery = profilesQuery.or(
        `display_name.ilike.%${query}%,buddy_code.ilike.%${query}%,buddy_code.ilike.%${cleanCode}%`
      )
    }

    const { data: profiles, error } = await profilesQuery.limit(50)

    if (error) {
      console.error('Search query error:', error)
      return NextResponse.json({ results: [] })
    }

    // 3. Query real user stats for streaks & activity
    const profileIds = (profiles || []).map((p: any) => p.id)
    let statsMap: Record<string, any> = {}
    if (profileIds.length > 0) {
      const { data: stats } = await (supabase.from('user_stats') as any)
        .select('*')
        .in('user_id', profileIds)

      if (stats && Array.isArray(stats)) {
        for (const s of stats) {
          statsMap[s.user_id] = s
        }
      }
    }

    const results = (profiles || []).map((p: any) => {
      const conn = statusMap[p.id]
      const uStats = statsMap[p.id] || {}
      const streak = uStats.current_streak ?? (p.preferences?.admin_adjusted_streak ?? 0)
      const isDailyActive = streak > 0 || (uStats.total_sessions || 0) > 0

      return {
        id: p.id,
        name: p.display_name || 'A Believer',
        initial: (p.display_name || 'B').charAt(0).toUpperCase(),
        avatarUrl: p.avatar_url,
        church: p.church || '',
        buddyCode: p.buddy_code || '',
        streakDays: streak,
        activityLevel: streak > 0 ? `${streak}d Streak` : isDailyActive ? 'Active' : 'Believer',
        goalLength: 'Daily Devotion',
        connectionStatus: conn ? conn.status : 'none',
        connectionId: conn ? conn.connectionId : null,
      }
    })

    return NextResponse.json({ results })
  } catch (error: any) {
    console.error('API /api/buddy/search error:', error)
    return NextResponse.json({ error: error?.message || 'Search failed' }, { status: 500 })
  }
}
