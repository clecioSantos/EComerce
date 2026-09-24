import path from "node:path";

import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

/**
 * Testes de integração contra um PostgreSQL real.
 * Requer DATABASE_URL válido (ver .env) e base migrada.
 * Rodar com: npm run test:integration
 */
export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      "server-only": path.resolve(
        import.meta.dirname,
        "tests/integration/stubs/empty.ts",
      ),
      "next/headers": path.resolve(
        import.meta.dirname,
        "tests/integration/stubs/next-headers.ts",
      ),
    },
  },
  test: {
    environment: "node",
    globals: true,
    include: ["tests/integration/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
