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
  // Mercado Pago. Somente a Public Key vai para o browser; segredos e tokens
  // permanecem server-side.
  MERCADOPAGO_CLIENT_ID: z.string().min(1).optional(),
  MERCADOPAGO_CLIENT_SECRET: z.string().min(1).optional(),
  MERCADOPAGO_REDIRECT_URI: z.string().url().optional(),
  // Chave estática opcional (Client credentials). Se ausente, usa OAuth.
  MERCADOPAGO_ACCESS_TOKEN: z.string().min(1).optional(),
  // Ambiente: "sandbox" usa credenciais de teste e `test_token` no OAuth.
  MERCADOPAGO_ENVIRONMENT: z.enum(["sandbox", "production"]).default("production"),
  // Token estático de teste (começa com TEST-). Tem prioridade em sandbox para
  // facilitar testes de PIX/cartão sem conectar via OAuth.
  MERCADOPAGO_SANDBOX_ACCESS_TOKEN: z.string().min(1).optional(),
  // Segredo de assinatura dos webhooks (x-signature). Server-side.
  MERCADOPAGO_WEBHOOK_SECRET: z.string().min(1).optional(),
  // URL base da API. Default produção; sandbox é o mesmo host.
  MERCADOPAGO_API_URL: z.string().url().default("https://api.mercadopago.com"),
  MERCADOPAGO_AUTH_URL: z.string().url().default("https://auth.mercadopago.com"),
  MERCADOPAGO_TIMEOUT_MS: z.coerce.number().int().min(1000).default(20000),
  // PKCE é opcional no OAuth do MP; habilite apenas se o app exigir.
  MERCADOPAGO_PKCE_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  // Habilita bypass de assinatura APENAS fora de produção, para testes locais.
  MERCADOPAGO_WEBHOOK_DEBUG_BYPASS: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  // Chave (32 bytes em base64/hex) para cifrar tokens OAuth em repouso.
  PAYMENT_TOKEN_ENCRYPTION_KEY: z.string().min(16).optional(),
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
