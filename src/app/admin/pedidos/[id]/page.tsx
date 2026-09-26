import Link from "next/link";
import { notFound } from "next/navigation";

import { OrderStatusSelect } from "@/components/admin/order-status-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { getOrderById } from "@/modules/orders/order.service";

export const dynamic = "force-dynamic";

export const metadata = { title: "Detalhes do pedido" };

interface ShippingAddressSnapshot {
  recipient?: string;
  line1?: string;
  line2?: string | null;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  phone?: string | null;
}

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  AUTHORIZED: "Autorizado",
  PAID: "Pago",
  FAILED: "Falhou",
  REFUNDED: "Reembolsado",
  CANCELED: "Cancelado",
};

function formatEstimate(min: number | null, max: number | null): string | null {
  if (min != null && max != null && min !== max) return `${min} a ${max} dias úteis`;
  if (min != null || max != null) return `${min ?? max} dias úteis`;
  return null;
}

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await getOrderById(id);
  if (!order) notFound();

  const address = (order.shippingAddress ??
    null) as unknown as ShippingAddressSnapshot | null;
  const payment = order.payments[0] ?? null;
  const estimate = formatEstimate(
    order.shippingEstimatedDaysMin,
    order.shippingEstimatedDaysMax,
  );

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2"
        render={<Link href="/admin/pedidos" />}
      >
        Voltar
      </Button>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{order.number}</h1>
          <p className="text-muted-foreground text-sm">
            {formatDateTime(order.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            {PAYMENT_STATUS_LABELS[order.paymentStatus] ?? order.paymentStatus}
          </Badge>
          <OrderStatusSelect orderId={order.id} status={order.status} />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="space-y-2 rounded-lg border p-5">
          <h2 className="text-sm font-semibold">Cliente</h2>
          <p className="text-sm">{order.customerName}</p>
          <p className="text-muted-foreground text-sm">{order.customerEmail}</p>
          {order.customerPhone ? (
            <p className="text-muted-foreground text-sm">{order.customerPhone}</p>
          ) : null}
        </section>

        <section className="space-y-2 rounded-lg border p-5">
          <h2 className="text-sm font-semibold">Entrega</h2>
          <p className="text-sm">
            {order.shippingMethod ?? "—"}
            {order.shippingCompany ? (
              <span className="text-muted-foreground"> · {order.shippingCompany}</span>
            ) : null}
          </p>
          <dl className="text-muted-foreground space-y-1 text-xs">
            {order.shippingProvider ? (
              <div className="flex justify-between gap-2">
                <dt>Provedor</dt>
                <dd>{order.shippingProvider}</dd>
              </div>
            ) : null}
            {order.shippingServiceId ? (
              <div className="flex justify-between gap-2">
                <dt>Serviço (ID)</dt>
                <dd>{order.shippingServiceId}</dd>
              </div>
            ) : null}
            {estimate ? (
              <div className="flex justify-between gap-2">
                <dt>Prazo estimado</dt>
                <dd>{estimate}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-2">
              <dt>Valor do frete</dt>
              <dd>{formatCurrency(Number(order.shippingTotal), order.currency)}</dd>
            </div>
            {order.trackingCode ? (
              <div className="flex justify-between gap-2">
                <dt>Rastreio</dt>
                <dd>{order.trackingCode}</dd>
              </div>
            ) : null}
          </dl>
        </section>

        <section className="space-y-2 rounded-lg border p-5 md:col-span-2">
          <h2 className="text-sm font-semibold">Endereço de entrega</h2>
          {address ? (
            <div className="text-muted-foreground text-sm">
              <p className="text-foreground">{address.recipient}</p>
              <p>
                {address.line1}
                {address.line2 ? `, ${address.line2}` : ""}
              </p>
              <p>
                {address.city} - {address.state}, {address.postalCode}
              </p>
              {address.country ? <p>{address.country}</p> : null}
              {address.phone ? <p>{address.phone}</p> : null}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Endereço não informado.</p>
          )}
        </section>
      </div>

      <section className="space-y-3 rounded-lg border p-5">
        <h2 className="text-sm font-semibold">Itens</h2>
        <ul className="space-y-3">
          {order.items.map((item) => (
            <li key={item.id} className="flex justify-between gap-4 text-sm">
              <span>
                {item.quantity}× {item.productName}
                {item.variantName ? ` (${item.variantName})` : ""}
                <span className="text-muted-foreground block text-xs">
                  SKU {item.sku} · {formatCurrency(Number(item.unitPrice))} un.
                </span>
              </span>
              <span className="font-medium">
                {formatCurrency(Number(item.total), order.currency)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2 rounded-lg border p-5 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span>{formatCurrency(Number(order.subtotal), order.currency)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Descontos</span>
          <span>-{formatCurrency(Number(order.discountTotal), order.currency)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Frete</span>
          <span>{formatCurrency(Number(order.shippingTotal), order.currency)}</span>
        </div>
        <Separator className="my-1" />
        <div className="flex justify-between text-base font-semibold">
          <span>Total</span>
          <span>{formatCurrency(Number(order.grandTotal), order.currency)}</span>
        </div>
      </section>

      {payment ? (
        <section className="text-muted-foreground space-y-1 rounded-lg border p-5 text-sm">
          <h2 className="text-foreground text-sm font-semibold">Pagamento</h2>
          <p>
            {payment.provider} · {payment.method} ·{" "}
            {formatCurrency(Number(payment.amount), payment.currency)}
          </p>
          <p>
            Status: {PAYMENT_STATUS_LABELS[payment.status] ?? payment.status}
            {payment.providerPaymentId ? ` · ${payment.providerPaymentId}` : ""}
          </p>
        </section>
      ) : null}
    </div>
  );
}
