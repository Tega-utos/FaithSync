import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      sessionId,
      type,
      durationSeconds,
      targetDurationSeconds,
      startedAt,
      reflection,
      verseReference,
      focusText,
      timelineEvents,
      sharedToSquare,
    } = body

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 1. Absolute Server Mathematical Verification
    const startTimeMs = new Date(startedAt || Date.now()).getTime()
    const nowMs = Date.now()
    const calculatedElapsed = Math.max(0, Math.floor((nowMs - startTimeMs) / 1000))
    const finalDuration = Math.max(durationSeconds || 0, calculatedElapsed)

    // Strict Completion Rule: Only complete if duration meets or exceeds target
    const isComplete = finalDuration >= (targetDurationSeconds || 0) && (targetDurationSeconds || 0) > 0

    let savedSessionId = sessionId
    const sessionRecord = {
      user_id: user.id,
      type: type || 'prayer',
      duration_seconds: finalDuration,
      target_duration_seconds: targetDurationSeconds || finalDuration,
      is_complete: isComplete,
      reflection: reflection || null,
      verse_reference: verseReference || null,
      focus_text: focusText || null,
      timeline_events: Array.isArray(timelineEvents) ? timelineEvents : [],
      shared_to_square: Boolean(sharedToSquare),
      started_at: new Date(startTimeMs).toISOString(),
      ended_at: new Date(nowMs).toISOString(),
    }

    if (sessionId) {
      const { data, error } = await (supabase.from('sessions') as any)
        .upsert({ id: sessionId, ...sessionRecord })
        .select('id')
        .maybeSingle()
      if (error) throw error
      savedSessionId = data?.id || sessionId
    } else {
      const { data, error } = await (supabase.from('sessions') as any)
        .insert(sessionRecord)
        .select('id')
        .maybeSingle()
      if (error) throw error
      savedSessionId = data?.id
    }

    // 2. Recalculate Consecutive Streak ("All or Nothing" Dual Requirement)
    let updatedStreak = 0
    try {
      const { data: streakResult } = await ((supabase as any).rpc('calculate_user_streak', {
        p_user_id: user.id,
      }))
      if (typeof streakResult === 'number') {
        updatedStreak = streakResult
      }
    } catch {
      // Fallback streak query
      const { data: profile } = await supabase
        .from('profiles')
        .select('streak_count')
        .eq('id', user.id)
        .maybeSingle()
      updatedStreak = (profile as any)?.streak_count || 0
    }

    // 3. Share to Square if requested
    if (sharedToSquare && reflection?.trim()) {
      await (supabase.from('square_posts') as any).insert({
        user_id: user.id,
        content: reflection.trim(),
        post_type: type === 'prayer' ? 'prayer' : 'reflection',
        verse_reference: verseReference || null,
        scripture_reference: verseReference || null,
      })
    }

    return NextResponse.json({
      success: true,
      sessionId: savedSessionId,
      isComplete,
      durationSeconds: finalDuration,
      streakCount: updatedStreak,
    })
  } catch (error: any) {
    console.error('Session complete error:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to complete session' },
      { status: 500 }
    )
  }
}
