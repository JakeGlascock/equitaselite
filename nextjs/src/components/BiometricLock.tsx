'use client'

import { useEffect, useRef, useState } from 'react'

// App-launch + foreground Face ID gate for the Capacitor wrapper.
//
// Renders nothing on plain web. Inside the iOS app, mounts a full-bleed
// navy overlay that obscures the WebView until biometric authentication
// passes. Re-locks only when the app has been backgrounded for more
// than RELOCK_THRESHOLD_MS — brief inactive transitions (the Face ID
// prompt itself, Control Center pull, a notification banner) don't
// trigger a re-prompt, which would otherwise loop indefinitely since
// the system UI of Face ID counts as the app going inactive.
//
// Fails open in two cases — both deliberate:
//   1. The plugin reports no biometry enrolled. Forcing the user to
//      enroll Face ID before opening the app is hostile; cookies +
//      Phase A device trust are still the actual security boundary.
//   2. The plugin init throws. Don't lock the user out of their app.

const RELOCK_THRESHOLD_MS = 30_000

function isNative(): boolean {
  if (typeof window === 'undefined') return false
  type Cap = { isNativePlatform?: () => boolean }
  return (window as unknown as { Capacitor?: Cap }).Capacitor?.isNativePlatform?.() === true
}

export default function BiometricLock() {
  const [locked, setLocked]       = useState<boolean>(isNative())
  const [error, setError]         = useState<string>('')
  const [tryAuthFn, setTryAuthFn] = useState<(() => Promise<void>) | null>(null)

  // Background timestamps survive across appStateChange callback closures
  // via refs (state updates would race with the listener firing).
  const backgroundedAt = useRef<number | null>(null)
  const authInFlight   = useRef<boolean>(false)

  useEffect(() => {
    if (!isNative()) {
      setLocked(false)
      return
    }

    let cancelled = false
    let appListenerRemove: (() => void) | null = null

    void (async () => {
      const { BiometricAuth, BiometryError } =
        await import('@aparajita/capacitor-biometric-auth')
      const { App } = await import('@capacitor/app')

      const check = await BiometricAuth.checkBiometry()
      if (cancelled) return
      if (!check.isAvailable) {
        // Failsafe — no biometry enrolled, don't lock.
        setLocked(false)
        return
      }

      const doAuth = async () => {
        if (authInFlight.current) return
        authInFlight.current = true
        try {
          await BiometricAuth.authenticate({
            reason:                'Unlock Equitas Elite',
            cancelTitle:           'Cancel',
            iosFallbackTitle:      'Use Passcode',
            allowDeviceCredential: true,
          })
          if (cancelled) return
          setLocked(false)
          setError('')
        } catch (err: unknown) {
          if (cancelled) return
          const msg = (err instanceof BiometryError ? err.message : '') || 'Authentication failed'
          setError(msg)
        } finally {
          authInFlight.current = false
        }
      }
      setTryAuthFn(() => doAuth)

      // First prompt on cold launch.
      await doAuth()
      if (cancelled) return

      const handle = await App.addListener('appStateChange', ({ isActive }) => {
        if (!isActive) {
          // Mark when the app went away. Don't lock yet — the Face ID
          // prompt itself fires `isActive=false`, and we don't want
          // to flash a lock screen every time the user opens Control
          // Center either.
          backgroundedAt.current = Date.now()
          return
        }

        const since = backgroundedAt.current
        backgroundedAt.current = null
        // Only re-lock if the app was actually backgrounded for longer
        // than the threshold. A 200ms Face ID round-trip would never
        // cross this; a 60-second app-switch will.
        if (since !== null && Date.now() - since > RELOCK_THRESHOLD_MS) {
          setLocked(true)
          setError('')
          void doAuth()
        }
      })
      appListenerRemove = () => { void handle.remove() }
    })().catch((err) => {
      console.error('[biometric] init failed', err)
      setLocked(false)
    })

    return () => {
      cancelled = true
      if (appListenerRemove) appListenerRemove()
    }
  }, [])

  if (!locked) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Authentication required"
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center px-6"
      style={{
        backgroundColor: '#031427',
        paddingTop:      'env(safe-area-inset-top)',
        paddingBottom:   'env(safe-area-inset-bottom)',
      }}
    >
      <img src="/logo.png" alt="Equitas Elite" className="h-24 w-auto rounded-xl mb-6" />
      <p className="font-display text-xl text-ee-gold mb-1">Locked</p>
      <p className="text-sm text-ee-muted mb-8 text-center max-w-xs">
        Unlock Equitas Elite with Face ID or your device passcode.
      </p>
      {error && (
        <p className="text-xs text-red-400 mb-4 text-center max-w-xs">{error}</p>
      )}
      <button
        type="button"
        onClick={() => { if (tryAuthFn) void tryAuthFn() }}
        className="btn-gold w-full max-w-xs justify-center mb-3"
      >
        Try again
      </button>
      <a
        href="/api/auth/signout"
        className="text-xs text-ee-muted hover:text-ee-primary"
      >
        Sign out instead
      </a>
    </div>
  )
}
