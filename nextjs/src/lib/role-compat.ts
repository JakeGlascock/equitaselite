// Role compatibility matrix (migration 035 / Phase E3).
//
// Replaces the bipartite Angel ↔ FO logic with explicit who-matches-whom
// across five investor-side roles. Each viewer role lists which
// candidate roles it sees in match results. Self-role matching is
// enabled only where peer networking is the actual use case — see
// project_equitaselite_role_types_design.md for the locked decisions.
//
// The order of roles in each viewer's array also defines the priority
// used to pick a multi-role candidate's "match-side" role for mandate
// JOIN + scoring (first hit in this array that the candidate holds).

export type Role =
  | 'angel'
  | 'family_office'
  | 'family_foundation'
  | 'daf'
  | 'next_gen'

export type ConciergeRole = 'concierge'

export const INVESTOR_ROLES: Role[] = [
  'angel', 'family_office', 'family_foundation', 'daf', 'next_gen',
]

export const ROLE_LABELS: Record<Role, string> = {
  angel:             'Angel Investor',
  family_office:     'Family Office',
  family_foundation: 'Family Foundation',
  daf:               'DAF',
  next_gen:          'Next Gen',
}

export const ROLE_FLAG_COLUMN: Record<Role, string> = {
  angel:             'is_angel',
  family_office:     'is_family_office',
  family_foundation: 'is_family_foundation',
  daf:               'is_daf',
  next_gen:          'is_next_gen',
}

// 5x5 compatibility matrix. Read as: "if I'm viewing as X, I see
// candidates of these roles." Locked 2026-05-19.
export const COMPATIBILITY: Record<Role, Role[]> = {
  // Angels see FOs, charitable counterparties, generational peers,
  // and other Angels (co-invest networking).
  angel:             ['family_office', 'family_foundation', 'daf', 'next_gen', 'angel'],
  // FOs see Angels, charitable counterparties, generational peers.
  // FO-FO disabled — two FOs don't typically counterpart each other.
  family_office:     ['angel', 'family_foundation', 'daf', 'next_gen'],
  // Foundations match with all investor types including other
  // Foundations (philanthropic peer co-investing).
  family_foundation: ['angel', 'family_office', 'family_foundation', 'daf'],
  // DAFs are administrative; peer-networking light, no DAF-DAF.
  daf:               ['angel', 'family_office', 'family_foundation'],
  // Next-Gens are about peer mentorship + connecting with established
  // institutions. NG-NG enabled for peer learning.
  next_gen:          ['angel', 'family_office', 'next_gen'],
}

// All compatible candidate roles for a viewer who holds multiple
// investor-side roles. Used when the dashboard context selector says
// "Viewing as Angel" but Chelsea is also FO + Next-Gen — for the
// /match/[id] privacy gate we want the UNION of all her possible
// counterparty roles.
export function compatibleRolesForMany(viewerRoles: Role[]): Role[] {
  const set = new Set<Role>()
  for (const v of viewerRoles) {
    for (const c of COMPATIBILITY[v]) set.add(c)
  }
  return Array.from(set)
}

// Pick which of a multi-role candidate's roles to use for mandate
// JOIN + scoring when the viewer is browsing as `viewerRole`. Returns
// the first role in COMPATIBILITY[viewerRole] that the candidate
// holds. Returns null if the candidate has no compatible role.
export function pickMatchRoleForCandidate(
  viewerRole: Role,
  candidateFlags: { is_angel?: boolean | null
                  ; is_family_office?: boolean | null
                  ; is_family_foundation?: boolean | null
                  ; is_daf?: boolean | null
                  ; is_next_gen?: boolean | null },
): Role | null {
  for (const r of COMPATIBILITY[viewerRole]) {
    if (candidateFlags[ROLE_FLAG_COLUMN[r] as keyof typeof candidateFlags]) return r
  }
  return null
}

// SQL fragment: WHERE clause filtering candidates to those holding any
// role compatible with the viewer's role. Caller provides the table
// alias (typically 'p' for profiles).
export function compatibleFlagsWhere(viewerRole: Role, profileAlias: string): string {
  const flags = COMPATIBILITY[viewerRole].map(r => `${profileAlias}.${ROLE_FLAG_COLUMN[r]} = TRUE`)
  return `(${flags.join(' OR ')})`
}

// SQL CASE expression: picks the candidate's "match-side" role for the
// mandate JOIN, based on COMPATIBILITY[viewerRole] priority. Returns
// the role string. Embeds plain in the JOIN's ON condition.
export function matchRoleCaseExpr(viewerRole: Role, profileAlias: string): string {
  const branches = COMPATIBILITY[viewerRole]
    .map(r => `WHEN ${profileAlias}.${ROLE_FLAG_COLUMN[r]} = TRUE THEN '${r}'`)
    .join('\n         ')
  return `(CASE
         ${branches}
       END)`
}

// All roles a profile holds, derived from its flags. Order returned is
// stable (INVESTOR_ROLES order) so callers can pick a default.
export function rolesHeldBy(flags: {
  is_angel?: boolean | null
  is_family_office?: boolean | null
  is_family_foundation?: boolean | null
  is_daf?: boolean | null
  is_next_gen?: boolean | null
}): Role[] {
  const out: Role[] = []
  if (flags.is_angel)             out.push('angel')
  if (flags.is_family_office)     out.push('family_office')
  if (flags.is_family_foundation) out.push('family_foundation')
  if (flags.is_daf)               out.push('daf')
  if (flags.is_next_gen)          out.push('next_gen')
  return out
}
