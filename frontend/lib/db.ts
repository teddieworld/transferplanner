import "server-only";
import { Pool } from "pg";

// Keep one pool during Next.js development reloads.
const databaseGlobal = globalThis as typeof globalThis & { databasePool?: Pool };

export const pool = databaseGlobal.databasePool ?? new Pool({
  max: 10,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000
});

if (process.env.NODE_ENV !== "production") {
  databaseGlobal.databasePool = pool;
}
