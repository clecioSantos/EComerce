import pg from "pg";
import { config } from "./config.js";

// Reserve session-pool capacity for other app processes and operations.
export const pool = new pg.Pool({
 connectionString: config.DATABASE_URL,
 max: Math.min(3, Math.max(1, Number(process.env.AGENT_DATABASE_POOL_MAX ?? 2) || 2)),
 idleTimeoutMillis: 10_000,
 connectionTimeoutMillis: 10_000,
});
export async function query<T extends pg.QueryResultRow>(sql: string, values: unknown[] = []): Promise<T[]> {
  const result = await pool.query<T>(sql, values);
  return result.rows;
}
export type Store = {
 id: string; name: string; store_url: string; commerce_api_key_enc: string;
 whatsapp_phone_id: string; whatsapp_number: string; whatsapp_token_enc: string;
 enabled: boolean; preferences: Record<string, unknown>;
};
export type Conversation = { id: string; store_id: string; phone: string; mode: "ai"|"human" };
