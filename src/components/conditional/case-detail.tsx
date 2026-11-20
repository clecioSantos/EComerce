import Link from "next/link";
import { randomUUID } from "node:crypto";
import { ActionForm, Field, Note } from "./action-form";
import { ConditionalPayment } from "./payment";
import { CustomerCapacity } from "./customer-capacity";
import { customerSummary, type Actor, type CaseRow } from "@/modules/conditional/service";
import { STATUS_LABELS, unresolved } from "@/modules/conditional/rules";
import { formatCurrency, formatDateTime } from "@/lib/format";

const box = "space-y-4 rounded-lg border bg-background p-5";
export async function CaseDetail({ row, actor }: { row: CaseRow; actor: Actor }) {
  const isAdmin = actor.admin;
  const values = { caseId: row.id };
  const showReturns = ["DECIDED", "CLOSED"].includes(row.status);
  const address = row.address as {
    recipient?: string;
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    phone?: string;
  };
  const publicEvents = new Set([
    "REQUESTED",
    "APPROVED",
    "DISPATCHED",
    "RECEIVED",
    "DECIDED",
    "RETURN_DECLARED",
    "PAYMENT_CONFIRMED",
    "REFUNDED",
    "CLOSED",
    "OVERDUE",
  ]);
  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">{row.number}</h1>
          <p className="mt-2">{STATUS_LABELS[row.status]}</p>
        </div>
        <Link
          className="underline"
          href={isAdmin ? "/admin/condicionais" : "/conta/condicionais"}
        >
          Voltar à lista
        </Link>
      </div>
      {isAdmin ? (
        <>
          <Link href={`/admin/clientes/${row.userId}`} className="inline-block underline">
            Abrir cadastro e limites da cliente
          </Link>
          <CustomerCapacity summary={await customerSummary(row.userId)} admin />
        </>
      ) : null}
      {row.issue ? (
        <p role="alert" className="border-destructive rounded border p-4">
          Há uma ocorrência em análise. Consulte a loja para acompanhamento.
        </p>
      ) : null}
      <section className={box}>
        <h2 className="text-xl font-semibold">Peças</h2>
        <ul className="divide-y">
          {row.items.map((i) => (
            <li key={i.id} className="grid gap-2 py-4 text-sm sm:grid-cols-[1fr_auto]">
              <div>
                <strong>{i.productName}</strong>
                <p>
                  {i.variantName} · {i.sku}
                </p>
                <p>
                  {i.quantity} unidade(s) · {formatCurrency(Number(i.unitPrice))} cada
                </p>
              </div>
              <div>
                <p>
                  Escolhidas: {i.keepQuantity ?? "a definir"} · Pagas: {i.soldQuantity}
                </p>
                <p>
                  Devolvidas/conferidas: {i.approvedReturnQuantity} · Pendentes:{" "}
                  {unresolved(i)}
                </p>
                {i.writtenOffQuantity > 0 ? (
                  <p>Baixa autorizada: {i.writtenOffQuantity}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section className={box}>
        <h2 className="text-xl font-semibold">Prazos e recebimento</h2>
        <address className="text-sm leading-relaxed not-italic">
          {address.recipient}
          <br />
          {address.line1}
          {address.line2 ? ` · ${address.line2}` : ""}
          <br />
          {address.city}/{address.state} · {address.postalCode}
          {address.phone ? (
            <>
              <br />
              {address.phone}
            </>
          ) : null}
        </address>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          {[
            ["Solicitação", row.requestDueAt],
            ["Separação", row.reserveDueAt],
            ["Escolha", row.choiceDueAt],
            ["Retorno", row.returnDueAt],
            ["Pagamento", row.paymentDueAt],
          ].map(([label, date]) =>
            date ? (
              <div key={String(label)}>
                <dt>{String(label)}</dt>
                <dd>{formatDateTime(date as Date)}</dd>
              </div>
            ) : null,
          )}
        </dl>
        <p className="text-sm whitespace-pre-line">{row.freightPolicy}</p>
        <p className="text-sm">
          Frete de ida no acerto: {formatCurrency(Number(row.shippingFee))}. Taxa de
          retorno se houver peças devolvidas: {formatCurrency(Number(row.returnFee))}.
        </p>
        {row.shipments.map((s) => (
          <p className="text-sm" key={s.id}>
            {s.direction === "OUTBOUND"
              ? "Saída"
              : s.direction === "RETURN"
                ? "Devolução informada"
                : "Recebimento confirmado"}
            : {s.tracking || "sem rastreio"} · {formatDateTime(s.createdAt)}
            {isAdmin ? ` — ${s.evidence}` : ""}
          </p>
        ))}
      </section>
      {row.order ? (
        <section className={box}>
          <h2 className="text-xl font-semibold">Acerto financeiro</h2>
          <p>
            Pedido {row.order.number} ·{" "}
            <strong>{formatCurrency(Number(row.order.grandTotal))}</strong>
          </p>
          <p className="text-sm">
            {row.order.paymentStatus === "PAID"
              ? "Pago"
              : row.order.paymentStatus === "REFUNDED"
                ? "Reembolsado"
                : "Aguardando conclusão do pagamento"}
          </p>
          {!isAdmin &&
          row.status === "DECIDED" &&
          !["PAID", "REFUNDED"].includes(row.order.paymentStatus) ? (
            <ConditionalPayment caseId={row.id} />
          ) : null}
          {isAdmin ? (
            <Link className="text-sm underline" href={`/admin/pedidos/${row.order.id}`}>
              Abrir pedido vinculado
            </Link>
          ) : null}
          {isAdmin &&
          row.order.paymentStatus === "PAID" &&
          row.items.every((i) => i.purchasedApprovedQuantity >= i.soldQuantity) ? (
            <details>
              <summary className="cursor-pointer text-sm">
                Reembolsar acerto integral
              </summary>
              <ActionForm
                operation="refund"
                values={values}
                label="Confirmar reembolso integral"
                confirm={`Reembolsar integralmente ${formatCurrency(Number(row.order.grandTotal))} pelo provedor?`}
              >
                <Note label="Motivo do reembolso" />
              </ActionForm>
            </details>
          ) : null}
        </section>
      ) : row.status === "DECIDED" || row.status === "CLOSED" ? (
        <p className={box}>Nenhum valor a pagar neste acerto.</p>
      ) : null}
      {row.status === "RECEIVED" && !isAdmin ? (
        <section className={box}>
          <h2 className="text-xl font-semibold">Quais peças deseja comprar?</h2>
          <p className="text-sm">
            Informe a quantidade que vai ficar. O restante será registrado para devolução.
            Confira antes de confirmar: a escolha gera o acerto e não será editável pela
            cliente.
          </p>
          <ActionForm
            operation="choose"
            values={values}
            label="Confirmar escolha e acerto"
            confirm="Confirmar estas quantidades de compra e devolução?"
          >
            {row.items.map((i) => (
              <Field
                key={i.id}
                name={`keep:${i.id}`}
                label={`${i.productName} (${i.variantName}) — de 0 a ${i.quantity}`}
                type="number"
                min={0}
                step="1"
                value={0}
                required
              />
            ))}
          </ActionForm>
        </section>
      ) : null}
      {row.status === "DECIDED" &&
      !isAdmin &&
      row.items.some(
        (i) =>
          i.quantity -
            (i.keepQuantity ?? 0) -
            i.approvedReturnQuantity -
            i.writtenOffQuantity >
          0,
      ) ? (
        <section className={box}>
          <h2 className="text-xl font-semibold">Informar devolução</h2>
          <ActionForm operation="declareReturn" values={values} label="Informar retorno">
            <Field name="tracking" label="Rastreio (se houver)" />
            <Note
              name="evidence"
              label="Como e quando as peças foram enviadas ou entregues à loja"
            />
          </ActionForm>
          <p className="text-muted-foreground text-sm">
            A informação de envio não substitui a conferência física.
          </p>
        </section>
      ) : null}
      {isAdmin && row.status === "REQUESTED" ? (
        <section className={box}>
          <h2 className="text-xl font-semibold">Avaliar solicitação</h2>
          <ActionForm
            operation="approve"
            values={values}
            label="Aprovar e reservar peças"
          />
          <ActionForm operation="reject" values={values} label="Recusar solicitação">
            <Note />
          </ActionForm>
        </section>
      ) : null}
      {["REQUESTED", "APPROVED"].includes(row.status) ? (
        <details className={box}>
          <summary className="cursor-pointer">Cancelar antes da saída</summary>
          <ActionForm operation="cancel" values={values} label="Cancelar solicitação">
            <Note />
          </ActionForm>
        </details>
      ) : null}
      {isAdmin && row.status === "APPROVED" ? (
        <section className={box}>
          <h2 className="text-xl font-semibold">Registrar saída / retirada</h2>
          <ActionForm
            operation="dispatch"
            values={values}
            label="Confirmar saída"
            confirm="As peças conferidas estão saindo da loja?"
          >
            <Field name="tracking" label="Rastreio (se houver)" />
            <Note name="evidence" label="Evidência da separação e saída ou retirada" />
          </ActionForm>
        </section>
      ) : null}
      {isAdmin && row.status === "DISPATCHED" ? (
        <section className={box}>
          <h2 className="text-xl font-semibold">Confirmar recebimento pela cliente</h2>
          <ActionForm
            operation="receive"
            values={values}
            label="Confirmar e iniciar experimentação"
          >
            <Note name="evidence" label="Confirmação de entrega ou retirada" />
          </ActionForm>
        </section>
      ) : null}
      {isAdmin && showReturns ? (
        <section className={box}>
          <h2 className="text-xl font-semibold">Receber devoluções</h2>
          {row.items.map((i) => {
            const normal = i.quantity - (i.keepQuantity ?? 0) - i.receivedQuantity;
            const bought = i.soldQuantity - i.purchasedReceivedQuantity;
            return (
              <div key={i.id} className="space-y-4 border-t pt-4">
                <h3 className="font-medium">
                  {i.productName} · {i.variantName}
                </h3>
                {normal > 0 ? (
                  <ActionForm
                    operation="receiveReturn"
                    values={{ ...values, itemId: i.id, key: randomUUID() }}
                    label="Receber em conferência"
                  >
                    <Field
                      name="quantity"
                      label={`Quantidade recebida (até ${normal})`}
                      type="number"
                      min={1}
                      step="1"
                      value={1}
                      required
                    />
                    <Note
                      name="evidence"
                      label="Identificação e estado das peças recebidas"
                    />
                  </ActionForm>
                ) : null}
                {bought > 0 && row.order?.paymentStatus === "PAID" ? (
                  <details>
                    <summary className="cursor-pointer text-sm">
                      Devolução posterior de peças já compradas ({bought} pendente(s))
                    </summary>
                    <ActionForm
                      operation="receiveReturn"
                      values={{
                        ...values,
                        itemId: i.id,
                        key: randomUUID(),
                        purchased: "on",
                      }}
                      label="Receber compra devolvida"
                    >
                      <Field
                        name="quantity"
                        label="Quantidade recebida"
                        type="number"
                        min={1}
                        step="1"
                        value={1}
                        required
                      />
                      <Note name="evidence" label="Evidência do retorno da compra" />
                    </ActionForm>
                  </details>
                ) : null}
              </div>
            );
          })}
        </section>
      ) : null}
      {row.returns.length ? (
        <section className={box}>
          <h2 className="text-xl font-semibold">Conferências</h2>
          {row.returns.map((r) => (
            <div className="space-y-3 border-t pt-3" key={r.id}>
              <p className="text-sm">
                {row.items.find((i) => i.id === r.itemId)?.productName} · {r.quantity}{" "}
                unidade(s) ·{" "}
                {r.purchased ? "retorno de compra paga" : "retorno do condicional"} ·{" "}
                {r.outcome === "APPROVED"
                  ? "Aprovada"
                  : r.outcome === "WRITE_OFF"
                    ? "Baixa sem cobrança"
                    : r.outcome === "ISSUE"
                      ? "Com divergência"
                      : "Aguardando conferência"}
              </p>
              {isAdmin && ["PENDING", "ISSUE"].includes(r.outcome) ? (
                <ActionForm
                  operation="inspect"
                  values={{ ...values, returnId: r.id }}
                  label="Registrar conferência"
                >
                  <label className="grid gap-2 text-sm">
                    Resultado
                    <select
                      name="outcome"
                      className="bg-background min-h-11 rounded border p-2"
                    >
                      <option value="APPROVED">
                        Peças aptas: devolver ao disponível
                      </option>
                      <option value="ISSUE">Divergência: manter em quarentena</option>
                      <option value="WRITE_OFF">
                        Baixa física sem cobrança à cliente
                      </option>
                    </select>
                  </label>
                  <Note name="evidence" label="Conferência e justificativa" />
                </ActionForm>
              ) : null}
            </div>
          ))}
        </section>
      ) : null}
      {isAdmin &&
      ["APPROVED", "DISPATCHED", "RECEIVED", "DECIDED"].includes(row.status) ? (
        <details className={box}>
          <summary className="cursor-pointer">Ocorrências e revisão de prazos</summary>
          {row.issue ? <p className="text-sm whitespace-pre-line">{row.issue}</p> : null}
          <ActionForm operation="review" values={values} label="Registrar revisão">
            <Note />
            <Field name="issue" label="Nova ocorrência (deixe vazio para manter)" />
            <label className="flex items-center gap-2 text-sm">
              <input name="issueMode" type="checkbox" value="clear" />
              Resolver ocorrência atual
            </label>
            {row.status === "RECEIVED" ? (
              <Field name="choiceDueAt" label="Novo prazo de escolha" type="date" />
            ) : null}
            {row.status === "DECIDED" ? (
              <>
                <Field name="returnDueAt" label="Novo prazo de retorno" type="date" />
                <Field name="paymentDueAt" label="Novo prazo de pagamento" type="date" />
              </>
            ) : null}
          </ActionForm>
        </details>
      ) : null}
      <details className={box}>
        <summary className="cursor-pointer">
          Condições aceitas — versão {row.termsVersion}
        </summary>
        <p className="text-sm leading-relaxed whitespace-pre-line">{row.terms}</p>
        <p className="text-sm">Aceitas em {formatDateTime(row.acceptedAt)}.</p>
      </details>
      <section className={box}>
        <h2 className="text-xl font-semibold">Histórico</h2>
        <ol className="space-y-3">
          {row.events
            .filter((e) => isAdmin || publicEvents.has(e.type))
            .map((e) => (
              <li key={e.id} className="text-sm">
                <time className="text-muted-foreground block">
                  {formatDateTime(e.createdAt)}
                </time>
                {e.message}
              </li>
            ))}
        </ol>
      </section>
    </div>
  );
}
