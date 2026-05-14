import { Pool } from 'pg'

let pool: Pool | null = null

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      host:     process.env.DB_HOST,
      port:     Number(process.env.DB_PORT ?? 5432),
      database: process.env.DB_NAME,
      user:     process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      // RDS enforces SSL via rds.force_ssl=1, so we must upgrade to TLS for
      // any *.amazonaws.com host. (Previously this keyed off NODE_ENV, but
      // Next.js's standalone server silently forces NODE_ENV=production
      // regardless of what ECS sets — relying on that is brittle, and the
      // migration runner outside Next.js doesn't get that treatment.)
      // rejectUnauthorized: false is acceptable here — the connection is
      // already inside the private VPC. Upgrade path: bundle the RDS CA bundle
      // in the image and set ca + rejectUnauthorized: true.
      ssl: (process.env.DB_HOST ?? '').endsWith('.amazonaws.com')
        ? { rejectUnauthorized: false }
        : false,
      max:      10,
      idleTimeoutMillis: 30_000,
    })
  }
  return pool
}

export async function query<T>(sql: string, params?: unknown[]): Promise<T[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await getPool().query<any>(sql, params)
  return result.rows as T[]
}

export async function queryOne<T>(sql: string, params?: unknown[]): Promise<T | null> {
  const rows = await query<T>(sql, params)
  return rows[0] ?? null
}
