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

      // 6. Dispatch Completion Notifications to Buddy or Group Cohort
      try {
        const { data: senderProf } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('id', user.id)
          .maybeSingle()

        const senderName = senderProf?.display_name || user.user_metadata?.full_name || 'Your Partner'
        const disciplineLabel = inviteDiscipline === 'prayer' ? 'Prayer' : 'Scripture Study'
        const { dispatchServerNotification } = await import('@/lib/notifications/pushDispatcher')

        if (targetGroupId) {
          const [{ data: grp }, { data: members }] = await Promise.all([
            (supabase.from('groups') as any)
              .select('name')
              .eq('id', targetGroupId)
              .maybeSingle(),
            (supabase.from('group_members') as any)
              .select('user_id')
              .eq('group_id', targetGroupId)
              .neq('user_id', user.id),
          ])

          const groupName = grp?.name || 'Fellowship Group'
          const memberIds = (members || []).map((m: any) => m.user_id).filter(Boolean)

          if (memberIds.length > 0) {
            await dispatchServerNotification({
              supabase,
              senderId: user.id,
              senderName,
              targetUserIds: memberIds,
              type: 'group_clockin_completed',
              title: `${senderName} Completed Altar`,
              message: `🕊️ ${senderName} completed ${actualDurationMinutes}m of ${disciplineLabel} in ${groupName}!`,
              url: `/group-chat/${targetGroupId}`,
              icon: 'fire',
            })
          }
        } else if (targetChatRecipient) {
          await dispatchServerNotification({
            supabase,
            senderId: user.id,
            senderName,
            targetUserIds: [targetChatRecipient],
            type: 'buddy_clockin_completed',
            title: `${senderName} Clocked Out!`,
            message: `🕊️ ${senderName} completed ${actualDurationMinutes}m of ${disciplineLabel}!${
              updatedStreak > 0 ? ` Streak: ${updatedStreak} days 🔥` : ''
            }`,
            url: `/buddy-chat/${user.id}`,
            icon: 'fire',
          })
        }
      } catch (endNotifErr) {
        console.error('Session end notification dispatch note:', endNotifErr)
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
      const isGroup = Boolean(body.groupId || body.isGroup)
      const targetGroupId = body.groupId

      // Notify buddies or group cohort of live altar session
      if (body.notifyPartners !== false) {
        try {
          const { data: senderProfile } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('id', user.id)
            .maybeSingle()

          const senderName = senderProfile?.display_name || user.user_metadata?.full_name || 'Your Buddy'
          const { dispatchServerNotification } = await import('@/lib/notifications/pushDispatcher')

          if (isGroup && targetGroupId) {
            // Group Clock-In Start Notification
            const [{ data: grp }, { data: members }] = await Promise.all([
              (supabase.from('groups') as any)
                .select('name')
                .eq('id', targetGroupId)
                .maybeSingle(),
              (supabase.from('group_members') as any)
                .select('user_id')
                .eq('group_id', targetGroupId)
                .neq('user_id', user.id),
            ])

            const groupName = grp?.name || 'Fellowship Group'
            const memberIds = (members || []).map((m: any) => m.user_id).filter(Boolean)

            if (memberIds.length > 0) {
              await dispatchServerNotification({
                supabase,
                senderId: user.id,
                senderName,
                targetUserIds: memberIds,
                type: 'group_clockin_started',
                title: 'Group Altar Started',
                message: `🔥 ${senderName} started a Group Altar in ${groupName}! Tapped in for ${startTargetMins}m of ${disciplineLabel} — tap to join.`,
                url: `/group-chat/${targetGroupId}?joinLive=true`,
                icon: 'timer',
              })
            }
          } else {
            // 1-on-1 Buddy Clock-In Start Notification
            const targetRecipientId = body.recipientId
            if (targetRecipientId) {
              await dispatchServerNotification({
                supabase,
                senderId: user.id,
                senderName,
                targetUserIds: [targetRecipientId],
                type: 'buddy_clockin_started',
                title: 'Live Altar Started',
                message: `🔥 ${senderName} is on the Altar! Tapped in for ${startTargetMins}m of ${disciplineLabel} — tap to join live.`,
                url: `/buddy-chat/${user.id}?joinLive=true`,
                icon: 'timer',
              })
            } else {
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
                    await dispatchServerNotification({
                      supabase,
                      senderId: user.id,
                      senderName,
                      targetUserIds: allowedIds,
                      type: 'buddy_clockin_started',
                      title: 'Live Altar Started',
                      message: `🔥 ${senderName} is on the Altar! Tapped in for ${startTargetMins}m of ${disciplineLabel} — tap to join live.`,
                      url: `/buddy-chat/${user.id}?joinLive=true`,
                      icon: 'timer',
                    })
                  }
                }
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
