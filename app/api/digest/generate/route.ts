import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    // 1. Fetch Past 7 Days of Completed Sessions
    const { data: sessions, error } = await supabase
      .from('sessions')
      .select('type, duration_seconds, target_duration_seconds, reflection, started_at, created_at, is_complete')
      .eq('user_id', user.id)
      .gte('started_at', sevenDaysAgo)
      .order('started_at', { ascending: false })

    if (error) throw error

    let totalPrayerSeconds = 0
    let totalStudySeconds = 0
    const reflections: string[] = []

    ;(sessions || []).forEach((s: any) => {
      if (s.type === 'prayer') totalPrayerSeconds += s.duration_seconds || 0
      if (s.type === 'study' || s.type === 'word') totalStudySeconds += s.duration_seconds || 0
      if (s.reflection && s.reflection.trim()) {
        reflections.push(s.reflection.trim())
      }
    })

    const prayerMinutes = Math.floor(totalPrayerSeconds / 60)
    const studyMinutes = Math.floor(totalStudySeconds / 60)

    // 2. Keyword Frequency Analysis on Reflections
    const commonTopics = [
      '#Family',
      '#Peace',
      '#Anxiety',
      '#Grace',
      '#Work',
      '#Calling',
      '#Healing',
      '#Praise',
      '#Guidance',
      '#Faith',
      '#Patience',
    ]

    const keywordCounts: Record<string, number> = {}
    commonTopics.forEach((t) => (keywordCounts[t] = 0))

    const allText = reflections.join(' ').toLowerCase()
    commonTopics.forEach((tag) => {
      const keyword = tag.replace('#', '').toLowerCase()
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi')
      const matches = allText.match(regex)
      if (matches) {
        keywordCounts[tag] = matches.length
      }
    })

    // Rank top keywords
    const topKeywords = Object.entries(keywordCounts)
      .sort((a, b) => b[1] - a[1])
      .filter(([_, count]) => count > 0)
      .slice(0, 4)
      .map(([tag]) => tag)

    // 3. Tailored AI Digest Summary
    let aiSummary = `You dedicated ${prayerMinutes} minutes to Prayer and ${studyMinutes} minutes to Scripture Study over the past 7 days.`
    if (topKeywords.length > 0) {
      aiSummary += ` Your reflections centered predominantly around ${topKeywords.join(', ')}.`
    }
    if (prayerMinutes > 60 && studyMinutes > 60) {
      aiSummary += ' Exceptional balance and perseverance in your daily walk with the Lord.'
    } else {
      aiSummary += ' Continue pressing forward day by day in consistency and prayer.'
    }

    return NextResponse.json({
      success: true,
      stats: {
        prayerMinutes,
        studyMinutes,
        totalSessions: (sessions || []).length,
        topKeywords: topKeywords.length > 0 ? topKeywords : ['#Faith', '#Grace', '#Peace'],
        aiSummary,
      },
    })
  } catch (error: any) {
    console.error('Digest generation error:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to generate weekly review digest' },
      { status: 500 }
    )
  }
}
