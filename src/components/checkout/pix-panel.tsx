"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

interface PixPanelProps {
  orderId: string;
  orderNumber: string;
  qrCode: string | null;
  qrCodeBase64: string | null;
  ticketUrl: string | null;
  expiresAt: string | null;
}

/**
 * Painel PIX: exibe o QR/copia-e-cola e consulta o status periodicamente,
 * confirmando automaticamente quando o pagamento for aprovado.
 */
export function PixPanel({
  orderId,
  orderNumber,
  qrCode,
  qrCodeBase64,
  ticketUrl,
  expiresAt,
}: PixPanelProps) {
  const router = useRouter();
  const [status, setStatus] = useState<string>("PENDING");
  const [secondsLeft, setSecondsLeft] = useState<number | null>(() =>
    expiresAt
      ? Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
      : null,
  );
  const confirmed = useRef(false);

  const checkStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/payments/mercadopago/status/${orderId}`, {
        cache: "no-store",
      });
      if (!response.ok) return;
      const data = (await response.json()) as { status?: string };
      if (data.status) setStatus(data.status);
      if (data.status === "PAID" && !confirmed.current) {
        confirmed.current = true;
        toast.success("Pagamento confirmado!");
        router.push(`/checkout/sucesso?orderId=${orderId}`);
        router.refresh();
      }
    } catch {
      // Silencioso: nova tentativa no próximo ciclo.
    }
  }, [orderId, router]);

  useEffect(() => {
    if (status === "PAID") return;
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, [checkStatus, status]);

  useEffect(() => {
    if (secondsLeft == null) return;
    const timer = setInterval(() => {
      setSecondsLeft((current) => (current == null ? null : Math.max(0, current - 1)));
    }, 1000);
    return () => clearInterval(timer);
  }, [secondsLeft]);

  async function copy() {
    if (!qrCode) return;
    try {
      await navigator.clipboard.writeText(qrCode);
      toast.success("Código copiado.");
    } catch {
      toast.error("Não foi possível copiar. Selecione manualmente.");
    }
  }

  if (status === "PAID") {
    return <p className="text-sm font-medium text-emerald-600">Pagamento confirmado!</p>;
  }
  if (status === "FAILED" || status === "CANCELED") {
    return (
      <p className="text-destructive text-sm">
        O pagamento não foi concluído. Atualize a página para tentar novamente.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm">
        Pedido <strong>{orderNumber}</strong> aguardando pagamento via PIX.
      </p>

      {qrCodeBase64 ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`data:image/png;base64,${qrCodeBase64}`}
          alt="QR Code PIX"
          className="mx-auto size-52 rounded-md border bg-white object-contain p-2"
        />
      ) : null}

      {qrCode ? (
        <div className="space-y-2">
          <p className="text-muted-foreground text-xs">PIX copia-e-cola</p>
          <div className="flex gap-2">
            <input
              readOnly
              value={qrCode}
              className="bg-muted h-9 flex-1 rounded-md border px-3 text-xs"
            />
            <Button type="button" variant="secondary" onClick={copy}>
              Copiar
            </Button>
          </div>
        </div>
      ) : null}

      {secondsLeft != null ? (
        <p className="text-muted-foreground text-xs">
          {secondsLeft > 0
            ? `Expira em ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}.`
            : "Código expirado."}
        </p>
      ) : null}

      <p className="text-muted-foreground text-xs">
        A confirmação é automática. Você pode fechar esta página após pagar.
      </p>

      {ticketUrl ? (
        <Button
          variant="outline"
          render={<a href={ticketUrl} target="_blank" rel="noreferrer" />}
        >
          Abrir no Mercado Pago
        </Button>
      ) : null}
    </div>
  );
}
