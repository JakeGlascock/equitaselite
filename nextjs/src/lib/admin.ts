import { queryOne } from './db'

/**
 * Returns true if the user has admin rights.
 *
 * Canonical source is the `profiles.is_admin` column. The ADMIN_EMAILS env
 * var is preserved as a break-glass fallback so the initial admin can
 * bootstrap themselves before the column exists, and so an accidental
 * self-revoke can be recovered without database surgery.
 */
export async function isUserAdmin(
  userId: string | null,
  userEmail: string | null,
): Promise<boolean> {
  // Primary: DB column (only meaningful once the user has a profile)
  if (userId) {
    try {
      const row = await queryOne<{ is_admin: boolean }>(
        'SELECT is_admin FROM profiles WHERE id = $1',
        [userId]
      )
      if (row?.is_admin) return true
    } catch { /* column may not exist yet; fall through */ }
  }

  // Fallback: env-var list (used pre-bootstrap and as break-glass)
  if (!userEmail) return false
  const admins = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)
  return admins.includes(userEmail.toLowerCase())
}
