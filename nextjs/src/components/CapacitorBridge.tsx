'use client'

import { useEffect } from 'react'

// Capacitor bridge — runs once per authed shell mount inside the iOS
// wrapper (no-op on web). Registers for push notifications, sends the
// APNs token to /api/devices/register, and wires the deep-link handler
// that resolves a payload's `url` into a client-side route push.
//
// All native plugins are imported dynamically so Next.js's web build
// doesn't drag the @capacitor/* runtime into the browser bundle for
// users who'll never run the app inside Capacitor.

export default function CapacitorBridge() {
  useEffect(() => {
    // Cheap web-side guard: the Capacitor runtime injects a global
    // `window.Capacitor` inside the WKWebView. On plain web that
    // global is undefined and we skip the entire bridge — which
    // matters because the dynamic imports below would otherwise pull
    // ~30KB of @capacitor/* runtime into every authed page load.
    if (typeof window === 'undefined') return
    type CapGlobal = { isNativePlatform?: () => boolean }
    const cap = (window as unknown as { Capacitor?: CapGlobal }).Capacitor
    if (!cap?.isNativePlatform?.()) return

    let cancelled = false

    void (async () => {
      const { PushNotifications } = await import('@capacitor/push-notifications')
      if (cancelled) return

      // The OS permission prompt only triggers the first time. After a
      // 'denied' response we still attach listeners — the user can flip
      // permission in iOS Settings, and our next register attempt will
      // pick that up without code changes.
      const perm = await PushNotifications.requestPermissions()
      if (perm.receive !== 'granted') {
        console.log('[capacitor] push permission not granted:', perm.receive)
        return
      }

      // `register()` triggers an async 'registration' event with the
      // APNs device token. We POST it to the server so future intro /
      // event push can fan out to this device.
      await PushNotifications.addListener('registration', async (token) => {
        try {
          await fetch('/api/devices/register', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ platform: 'ios', token: token.value }),
          })
        } catch (err) {
          console.error('[capacitor] /api/devices/register failed', err)
        }
      })

      await PushNotifications.addListener('registrationError', (err) => {
        console.error('[capacitor] APNs registration error', err)
      })

      // User tapped a notification while the app was backgrounded.
      // Payload may carry { url: '/introductions/abc-123' }; route to it.
      await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        const url = action.notification.data?.url
        if (typeof url === 'string' && url.startsWith('/')) {
          window.location.href = url
        }
      })

      await PushNotifications.register()
    })().catch((err) => {
      console.error('[capacitor] bridge init failed', err)
    })

    return () => { cancelled = true }
  }, [])

  return null
}
