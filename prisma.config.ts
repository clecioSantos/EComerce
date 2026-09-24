import "dotenv/config";
import path from "node:path";
import { defineConfig } from "prisma/config";

// A URL do banco é opcional em tempo de configuração para permitir
// `prisma generate` — e portanto `npm install`/`npm run build` — sem
// DATABASE_URL definida. Comandos que realmente acessam o banco
// (migrate, db push, studio, seed) continuam exigindo a variável em runtime.
const databaseUrl = process.env.DATABASE_URL;
const shadowDatabaseUrl = process.env.SHADOW_DATABASE_URL;

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx prisma/seed.ts",
  },
  ...(databaseUrl
    ? {
        datasource: {
          url: databaseUrl,
          ...(shadowDatabaseUrl ? { shadowDatabaseUrl } : {}),
        },
      }
    : {}),
});
