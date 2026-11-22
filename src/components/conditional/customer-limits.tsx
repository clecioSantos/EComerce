"use client";

import { useState } from "react";
import { LimitFields } from "@/components/conditional/action-form";

type Limits = {
  maxOpenAmount: number;
  maxOpenUnits: number;
  maxCaseAmount: number;
  maxCaseUnits: number;
  maxOpenCases: number;
};

export function CustomerConditionalLimits({
  useStoreLimits: initial,
  profile,
  policy,
}: {
  useStoreLimits: boolean;
  profile: Limits | null;
  policy: Limits | null;
}) {
  const [useStoreLimits, setUseStoreLimits] = useState(initial);
  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="useStoreLimits"
          checked={useStoreLimits}
          onChange={(event) => setUseStoreLimits(event.target.checked)}
        />
        Usar limites padrão da loja
      </label>
      {useStoreLimits ? (
        <div className="bg-muted/40 rounded-md border p-3 text-sm">
          <p className="font-medium">Limites herdados da loja</p>
          <p className="text-muted-foreground mt-1 text-xs">
            Alterações futuras nas configurações da loja serão aplicadas automaticamente.
          </p>
          {policy ? (
            <p className="mt-2 text-sm">
              R$ {policy.maxOpenAmount.toFixed(2)} em aberto · {policy.maxOpenUnits} peças ·
              R$ {policy.maxCaseAmount.toFixed(2)} por solicitação · {policy.maxCaseUnits} peças
              por solicitação · {policy.maxOpenCases} condicionais simultâneos
            </p>
          ) : (
            <p className="mt-2 text-xs">Configure primeiro a política da loja.</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-muted-foreground text-xs">
            Personalize os limites abaixo. Eles não poderão ultrapassar os tetos da loja.
          </p>
          <LimitFields data={profile ?? policy} />
        </div>
      )}
    </div>
  );
}
