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
    const { action, targetUserId, targetUserIds, groupId, type, title, message, url } = body

    // 1. Web Push Subscription Registration
    if (action === 'subscribe') {
      const { endpoint, p256dh, auth, auth_key } = body
      const subEndpoint = endpoint || body.subscription?.endpoint
      const subP256dh = p256dh || body.subscription?.keys?.p256dh
      const subAuth = auth || auth_key || body.subscription?.keys?.auth

      if (!subEndpoint || !subP256dh || !subAuth) {
        return NextResponse.json({ error: 'Invalid subscription payload' }, { status: 400 })
      }

      await ((supabase as any).from('push_subscriptions')).upsert(
        {
          user_id: user.id,
          endpoint: subEndpoint,
          p256dh: subP256dh,
          auth_key: subAuth,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id, endpoint' }
      )

      return NextResponse.json({ success: true, message: 'Push subscription registered' })
    }

    // 2. Dispatch Push & In-App Notification (Single or Batched)
    const targets: string[] = Array.isArray(targetUserIds)
      ? targetUserIds
      : targetUserId
      ? [targetUserId]
      : []

    if (targets.length === 0 && !groupId) {
      return NextResponse.json({ error: 'targetUserIds or groupId required' }, { status: 400 })
    }

    // Fetch sender profile name
    const { data: senderProfile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .single()

    const senderName = senderProfile?.display_name || user.user_metadata?.full_name || 'Accountability Partner'

    let notifTitle = title || 'FaithSync Notification'
    let notifBody = message || 'You have a new devotion alert.'
    let routeUrl = url

    if (type === 'clockin_invite') {
      notifTitle = 'Clock-In Invitation'
      notifBody = `${senderName} invited you to join a live Clock-In session!`
      if (!routeUrl) routeUrl = `/buddy-chat/${user.id}`
    } else if (type === 'wave' || type === 'group_session') {
      notifTitle = 'Live Cohort Devotion'
      notifBody = `${senderName} started a live session in your group!`
      if (!routeUrl) routeUrl = groupId ? `/group-chat/${groupId}` : '/sync'
    } else if (type === 'nudge') {
      notifTitle = 'Accountability Nudge'
      notifBody = `${senderName} sent you an encouragement nudge: "Keep showing up!"`
      if (!routeUrl) routeUrl = `/buddy-chat/${user.id}`
    }

    if (!routeUrl) routeUrl = '/sync'

    // If group target, resolve group member IDs
    if (groupId && targets.length === 0) {
      const { data: members } = await (supabase
        .from('group_members') as any)
        .select('user_id')
        .eq('group_id', groupId)
        .neq('user_id', user.id)

      ;(members || []).forEach((m: any) => {
        if (m.user_id) targets.push(m.user_id)
      })
    }

    // A. Insert in-app notifications
    if (targets.length > 0) {
      const notificationsToInsert = targets.map((tId) => ({
        user_id: tId,
        sender_id: user.id,
        text: notifBody,
        title: notifTitle,
        type: type || 'nudge',
        is_read: false,
        route_url: routeUrl,
        icon_type: type === 'clockin_invite' ? 'timer' : type === 'wave' ? 'fire' : 'hands_praying',
      }))

      try {
        await (supabase.from('notifications') as any).insert(notificationsToInsert)
      } catch (dbErr) {
        console.error('In-app notification insert note:', dbErr)
      }
    }

    // B. Query push subscriptions for targets & send Web Push
    try {
      const { data: subscriptions } = await ((supabase as any).from('push_subscriptions'))
        .select('id, user_id, endpoint, p256dh, auth_key')
        .in('user_id', targets)

      if (subscriptions && subscriptions.length > 0 && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_PUBLIC_KEY) {
        // Optional dynamic import for web-push to prevent bundling if not installed
        try {
          const webpush = await import('web-push')
          webpush.default.setVapidDetails(
            process.env.VAPID_SUBJECT || 'mailto:support@faithsync.app',
            process.env.VAPID_PUBLIC_KEY,
            process.env.VAPID_PRIVATE_KEY
          )

          const payload = JSON.stringify({
            title: notifTitle,
            body: notifBody,
            url: routeUrl,
          })

          const expiredSubIds: string[] = []

          await Promise.allSettled(
            subscriptions.map(async (sub: any) => {
              try {
                await webpush.default.sendNotification(
                  {
                    endpoint: sub.endpoint,
                    keys: {
                      p256dh: sub.p256dh,
                      auth: sub.auth_key,
                    },
                  },
                  payload
                )
              } catch (pushErr: any) {
                // Prune 410 Gone / 404 Not Found subscriptions
                if (pushErr?.statusCode === 410 || pushErr?.statusCode === 404) {
                  expiredSubIds.push(sub.id)
                }
              }
            })
          )

          if (expiredSubIds.length > 0) {
            await ((supabase as any).from('push_subscriptions'))
              .delete()
              .in('id', expiredSubIds)
          }
        } catch (webPushImportErr) {
          console.log('web-push execution note:', webPushImportErr)
        }
      }
    } catch (pushLookupErr) {
      console.error('Push lookup note:', pushLookupErr)
    }

    return NextResponse.json({
      success: true,
      dispatchedCount: targets.length,
      title: notifTitle,
      body: notifBody,
    })
  } catch (error: any) {
    console.error('Push notification error:', error)
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 })
  }
}
