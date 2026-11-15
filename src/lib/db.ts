import { PrismaClient } from '@prisma/client'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Resolve the database connection string.
 *
 * The sandbox shell can carry a stale DATABASE_URL (the scaffold's SQLite
 * file). When DATABASE_URL is missing, still a SQLite file: URL, or otherwise
 * not a PostgreSQL URL, fall back to the value declared in .env — which is
 * the embedded local Postgres in dev and your Neon URL in production.
 */
function resolveDatabaseUrl(): string | undefined {
  const envUrl = process.env.DATABASE_URL
  if (envUrl && /^postgres(ql)?:\/\//.test(envUrl)) return envUrl
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), '.env'), 'utf8')
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*DATABASE_URL\s*=\s*(.+)\s*$/)
      if (m) {
        const val = m[1].trim().replace(/^["']|["']$/g, '')
        if (val && !val.startsWith('#')) return val
      }
    }
  } catch {
    // no .env — keep whatever process.env had
  }
  return envUrl
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const datasourceUrl = resolveDatabaseUrl()

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['error', 'warn'],
    ...(datasourceUrl ? { datasourceUrl } : {}),
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
