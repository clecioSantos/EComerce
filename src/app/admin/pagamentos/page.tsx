import Link from "next/link";

import { MercadoPagoAccount } from "@/components/admin/mercadopago-account";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getEnv } from "@/lib/env";
import { getMercadoPagoAccount } from "@/modules/payments/oauth/account.service";
import { hasStuckOAuthAttempt } from "@/modules/payments/oauth/state";
import {
  publicKeyMatchesEnvironment,
  resolveMercadoPagoEnvironment,
} from "@/modules/payments/providers/mercadopago/environment";

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
  const stuckAttempt =
    !account && (await hasStuckOAuthAttempt({ provider: "mercadopago" }));

  const encryptionReady = Boolean(env.PAYMENT_TOKEN_ENCRYPTION_KEY);
  const clientReady = Boolean(env.MERCADOPAGO_CLIENT_ID && env.MERCADOPAGO_CLIENT_SECRET);
  const expectedRedirect = `${env.NEXT_PUBLIC_SITE_URL.replace(
    /\/$/,
    "",
  )}/admin/pagamentos/oauth/callback`;
  const redirectMatches = env.MERCADOPAGO_REDIRECT_URI === expectedRedirect;
  const connectReady = encryptionReady && clientReady && redirectMatches;

  const environment = resolveMercadoPagoEnvironment(env.MERCADOPAGO_ENVIRONMENT);
  const sandbox = environment === "sandbox";
  const activePublicKey = sandbox
    ? (process.env.NEXT_PUBLIC_MERCADOPAGO_SANDBOX_PUBLIC_KEY ??
      process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY ??
      null)
    : (process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY ?? null);
  const publicKeyOk = publicKeyMatchesEnvironment(activePublicKey, environment);

  const problems: string[] = [];
  if (!clientReady) problems.push("Client ID/Secret não configurados.");
  if (!encryptionReady) {
    problems.push(
      "PAYMENT_TOKEN_ENCRYPTION_KEY ausente — sem ela não é possível cifrar/guardar os tokens.",
    );
  }
  if (!redirectMatches) {
    problems.push(
      `Redirect URI deve ser exatamente "${expectedRedirect}" e estar cadastrada no app do Mercado Pago.`,
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pagamentos</h1>
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          Gateway ativo: <strong>{env.PAYMENT_PROVIDER}</strong>
          <Badge variant={sandbox ? "secondary" : "default"}>
            {sandbox ? "Sandbox (teste)" : "Produção"}
          </Badge>
        </p>
      </div>

      {oauthStatus === "success" ? (
        <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm">
          Conta do Mercado Pago conectada com sucesso.
        </p>
      ) : null}
      {oauthStatus === "error" ? (
        <p className="border-destructive/40 bg-destructive/10 rounded-md border px-4 py-3 text-sm">
          Não foi possível concluir a conexão. Veja abaixo o que está faltando ou
          incorreto antes de tentar novamente.
        </p>
      ) : null}

      {problems.length > 0 ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          <p className="font-medium">Pendências para conectar:</p>
          <ul className="mt-1 list-disc pl-5">
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {stuckAttempt ? (
        <div className="border-destructive/40 bg-destructive/10 rounded-md border px-4 py-3 text-sm">
          <p className="font-medium">A tentativa de conexão não retornou a esta loja.</p>
          <p className="mt-1">
            O Mercado Pago redirecionou o <code>code</code> para outra URL. Confirme que a{" "}
            <strong>Redirect URL</strong> cadastrada no app do Mercado Pago é exatamente{" "}
            <code>{expectedRedirect}</code> e que ela é acessível a partir do navegador.
          </p>
        </div>
      ) : null}

      <section className="bg-background space-y-4 rounded-lg border p-5">
        <h2 className="text-sm font-semibold">Conta Mercado Pago</h2>
        <MercadoPagoAccount
          connected={Boolean(account)}
          providerUserId={account?.providerUserId ?? null}
          liveMode={account?.liveMode ?? false}
          expiresAt={account?.expiresAt?.toISOString() ?? null}
          hasRefreshToken={account?.hasRefreshToken ?? false}
          connectDisabled={!connectReady}
        />
      </section>

      <section className="bg-background rounded-lg border p-5">
        <h2 className="mb-3 text-sm font-semibold">Configuração</h2>
        <ConfigRow label="Client ID" ok={Boolean(env.MERCADOPAGO_CLIENT_ID)} />
        <ConfigRow label="Client Secret" ok={Boolean(env.MERCADOPAGO_CLIENT_SECRET)} />
        <ConfigRow
          label="Redirect URI"
          ok={redirectMatches}
          hint={redirectMatches ? undefined : "deve apontar para esta loja"}
        />
        <ConfigRow
          label="Webhook secret (x-signature)"
          ok={Boolean(env.MERCADOPAGO_WEBHOOK_SECRET)}
        />
        <ConfigRow
          label="Public key (browser)"
          ok={publicKeyOk}
          hint={
            publicKeyOk
              ? undefined
              : `esperada uma chave ${sandbox ? "TEST-" : "APP_USR-"}`
          }
        />
        {sandbox ? (
          <ConfigRow
            label="Access token de teste"
            ok={Boolean(env.MERCADOPAGO_SANDBOX_ACCESS_TOKEN)}
            hint="TEST-…"
          />
        ) : null}
        <ConfigRow
          label="Cifra de tokens"
          ok={Boolean(env.PAYMENT_TOKEN_ENCRYPTION_KEY)}
        />
        <div className="text-muted-foreground mt-4 space-y-1 text-xs">
          <div>
            Redirect URI esperada: <code>{expectedRedirect}</code>
          </div>
          <div>
            Webhook: <code>{env.NEXT_PUBLIC_SITE_URL}/api/webhooks/mercadopago</code>
          </div>
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
