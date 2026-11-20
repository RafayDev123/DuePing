import { drizzle } from "drizzle-orm/node-postgres";
import { Pool, types } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const globalForDb = globalThis as typeof globalThis & {
  __duePingPool?: Pool;
};

// Keep PostgreSQL `date` columns as plain YYYY-MM-DD strings (no timezone shifting).
const typeParsers = {
  getTypeParser: (oid: number, format?: "text" | "binary") =>
    oid === 1082 ? (v: string) => v : types.getTypeParser(oid, format as "text"),
};

export const pool =
  globalForDb.__duePingPool ??
  new Pool({
    connectionString: databaseUrl,
    max: 10,
    types: typeParsers as any,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__duePingPool = pool;
}

export const db = drizzle(pool);
