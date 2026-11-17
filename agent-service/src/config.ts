import "dotenv/config";
import { z } from "zod";

const schema = z.object({
 PORT: z.coerce.number().int().min(1).default(3100),
 DATABASE_URL: z.string().min(1),
 MASTER_ENCRYPTION_KEY: z.string().regex(/^[a-fA-F0-9]{64}$/),
 ADMIN_PASSWORD: z.string().min(16),
 META_APP_ID: z.string().optional(),
 META_CONFIG_ID: z.string().optional(),
 META_APP_SECRET: z.string().min(1),
 META_VERIFY_TOKEN: z.string().min(8),
 META_GRAPH_VERSION: z.string().regex(/^v\d+\.\d+$/),
 OPENAI_API_KEY: z.string().min(1),
 OPENAI_MODEL: z.string().min(1),
 ALLOWED_COMMERCE_HOSTS: z.string().default(""),
 PUBLIC_BASE_URL: z.string().url(),
});
export const config = schema.parse(process.env);
