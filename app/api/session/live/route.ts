import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculateUserStreak } from '@/lib/utils/streak'

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

      // 3. Insert server-validated record into sessions (for Solo and Buddy clock-ins only, not Group sessions)
      const isGroupSession = Boolean(body.groupId || body.isGroup)
      let loggedSession: any = null
      let updatedStreak = 0

      if (!isGroupSession && actualDurationMinutes >= 1) {
        const { data: inserted, error: logErr } = await (supabase
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
        } else {
          loggedSession = inserted
        }

        // 4. Update Consecutive Streak ("All or Nothing" Rule)
        try {
          updatedStreak = await calculateUserStreak(user.id, supabase)
          await Promise.allSettled([
            (supabase.from('user_stats') as any)
              .update({ current_streak: updatedStreak, updated_at: new Date().toISOString() })
              .eq('user_id', user.id),
            (supabase.from('profiles') as any)
              .update({ streak_count: updatedStreak })
              .eq('id', user.id),
          ])
        } catch (streakErr) {
          console.warn('Failed to update streak in live session:', streakErr)
        }
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
      const startDiscipline = discipline || 'prayer'
      const startTargetMins = targetMins || 15
      const disciplineLabel = startDiscipline === 'prayer' ? 'Prayer' : 'Scripture Study'

      // Optionally notify buddies of live altar session
      if (body.notifyPartners !== false) {
        try {
          const { data: senderProfile } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('id', user.id)
            .maybeSingle()

          const senderName = senderProfile?.display_name || user.user_metadata?.full_name || 'Your Buddy'

          const { data: buddyRows } = await (supabase
            .from('buddies') as any)
            .select('user_id, buddy_id, permissions')
            .or(`user_id.eq.${user.id},buddy_id.eq.${user.id}`)
            .eq('status', 'accepted')

          if (buddyRows && buddyRows.length > 0) {
            const partnerIds = buddyRows
              .filter((b: any) => {
                const perms = b.permissions || {}
                return perms.sendNotificationOnStart !== false
              })
              .map((b: any) => (b.user_id === user.id ? b.buddy_id : b.user_id))

            if (partnerIds.length > 0) {
              const { data: partnerProfiles } = await (supabase
                .from('profiles') as any)
                .select('id, preferences')
                .in('id', partnerIds)

              const allowedIds = (partnerProfiles || [])
                .filter((p: any) => (p?.preferences?.notifBuddyLiveSessions ?? true))
                .map((p: any) => p.id)

              if (allowedIds.length > 0) {
                const { dispatchServerNotification } = await import('@/lib/notifications/pushDispatcher')
                await dispatchServerNotification({
                  supabase,
                  senderId: user.id,
                  senderName,
                  targetUserIds: allowedIds,
                  type: 'buddy_clockin_started',
                  title: 'Live Altar Started',
                  message: `🔥 ${senderName} is on the Altar! Tapped in for ${startTargetMins}m of ${disciplineLabel} — tap to join live.`,
                  url: `/buddy-chat/${user.id}?joinLive=true`,
                  icon: 'fire',
                })
              }
            }
          }
        } catch (startNotifErr) {
          console.error('Live altar start notification note:', startNotifErr)
        }
      }

      return NextResponse.json({
        success: true,
        roomId: liveRoomId || `room-${Date.now()}`,
        startedAt: now,
        targetMins: startTargetMins,
        discipline: startDiscipline,
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error: any) {
    console.error('Live session lifecycle error:', error)
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 })
  }
}
