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
      isGroupSession,
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

    // 2. Personal Prayer & Study Targets (ONLY credited for Solo and 1-on-1 Buddy Clock-Ins, NOT Group Clock-Ins)
    const durationMins = Math.floor(finalDuration / 60)
    if (durationMins > 0 && !isGroupSession) {
      try {
        const { data: currentStats } = await (supabase
          .from('user_stats') as any)
          .select('total_devotion_mins, prayer_mins_today, study_mins_today, total_sessions')
          .eq('user_id', user.id)
          .maybeSingle()

        if (currentStats) {
          const updatePayload: any = {
            total_devotion_mins: (currentStats.total_devotion_mins || 0) + durationMins,
            total_sessions: (currentStats.total_sessions || 0) + 1,
            updated_at: new Date().toISOString(),
          }
          if (type === 'prayer') {
            updatePayload.prayer_mins_today = (currentStats.prayer_mins_today || 0) + durationMins
          } else {
            updatePayload.study_mins_today = (currentStats.study_mins_today || 0) + durationMins
          }
          await (supabase.from('user_stats') as any).update(updatePayload).eq('user_id', user.id)
        }
      } catch (statsErr) {
        console.error('Failed to update user_stats:', statsErr)
      }
    }

    // 3. Recalculate Consecutive Streak (Only for Solo & Buddy Clock-In)
    let updatedStreak = 0
    if (!isGroupSession) {
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
    }

    // 4. Share to Square if requested
    if (sharedToSquare && reflection?.trim()) {
      await (supabase.from('square_posts') as any).insert({
        user_id: user.id,
        content: reflection.trim(),
        post_type: type === 'prayer' ? 'prayer' : 'reflection',
        verse_reference: verseReference || null,
        scripture_reference: verseReference || null,
      })
    }

    // 5. Notify Accountability Buddies on Clock-In (In-app notification + Push alert)
    if (!isGroupSession && isComplete) {
      try {
        const { data: senderProfile } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('id', user.id)
          .maybeSingle()

        const senderName = senderProfile?.display_name || user.user_metadata?.full_name || 'Your Buddy'
        const disciplineLabel = type === 'prayer' ? 'Prayer' : 'Scripture Study'

        const { data: buddyRows } = await (supabase
          .from('buddies') as any)
          .select('user_id, buddy_id')
          .or(`user_id.eq.${user.id},buddy_id.eq.${user.id}`)
          .eq('status', 'accepted')

        if (buddyRows && buddyRows.length > 0) {
          const partnerIds = buddyRows.map((b: any) =>
            b.user_id === user.id ? b.buddy_id : b.user_id
          )

          const { data: partnerProfiles } = await (supabase
            .from('profiles') as any)
            .select('id, preferences')
            .in('id', partnerIds)

          const allowedPartnerIds: string[] = []
          ;(partnerProfiles || []).forEach((p: any) => {
            const prefs = p?.preferences || {}
            if (prefs.notifBuddyClockins !== false) {
              allowedPartnerIds.push(p.id)
            }
          })

          if (allowedPartnerIds.length > 0) {
            const notifs = allowedPartnerIds.map((pId) => ({
              user_id: pId,
              sender_id: user.id,
              type: 'buddy_clockin_completed',
              title: `${senderName} Clocked In!`,
              text: `${senderName} completed ${durationMins}m of ${disciplineLabel}.`,
              route_url: `/history`,
              icon_type: 'fire',
              is_read: false,
              created_at: new Date().toISOString(),
            }))

            await (supabase.from('notifications') as any).insert(notifs)
          }
        }
      } catch (notifErr) {
        console.error('Buddy clock-in notification error:', notifErr)
      }
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
