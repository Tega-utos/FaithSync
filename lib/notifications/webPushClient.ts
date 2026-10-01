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
  if (typeof window === 'undefined') {
    return { success: false, error: 'Push notifications are not supported in this environment.' }
  }

  // iOS Safari check: Notifications only work in standalone PWA mode (added to home screen)
  if (!('Notification' in window)) {
    return {
      success: false,
      error: 'On iPhone (iOS), Web Push requires adding FaithSync to your Home Screen first! Tap the Share button in Safari -> "Add to Home Screen", then open the FaithSync app from your home screen.',
    }
  }

  if (!('serviceWorker' in navigator)) {
    return { success: false, error: 'Service Workers are not supported on this browser.' }
  }

  const perm = await Notification.requestPermission()
  if (perm !== 'granted') {
    return { success: false, error: 'Notification permission was denied. Please allow notifications in your browser or device settings.' }
  }

  try {
    const reg = await navigator.serviceWorker.ready
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'BDwApgmIg2Les1F_yn7Hs20aEIEN6N1DPJlA9uJJqEd0paFf58Pe37xbCH_bgY9kvUUQAzlNjsvd0KaoZxKdHY8'

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
