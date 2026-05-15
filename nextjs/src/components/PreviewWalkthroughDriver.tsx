'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { driver, type Driver, type DriveStep } from 'driver.js'
import 'driver.js/dist/driver.css'
import { buildPreviewTour } from '@/lib/walkthrough'

// Investor-preview equivalent of WalkthroughDriver. Tracks dismissal in
// sessionStorage instead of the profiles table — preview visitors don't
// have a real DB row to stamp, and the ee_preview cookie is short-lived
// anyway (1h). If they reopen the preview link in a new tab they'll see
// the tour again, which is the desired UX for a fundraising demo.
//
// Mobile fallback: if the viewport is too small for driver.js we drop a
// brief one-shot toast via the dialog at the bottom. v1 just no-ops on
// mobile — fundraising demos almost always happen on desktop.

const SESSION_KEY        = 'ee_preview_tour_seen'
const MOBILE_BREAKPOINT  = 768

export default function PreviewWalkthroughDriver() {
  const pathname  = usePathname()
  const driverRef = useRef<Driver | null>(null)

  useEffect(() => {
    if (pathname !== '/dashboard')             return
    if (typeof window === 'undefined')         return
    if (window.innerWidth < MOBILE_BREAKPOINT) return
    if (sessionStorage.getItem(SESSION_KEY))   return
    if (driverRef.current)                     return

    const steps: DriveStep[] = buildPreviewTour().map(s => ({
      element: s.element,
      popover: { title: s.title, description: s.body },
    }))

    const drv = driver({
      showProgress:    true,
      allowClose:      true,
      overlayOpacity:  0.6,
      stagePadding:    6,
      stageRadius:     8,
      popoverClass:    'ee-tour',
      doneBtnText:     'Done',
      nextBtnText:     'Next',
      prevBtnText:     'Back',
      steps,
      onDestroyed: () => {
        try { sessionStorage.setItem(SESSION_KEY, '1') } catch { /* ignore */ }
      },
    })
    driverRef.current = drv
    drv.drive()

    return () => {
      drv.destroy()
      driverRef.current = null
    }
  }, [pathname])

  return null
}
