import path from 'node:path'
import { defineConfig, env } from 'prisma/config'

export default defineConfig({
  earlyAccess: true,
  schema: path.join('prisma', 'schema.prisma'),
  datasource: {
    url: env('DATABASE_URL'),
  },
  migrate: {
    adapter: async () => {
      const { PrismaPg } = await import('@prisma/adapter-pg')
      const { default: pg } = await import('pg')
      const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
      return new PrismaPg(pool)
    }
  }
})
