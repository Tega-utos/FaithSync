'use client'

import { useEffect } from 'react'

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('FaithSync Service Worker registered successfully:', reg.scope)
        })
        .catch((err) => {
          console.debug('Service Worker registration skipped or failed:', err)
        })
    }
  }, [])

  return null
}
