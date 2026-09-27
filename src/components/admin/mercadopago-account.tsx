"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { disconnectMercadoPagoAction } from "@/modules/payments/payment.actions";

interface Props {
  connected: boolean;
  providerUserId: string | null;
  liveMode: boolean;
  expiresAt: string | null;
  hasRefreshToken: boolean;
}

export function MercadoPagoAccount({
  connected,
  providerUserId,
  liveMode,
  expiresAt,
  hasRefreshToken,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function disconnect() {
    startTransition(async () => {
      try {
        const result = await disconnectMercadoPagoAction();
        if (result.ok) {
          toast.success("Conta do Mercado Pago desconectada.");
          setConfirming(false);
          router.refresh();
        } else {
          toast.error(result.error ?? "Erro ao desconectar.");
        }
      } catch {
        toast.error("Erro ao desconectar. Tente novamente.");
      }
    });
  }

  if (!connected) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground text-sm">
          Nenhuma conta conectada. Conecte a conta do Mercado Pago da loja para receber
          pagamentos via PIX e cartão.
        </p>
        <Button render={<a href="/admin/pagamentos/oauth/connect" />}>
          Conectar Mercado Pago
        </Button>
      </div>
    );
  }

  const expiresLabel = expiresAt
    ? new Date(expiresAt).toLocaleString("pt-BR")
    : "sem expiração informada";

  return (
    <div className="space-y-4">
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Conta (user id)</dt>
          <dd className="font-medium">{providerUserId ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Ambiente</dt>
          <dd className="font-medium">{liveMode ? "Produção" : "Teste"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Token expira em</dt>
          <dd className="font-medium">{expiresLabel}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Refresh token</dt>
          <dd className="font-medium">{hasRefreshToken ? "Sim" : "Não"}</dd>
        </div>
      </dl>

      {confirming ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm">Desconectar mesmo assim?</span>
          <Button variant="destructive" size="sm" onClick={disconnect} disabled={pending}>
            {pending ? "Desconectando..." : "Confirmar"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setConfirming(false)}>
            Cancelar
          </Button>
        </div>
      ) : (
        <Button variant="outline" onClick={() => setConfirming(true)} disabled={pending}>
          Desconectar
        </Button>
      )}
    </div>
  );
}
