import Link from "next/link";

import { MercadoPagoAccount } from "@/components/admin/mercadopago-account";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getEnv } from "@/lib/env";
import { getMercadoPagoAccount } from "@/modules/payments/oauth/account.service";

export const dynamic = "force-dynamic";

export const metadata = { title: "Pagamentos" };

function ConfigRow({ label, ok, hint }: { label: string; ok: boolean; hint?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b py-2 last:border-0">
      <span className="text-sm">{label}</span>
      <span className="flex items-center gap-2">
        {hint ? <span className="text-muted-foreground text-xs">{hint}</span> : null}
        <Badge variant={ok ? "default" : "destructive"}>
          {ok ? "Configurado" : "Ausente"}
        </Badge>
      </span>
    </div>
  );
}

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const oauthStatus = typeof params.oauth === "string" ? params.oauth : undefined;

  const env = getEnv();
  const account = await getMercadoPagoAccount();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pagamentos</h1>
        <p className="text-muted-foreground text-sm">
          Gateway ativo: <strong>{env.PAYMENT_PROVIDER}</strong>. Configure o Mercado Pago
          para PIX e cartão.
        </p>
      </div>

      {oauthStatus === "success" ? (
        <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm">
          Conta do Mercado Pago conectada com sucesso.
        </p>
      ) : null}
      {oauthStatus === "error" ? (
        <p className="border-destructive/40 bg-destructive/10 rounded-md border px-4 py-3 text-sm">
          Não foi possível concluir a conexão. Verifique as credenciais e tente novamente.
        </p>
      ) : null}

      <section className="bg-background space-y-4 rounded-lg border p-5">
        <h2 className="text-sm font-semibold">Conta Mercado Pago</h2>
        <MercadoPagoAccount
          connected={Boolean(account)}
          providerUserId={account?.providerUserId ?? null}
          liveMode={account?.liveMode ?? false}
          expiresAt={account?.expiresAt?.toISOString() ?? null}
          hasRefreshToken={account?.hasRefreshToken ?? false}
        />
      </section>

      <section className="bg-background rounded-lg border p-5">
        <h2 className="mb-3 text-sm font-semibold">Configuração</h2>
        <ConfigRow label="Client ID" ok={Boolean(env.MERCADOPAGO_CLIENT_ID)} />
        <ConfigRow label="Client Secret" ok={Boolean(env.MERCADOPAGO_CLIENT_SECRET)} />
        <ConfigRow label="Redirect URI" ok={Boolean(env.MERCADOPAGO_REDIRECT_URI)} />
        <ConfigRow
          label="Webhook secret (x-signature)"
          ok={Boolean(env.MERCADOPAGO_WEBHOOK_SECRET)}
        />
        <ConfigRow
          label="Public key (browser)"
          ok={Boolean(process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY)}
        />
        <ConfigRow
          label="Cifra de tokens"
          ok={Boolean(env.PAYMENT_TOKEN_ENCRYPTION_KEY)}
        />
        <div className="text-muted-foreground mt-4 text-xs">
          Webhook: <code>{env.NEXT_PUBLIC_SITE_URL}/api/webhooks/mercadopago</code>
        </div>
      </section>

      <div>
        <Button variant="outline" render={<Link href="/admin/pedidos" />}>
          Ver pedidos
        </Button>
      </div>
    </div>
  );
}
