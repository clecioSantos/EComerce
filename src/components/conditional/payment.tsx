"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { conditionalAction } from "@/modules/conditional/actions";
import { Button } from "@/components/ui/button";
export function ConditionalPayment({ caseId }: { caseId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [payment, setPayment] = useState<{
    status: string;
    qrCode: string | null;
    ticketUrl: string | null;
  } | null>(null);
  const router = useRouter();
  return (
    <div className="space-y-4">
      <Button
        disabled={pending}
        onClick={() => {
          setError("");
          start(async () => {
            const r = await conditionalAction({ operation: "pay", values: { caseId } });
            if (!r.ok) {
              setError(r.error);
              return;
            }
            if ("payment" in r) setPayment(r.payment ?? null);
            router.refresh();
          });
        }}
      >
        {pending ? "Consultando…" : "Pagar ou consultar PIX do acerto"}
      </Button>
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      {payment ? (
        <div className="space-y-3">
          <p className="text-sm" role="status">
            {payment.status === "PAID"
              ? "Pagamento confirmado."
              : payment.qrCode
                ? "Copie o código PIX para pagar no aplicativo do banco."
                : "Pagamento em processamento. Atualize a página em instantes. Não faça um segundo pagamento."}
          </p>
          {payment.qrCode ? (
            <>
              <textarea
                aria-label="Código PIX copia e cola"
                readOnly
                value={payment.qrCode}
                className="h-24 w-full rounded border p-3 text-sm"
              />
              <Button
                variant="outline"
                onClick={() => navigator.clipboard.writeText(payment.qrCode!)}
              >
                Copiar código PIX
              </Button>
            </>
          ) : null}
          <Button variant="outline" onClick={() => router.refresh()}>
            Atualizar situação
          </Button>
        </div>
      ) : null}
    </div>
  );
}
