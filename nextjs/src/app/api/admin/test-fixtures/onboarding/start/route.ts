import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { isUserAdmin } from '@/lib/admin'
import { ACTING_AS_COOKIE } from '@/lib/acting-as'

// Lets an admin walk the onboarding wizard without burning a real
// Cognito invite. POST here resets the test fixture profile to a
// pristine "just invited" state and sets the acting-as cookie to it —
// the next /dashboard load redirects to /onboarding and the wizard
// runs against the fixture. Submitting writes to the fixture's row
// (verifiable via DB), and clicking "Exit" in the top banner returns
// the admin to their own session.

const FIXTURE_ID    = 'test_onboarding_fixture'
const FIXTURE_EMAIL = 'test_onboarding@example.com'
const SECURE        = process.env.NODE_ENV === 'production'

export async function POST(req: NextRequest) {
  const actualUserId = req.headers.get('x-user-id')
  const userEmail    = req.headers.get('x-user-email')
  if (!actualUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!(await isUserAdmin(actualUserId, userEmail))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Reset the fixture to its pristine state. The is_test = TRUE guard
  // prevents this from ever clobbering a real profile if the id got
  // typo'd in a future edit.
  await query(
    `UPDATE profiles SET
       email                       = $2,
       role                        = 'angel',
       full_name                   = 'Test Onboarding',
       title                       = NULL,
       firm_name                   = 'Test Fixture',
       location                    = NULL,
       aum                         = NULL,
       sectors                     = '{}',
       stages                      = '{}',
       geography                   = '{}',
       check_size_min              = 0,
       check_size_max              = 0,
       risk_tolerance              = NULL,
       expected_return             = NULL,
       timeline                    = NULL,
       mandate_type                = NULL,
       concentration               = NULL,
       onboarding_completed        = FALSE,
       email_notifications_enabled = FALSE
     WHERE id = $1 AND is_test = TRUE`,
    [FIXTURE_ID, FIXTURE_EMAIL]
  )

  const res = NextResponse.json({ ok: true, fixtureId: FIXTURE_ID })
  res.cookies.set(ACTING_AS_COOKIE, FIXTURE_ID, {
    httpOnly: true,
    secure:   SECURE,
    sameSite: 'lax',
    path:     '/',
    maxAge:   8 * 60 * 60,
  })
  return res
}
