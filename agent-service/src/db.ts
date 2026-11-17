import pg from "pg";
import { config } from "./config.js";

export const pool = new pg.Pool({ connectionString: config.DATABASE_URL, max: 8 });
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
