'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { driver, type Driver, type DriveStep } from 'driver.js'
import 'driver.js/dist/driver.css'
import { buildTour, type TourArgs } from '@/lib/walkthrough'

// Mounts driver.js when:
//   1. The user has a pending walkthrough (walkthrough_seen_at IS NULL)
//   2. They're on /dashboard (where every spotlight anchor exists)
//   3. The viewport is desktop-width (>= 768px) — overlay tours are
//      unusable on phones; mobile users get the tour next time they
//      visit on desktop
// On any exit (complete, X, click-outside) we POST { action: 'complete' }
// so the tour doesn't re-fire next visit.

const MOBILE_BREAKPOINT = 768

interface Props extends TourArgs {
  pending: boolean
}

export default function WalkthroughDriver(props: Props) {
  const pathname    = usePathname()
  const driverRef   = useRef<Driver | null>(null)
  const completedRef = useRef(false)

  useEffect(() => {
    if (!props.pending)              return
    if (pathname !== '/dashboard')   return
    if (typeof window === 'undefined') return
    if (window.innerWidth < MOBILE_BREAKPOINT) return
    if (driverRef.current)           return  // already started in this mount

    const steps: DriveStep[] = buildTour(props).map(s => ({
      element: s.element,
      popover: {
        title:       s.title,
        description: s.body,
      },
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
        if (completedRef.current) return
        completedRef.current = true
        fetch('/api/walkthrough', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ action: 'complete' }),
          // We don't surface errors — if this fails the tour will simply
          // re-fire on the next dashboard visit, which is acceptable.
        }).catch(() => {})
      },
    })

    driverRef.current = drv
    drv.drive()

    return () => {
      drv.destroy()
      driverRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, props.pending])

  return null
}
