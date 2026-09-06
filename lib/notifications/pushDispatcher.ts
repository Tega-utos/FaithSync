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
