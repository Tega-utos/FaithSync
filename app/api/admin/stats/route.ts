import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifySuperAdmin } from '@/lib/admin/adminAuth'

export async function GET() {
  try {
    const supabase = await createClient()
    const { user, isAuthorized } = await verifySuperAdmin(supabase)

    if (!isAuthorized || !user) {
      return NextResponse.json({ error: 'Forbidden: Super Admin Access Required' }, { status: 403 })
    }

    // 1. Total Believers Count
    const { count: totalUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })

    // 2. Total Devotion Sessions Count
    const { count: totalSessions } = await supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true })

    // 3. Total Community Square Posts Count
    const { count: totalPosts } = await supabase
      .from('square_posts')
      .select('*', { count: 'exact', head: true })

    // 4. Total Active Groups
    const { count: totalGroups } = await supabase
      .from('groups')
      .select('*', { count: 'exact', head: true })

    // 5. Total Buddy Connections
    const { count: totalBuddies } = await supabase
      .from('buddies')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'accepted')

    // 6. Aggregate Global Devotion Minutes
    const { data: statsSum } = await (supabase.from('user_stats') as any)
      .select('total_devotion_mins, prayer_mins_today, study_mins_today')

    let totalGlobalDevotionMins = 0
    let totalPrayerMinsToday = 0
    let totalStudyMinsToday = 0

    if (statsSum && Array.isArray(statsSum)) {
      for (const s of statsSum) {
        totalGlobalDevotionMins += s.total_devotion_mins || 0
        totalPrayerMinsToday += s.prayer_mins_today || 0
        totalStudyMinsToday += s.study_mins_today || 0
      }
    }

    // 7. Recent Devotion Activity Stream
    const { data: recentSessions } = await supabase
      .from('sessions')
      .select('id, type, duration_seconds, started_at, is_complete, profiles:user_id(display_name, church)')
      .order('started_at', { ascending: false })
      .limit(10)

    return NextResponse.json({
      success: true,
      stats: {
        totalUsers: totalUsers || 0,
        totalSessions: totalSessions || 0,
        totalPosts: totalPosts || 0,
        totalGroups: totalGroups || 0,
        totalBuddies: totalBuddies || 0,
        totalGlobalDevotionHours: Math.round(totalGlobalDevotionMins / 60),
        totalGlobalDevotionMins,
        totalPrayerMinsToday,
        totalStudyMinsToday,
      },
      recentSessions: recentSessions || [],
    })
  } catch (err: any) {
    console.error('Admin stats error:', err)
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 })
  }
}
