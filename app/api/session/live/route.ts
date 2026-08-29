import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { action, chatId, messageId, liveRoomId, discipline, targetMins, focusText } = body

    // 1. END SESSION: Server-Validated Anti-Cheat Duration
    if (action === 'end') {
      let inviteStartedAt: string | null = null
      let inviteDurationMins = targetMins || 15
      let inviteDiscipline: 'prayer' | 'study' = discipline || 'prayer'
      let inviteFocus = focusText || ''

      // Look up original clockin_invite message from Postgres if messageId provided
      if (messageId) {
        const { data: msg } = await (supabase
          .from('messages') as any)
          .select('meta, message_type, content, sender_id, recipient_id, group_id')
          .eq('id', messageId)
          .maybeSingle()

        if (msg?.meta) {
          inviteStartedAt = msg.meta.startedAt || msg.meta.scheduledAt || null
          inviteDurationMins = Number(msg.meta.durationMins) || inviteDurationMins
          inviteDiscipline = msg.meta.discipline || inviteDiscipline
          inviteFocus = msg.meta.focusText || inviteFocus
        }
      }

      // Compute deterministic elapsed minutes from server time vs startedAt
      const startMs = inviteStartedAt ? new Date(inviteStartedAt).getTime() : Date.now() - 60000
      const nowMs = Date.now()
      const serverElapsedMins = Math.max(1, Math.floor((nowMs - startMs) / 60000))
      const actualDurationMinutes = Math.min(inviteDurationMins, serverElapsedMins)
      const actualDurationSeconds = actualDurationMinutes * 60
      const targetDurationSeconds = inviteDurationMins * 60
      const isComplete = actualDurationSeconds >= targetDurationSeconds

      // 3. Insert server-validated record into sessions
      const { data: loggedSession, error: logErr } = await (supabase
        .from('sessions') as any)
        .insert({
          user_id: user.id,
          type: inviteDiscipline,
          duration_seconds: actualDurationSeconds,
          target_duration_seconds: targetDurationSeconds,
          is_complete: isComplete,
          reflection: inviteFocus || null,
          started_at: new Date(startMs).toISOString(),
          ended_at: new Date(nowMs).toISOString(),
        })
        .select()
        .single()

      if (logErr) {
        console.error('Error logging server-validated session:', logErr)
      }

      // 4. Update Consecutive Streak ("All or Nothing" Rule)
      let updatedStreak = 0
      try {
        const { data: streakResult } = await ((supabase as any).rpc('calculate_user_streak', {
          p_user_id: user.id,
        }))
        if (typeof streakResult === 'number') {
          updatedStreak = streakResult
        }
      } catch {
        const { data: profile } = await supabase
          .from('profiles')
          .select('streak_count')
          .eq('id', user.id)
          .maybeSingle()
        updatedStreak = (profile as any)?.streak_count || 0
      }

      // 5. Insert system message into chat if chatId or messageId present
      const targetChatRecipient = body.recipientId
      const targetGroupId = body.groupId
      if (targetChatRecipient || targetGroupId || chatId) {
        try {
          await (supabase.from('messages') as any).insert({
            sender_id: user.id,
            recipient_id: targetChatRecipient || null,
            group_id: targetGroupId || null,
            content: `Session ended: Logged ${actualDurationMinutes}m of ${
              inviteDiscipline === 'prayer' ? 'Prayer' : 'Scripture Study'
            }`,
            message_type: 'system',
            meta: {
              actualDurationMinutes,
              discipline: inviteDiscipline,
              isComplete,
              sessionId: loggedSession?.id,
            },
          })
        } catch (sysMsgErr) {
          console.error('System message insert note:', sysMsgErr)
        }
      }

      return NextResponse.json({
        success: true,
        sessionId: loggedSession?.id,
        durationMinutes: actualDurationMinutes,
        durationSeconds: actualDurationSeconds,
        discipline: inviteDiscipline,
        isComplete,
        streakCount: updatedStreak,
      })
    }

    // 2. START / SYNC FALLBACKS
    if (action === 'start') {
      const now = new Date().toISOString()
      return NextResponse.json({
        success: true,
        roomId: liveRoomId || `room-${Date.now()}`,
        startedAt: now,
        targetMins: targetMins || 15,
        discipline: discipline || 'prayer',
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error: any) {
    console.error('Live session lifecycle error:', error)
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 })
  }
}
