import { Pool, PoolClient, QueryResultRow } from "pg";

let pool: Pool | undefined;

export function getPostgresPool(): Pool {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error("DATABASE_URL is not configured");
  pool = new Pool({
    connectionString,
    max: Number.parseInt(process.env.PG_POOL_MAX || "10", 10),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
    maxUses: 7_500,
    ssl: process.env.PGSSL === "disable" ? undefined : { rejectUnauthorized: true },
  });
  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, values: unknown[] = []): Promise<T[]> {
  const result = await getPostgresPool().query<T>(text, values);
  return result.rows;
}

export async function withTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPostgresPool().connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export function resetPostgresPoolForTests() {
  pool = undefined;
}
