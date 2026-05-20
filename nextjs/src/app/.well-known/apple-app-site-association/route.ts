import { NextResponse } from 'next/server'

// Apple App Site Association (AASA).
//
// iOS fetches https://equitaselite.com/.well-known/apple-app-site-association
// once on install (and periodically thereafter) to learn which URL paths
// should open in the EE iOS app instead of Safari. Without this file,
// tapping a magic-link / intro link in Mail or Messages opens the
// website even when the wrapper is installed.
//
// The `appID` field is `<TEAM_ID>.<BUNDLE_ID>`. Bundle ID is fixed
// (com.equitaselite.app); Team ID lives in env so we don't bake the
// Apple-side identifier into source. APPLE_TEAM_ID is set on the
// Fargate task at deploy time. Until it's set this endpoint emits an
// empty applinks payload, which is safe: iOS just won't activate
// Universal Links for the app.
//
// Path-list covers the four entry surfaces that should re-open the app:
//   /signin/*                — magic-link auth callbacks
//   /try/start/*             — public demo magic-link verification
//   /introductions/*         — push notification deep links
//   /connections/*           — accepted intro deep links
//
// Apple requires this file to be served over HTTPS, with
// Content-Type: application/json, AND with no redirects. Next.js's
// default route handler covers all three.

const BUNDLE_ID = 'com.equitaselite.app'

export const dynamic = 'force-static'

export function GET() {
  const teamId = process.env.APPLE_TEAM_ID
  const details = teamId
    ? [
        {
          appID: `${teamId}.${BUNDLE_ID}`,
          paths: [
            '/signin',
            '/signin/*',
            '/try/start/*',
            '/introductions',
            '/introductions/*',
            '/connections',
            '/connections/*',
          ],
        },
      ]
    : []

  return NextResponse.json(
    { applinks: { apps: [], details } },
    {
      headers: {
        'Content-Type':  'application/json',
        // Cache for an hour at the edge so re-installs don't hammer Lambda.
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    },
  )
}
