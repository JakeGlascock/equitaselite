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
      ssl:      process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false,
      max:      10,
      idleTimeoutMillis: 30_000,
    })
  }
  return pool
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function query<T>(sql: string, params?: unknown[]): Promise<T[]> {
  const result = await getPool().query<any>(sql, params)
  return result.rows as T[]
}

export async function queryOne<T>(sql: string, params?: unknown[]): Promise<T | null> {
  const rows = await query<T>(sql, params)
  return rows[0] ?? null
}
