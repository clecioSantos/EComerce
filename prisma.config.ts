import "dotenv/config";
import path from "node:path";
import { defineConfig } from "prisma/config";

// Conexão usada pelo Prisma CLI (migrate / db push / studio / seed).
//
// No Supabase, use DIRECT_URL (Session Pooler/direct, porta 5432) para
// migrations; a aplicação em runtime usa DATABASE_URL via driver adapter.
// Localmente, sem DIRECT_URL, o CLI cai para DATABASE_URL (comportamento atual).
//
// A URL é opcional em tempo de configuração para permitir `prisma generate`
// — e portanto `npm install`/`npm run build` — sem variáveis definidas.
const cliDatabaseUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
const shadowDatabaseUrl = process.env.SHADOW_DATABASE_URL;

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx prisma/seed.ts",
  },
  ...(cliDatabaseUrl
    ? {
        datasource: {
          url: cliDatabaseUrl,
          ...(shadowDatabaseUrl ? { shadowDatabaseUrl } : {}),
        },
      }
    : {}),
});
