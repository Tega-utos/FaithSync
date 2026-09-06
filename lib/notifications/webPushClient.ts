'use client'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export async function registerPushSubscription(): Promise<{ success: boolean; error?: string }> {
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
    return { success: false, error: 'Push notifications are not supported on this device/browser.' }
  }

  const perm = await Notification.requestPermission()
  if (perm !== 'granted') {
    return { success: false, error: 'Notification permission was denied.' }
  }

  try {
    const reg = await navigator.serviceWorker.ready
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

    let sub = await reg.pushManager.getSubscription()
    if (!sub && vapidKey) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })
    }

    if (sub) {
      const subJson = sub.toJSON()
      await fetch('/api/notifications/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'subscribe',
          endpoint: sub.endpoint,
          p256dh: subJson.keys?.p256dh,
          auth: subJson.keys?.auth,
        }),
      })
    }

    return { success: true }
  } catch (err: any) {
    console.error('Push registration error:', err)
    return { success: false, error: err?.message || 'Failed to register push subscription' }
  }
}
