import "server-only";
import { neon } from "@neondatabase/serverless";
import { attachDatabasePool } from "@vercel/functions";
import { Pool } from "pg";
import type { QueryResultRow } from "pg";

// TCP remains the default for local PostgreSQL and Vercel Fluid compute.
// HTTPS is an opt-in for Neon where outbound PostgreSQL connections are blocked.
const transport = process.env.DATABASE_TRANSPORT ?? "tcp";
if (transport !== "tcp" && transport !== "http") {
  throw new Error("DATABASE_TRANSPORT must be tcp or http");
}
if (transport === "http" && !process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for the Neon HTTP transport");
}
const httpSql = transport === "http" ? neon(process.env.DATABASE_URL!) : null;

// Keep one TCP pool during Next.js development reloads.
const databaseGlobal = globalThis as typeof globalThis & { databasePool?: Pool };
const postgresPool = httpSql ? null : databaseGlobal.databasePool ?? new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000
});
if (postgresPool && !databaseGlobal.databasePool) attachDatabasePool(postgresPool);
if (postgresPool && process.env.NODE_ENV !== "production") {
  databaseGlobal.databasePool = postgresPool;
}

// Both transports keep the existing parameterized query interface.
export const pool = {
  async query<Row extends QueryResultRow>(text: string, values: unknown[] = []): Promise<{ rows: Row[] }> {
    if (httpSql) {
      const rows = await httpSql.query(text, values, {
        fetchOptions: { signal: AbortSignal.timeout(30000) }
      });
      return { rows: rows as Row[] };
    }
    return postgresPool!.query<Row>(text, values);
  }
};
