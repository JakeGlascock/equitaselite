'use client'

import { useEffect, useState } from 'react'

// App-launch + foreground Face ID gate for the Capacitor wrapper.
//
// Pattern: banking-app lock screen. Renders nothing on plain web. Inside
// the iOS app, mounts a full-bleed navy overlay that obscures the
// WebView contents until biometric authentication passes. Re-locks on
// every background→foreground transition so an attacker who picks up
// an unlocked phone in airplane mode can't slip in by switching apps.
//
// Fails open in two cases — both deliberate:
//   1. The plugin reports no biometry available (Face ID not enrolled).
//      Forcing the user to enroll Face ID before opening the app is
//      hostile; cookies + Phase A device trust are still the actual
//      security boundary. The lock is an extra layer, not the primary
//      auth.
//   2. The plugin initialization throws (missing capability, OS bug).
//      Same reasoning — don't lock the user out of their own app.

function isNative(): boolean {
  if (typeof window === 'undefined') return false
  type Cap = { isNativePlatform?: () => boolean }
  return (window as unknown as { Capacitor?: Cap }).Capacitor?.isNativePlatform?.() === true
}

export default function BiometricLock() {
  const [locked, setLocked]       = useState<boolean>(isNative())
  const [error, setError]         = useState<string>('')
  const [tryAuthFn, setTryAuthFn] = useState<(() => Promise<void>) | null>(null)

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
        // No Face ID / Touch ID enrolled — fail open.
        setLocked(false)
        return
      }

      const doAuth = async () => {
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
        }
      }
      setTryAuthFn(() => doAuth)

      // First prompt on mount (cold launch).
      await doAuth()
      if (cancelled) return

      // Re-lock + re-prompt on every background→foreground transition.
      const handle = await App.addListener('appStateChange', ({ isActive }) => {
        if (!isActive) {
          setLocked(true)
          setError('')
        } else {
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
