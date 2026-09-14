import { SupabaseClient } from '@supabase/supabase-js'

export interface DispatchNotificationParams {
  supabase: SupabaseClient
  senderId?: string
  senderName?: string
  targetUserIds: string[]
  type: string
  title: string
  message: string
  url?: string
  icon?: string
}

export function getPushIconUrl(type?: string, icon?: string): string {
  if (
    icon === 'fire' ||
    icon === 'flame' ||
    type === 'streak_milestone' ||
    type === 'buddy_clockin_completed' ||
    type === 'group_clockin_completed' ||
    type === 'streak_at_risk'
  ) {
    return '/assets/fire.svg'
  }
  if (
    icon === 'clock' ||
    icon === 'timer' ||
    type === 'timer_invite' ||
    type === 'clockin_invite' ||
    type === 'buddy_clockin_started' ||
    type === 'group_clockin_started' ||
    type === 'daily_reminder'
  ) {
    return '/assets/icon-timer-active.svg'
  }
  if (
    icon === 'chat_circle' ||
    icon === 'quotes' ||
    type === 'buddy_message' ||
    type === 'group_message' ||
    type === 'square_comment'
  ) {
    return '/assets/icon-sync-active.svg'
  }
  if (
    icon === 'hands_praying' ||
    type === 'intercession_connected' ||
    type === 'prayer_request'
  ) {
    return '/assets/hand-prayer.svg'
  }
  if (
    icon === 'sparkle' ||
    type === 'intercession_completed' ||
    type === 'buddy_accepted'
  ) {
    return '/assets/icon-sparkles.svg'
  }
  return '/assets/logo.png'
}

export async function dispatchServerNotification({
  supabase,
  senderId,
  senderName,
  targetUserIds,
  type,
  title,
  message,
  url,
  icon,
}: DispatchNotificationParams) {
  if (!targetUserIds || targetUserIds.length === 0) return { success: true, count: 0 }

  const routeUrl = url || '/sync'
  const notifIcon = icon || 'bell'
  const pushIconUrl = getPushIconUrl(type, notifIcon)

  // 1. Insert In-App Notifications
  try {
    const notificationsToInsert = targetUserIds.map((tId) => ({
      user_id: tId,
      sender_id: senderId || null,
      text: message,
      title: title,
      type: type,
      is_read: false,
      route_url: routeUrl,
      icon_type: notifIcon,
    }))

    await (supabase.from('notifications') as any).insert(notificationsToInsert)
  } catch (dbErr) {
    console.error('In-app notification insert note:', dbErr)
  }

  // 2. Dispatch Web Push
  try {
    const { data: subscriptions } = await ((supabase as any).from('push_subscriptions'))
      .select('id, user_id, endpoint, p256dh, auth_key')
      .in('user_id', targetUserIds)

    if (
      subscriptions &&
      subscriptions.length > 0 &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_PUBLIC_KEY
    ) {
      try {
        const webpush = await import('web-push')
        webpush.default.setVapidDetails(
          process.env.VAPID_SUBJECT || 'mailto:support@faithsync.app',
          process.env.VAPID_PUBLIC_KEY,
          process.env.VAPID_PRIVATE_KEY
        )

        const payload = JSON.stringify({
          title,
          body: message,
          icon: pushIconUrl,
          badge: '/assets/logo.png',
          url: routeUrl,
          tag: `${type}-${Date.now()}`,
          data: {
            url: routeUrl,
            type,
            icon: pushIconUrl,
          },
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
      } catch (webPushErr) {
        console.log('web-push execution note:', webPushErr)
      }
    }
  } catch (pushLookupErr) {
    console.error('Push lookup note:', pushLookupErr)
  }

  return { success: true, count: targetUserIds.length }
}
