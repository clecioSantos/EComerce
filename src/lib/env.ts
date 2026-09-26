import { z } from "zod";

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL é obrigatória"),
  AUTH_SECRET: z.string().min(1, "AUTH_SECRET é obrigatória"),
  AUTH_URL: z.string().url().optional(),
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_SITE_NAME: z.string().default("E-commerce Core"),
  PAYMENT_PROVIDER: z.string().default("mock"),
  SHIPPING_PROVIDER: z.string().default("fixed"),
  // Melhor Envio (cálculo de fretes). O token é server-side e nunca é exposto.
  // Default sandbox; em produção use https://melhorenvio.com.br.
  TOKEN_MELHOR_ENVIO: z.string().min(1).optional(),
  MELHOR_ENVIO_API_URL: z.string().url().default("https://sandbox.melhorenvio.com.br"),
  MELHOR_ENVIO_USER_AGENT: z.string().min(1).default("E-commerce Core"),
  MELHOR_ENVIO_USER_AGENT_EMAIL: z.string().email().optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | null = null;

export function getEnv(): ServerEnv {
  if (cached) return cached;

  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Variáveis de ambiente inválidas:\n${issues}`);
  }

  cached = parsed.data;
  return cached;
}
