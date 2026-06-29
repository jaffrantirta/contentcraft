import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import * as schema from "./schema"

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>

let _db: DrizzleDb | null = null

function getDb(): DrizzleDb {
  if (!_db) {
    const sql = neon(process.env.DATABASE_URL!)
    _db = drizzle(sql, { schema })
  }
  return _db
}

// Proxy with proper `this` binding so Drizzle's internal methods work correctly
export const db = new Proxy({} as DrizzleDb, {
  get(_target, prop) {
    const instance = getDb()
    const value = instance[prop as keyof DrizzleDb]
    if (typeof value === "function") {
      return (value as (...args: unknown[]) => unknown).bind(instance)
    }
    return value
  },
})
