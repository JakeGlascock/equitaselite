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
      // RDS uses Amazon's CA which isn't in Node's default root bundle. The
      // connection is still TLS-encrypted and the DB is only reachable from
      // within our private VPC (no internet exposure), so rejectUnauthorized:
      // false is acceptable. Upgrade path: bundle rds-ca-2019-root.pem in the
      // image and set ca + rejectUnauthorized: true.
      ssl:      process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
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
