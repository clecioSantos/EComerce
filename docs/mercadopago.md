# Integração Mercado Pago

Gateway de pagamento do e-commerce para **PIX** e **cartão de crédito**, com
OAuth da conta da loja, webhooks assinados, reconciliação, idempotência e
renovação automática de token.

## Arquitetura

```text
Checkout (placeOrderAction)
    └─ initiatePayment ──► PaymentProvider (registry)
                                └─ MercadoPagoProvider ──► MercadoPagoClient ──► API MP
Webhook POST /api/webhooks/mercadopago
    └─ valida x-signature (HMAC) ──► handlePaymentWebhook ──► applyPaymentStatus
Cron GET /api/internal/reconcile-payments
    └─ MercadoPagoProvider.getPaymentStatus ──► applyPaymentStatus
```

`applyPaymentStatus` é a **única** fonte de transição de pagamento/pedido
(webhook, reconciliação e polling convergem para ela). É idempotente via
`PaymentEvent @@unique([provider, externalEventId])` e via a máquina de estados
(`from === to` é no-op).

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
| --- | --- | --- |
| `PAYMENT_PROVIDER` | sim | Use `mercadopago` para o gateway real (`mock` em dev). |
| `MERCADOPAGO_CLIENT_ID` | OAuth | App ID do aplicativo MP. |
| `MERCADOPAGO_CLIENT_SECRET` | OAuth | Client secret — **somente server-side**. |
| `MERCADOPAGO_REDIRECT_URI` | OAuth | Igual à "Redirect URL" do aplicativo. |
| `MERCADOPAGO_ACCESS_TOKEN` | opcional | Token estático (loja única, sem OAuth). |
| `MERCADOPAGO_WEBHOOK_SECRET` | sim | Segredo de assinatura (`x-signature`). |
| `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` | sim | Public Key (pode ir ao browser). |
| `MERCADOPAGO_API_URL` | não | Default `https://api.mercadopago.com`. |
| `MERCADOPAGO_AUTH_URL` | não | Default `https://auth.mercadopago.com`. |
| `MERCADOPAGO_TIMEOUT_MS` | não | Default `20000`. |
| `MERCADOPAGO_PKCE_ENABLED` | não | `true` se o app exigir PKCE. |
| `MERCADOPAGO_WEBHOOK_DEBUG_BYPASS` | não | Bypass de assinatura **apenas** fora de produção. |
| `PAYMENT_TOKEN_ENCRYPTION_KEY` | OAuth | Cifra dos tokens em repouso (AES-256-GCM). |
| `CRON_SECRET` | reconciliação | Protege o endpoint de cron. |

Gere a chave de cifra com `openssl rand -base64 32`.

## Configuração do aplicativo

1. Crie um app em <https://www.mercadopago.com.br/developers/panel/app>.
2. Copie **Client ID**, **Client Secret** e **Public Key**.
3. Em "Redirect URLs", cadastre `MERCADOPAGO_REDIRECT_URI`
   (ex.: `https://sualoja.com/admin/pagamentos/oauth/callback`).
4. Em "Notificações > Webhooks", informe a URL
   `https://sualoja.com/api/webhooks/mercadopago`, selecione o evento
   **Pagamentos** e copie o **segredo de assinatura** para
   `MERCADOPAGO_WEBHOOK_SECRET`.
5. Habilite PKCE somente se quiser (então `MERCADOPAGO_PKCE_ENABLED=true`).

## Conectar conta da loja

1. Acesse `/admin/pagamentos`.
2. Clique em **Conectar Mercado Pago** → autorize na tela do MP.
3. O callback valida o `state` (uso único) e persiste os tokens cifrados.

Para desconectar: **Desconectar** em `/admin/pagamentos`.

O access token é renovado automaticamente 5 minutos antes de expirar. A
renovação usa um *lease* no banco (`refreshLockedUntil`) para evitar que duas
requisições concorrentes invalidem o refresh token uma da outra.

## Pagamentos

- **PIX**: criado no `placeOrder`; o QR/copia-e-cola é exibido no checkout e o
  status é confirmado por webhook (ou polling em `/api/payments/mercadopago/status/[orderId]`).
- **Cartão**: os dados são tokenizados no browser via MercadoPago.js
  (Core Methods). Somente o token chega ao backend; PAN/CVV nunca trafegam.

O valor **sempre** é calculado no servidor a partir do pedido — o campo
`amount` do frontend é ignorado.

## Webhook

- `POST /api/webhooks/mercadopago`.
- Valida `x-signature` (HMAC-SHA256 do manifest `id:{data.id};request-id:{x-request-id};ts:{ts};`)
  e a janela de `ts` (anti-replay). Assinatura inválida → **401**.
- Consulta o pagamento real no MP antes de aplicar o status (nunca confia no
  corpo). Webhook duplicado não repete efeitos (dedupe por `PaymentEvent`).

Bypass de assinatura em desenvolvimento: `MERCADOPAGO_WEBHOOK_DEBUG_BYPASS=true`
(só tem efeito fora de produção).

## Reconciliação

```bash
curl -H "x-cron-secret: $CRON_SECRET" https://sualoja.com/api/internal/reconcile-payments
```

Busca pagamentos `PENDING`/`AUTHORIZED` dos últimos 48h, consulta o MP e aplica
apenas transições válidas. Em falha de consulta, mantém pendente (nunca marca
como pago). Sugestão de agendamento: a cada 10 minutos.

## Testes

```bash
npm test                     # unitários (status, assinatura, mapper, client)
npm run test:integration     # applyPaymentStatus, idempotência e concorrência
npm run test:e2e             # fluxos de checkout (Playwright)
npm run lint && npm run typecheck && npm run build
```

Testar PIX: use uma conta de teste de comprador e o app em modo teste.
Testar cartão: use os [cartões de teste](https://www.mercadopago.com.br/developers/pt/docs/your-integrations/test/cards).

## Segurança

- `CLIENT_SECRET`, `ACCESS_TOKEN`, `REFRESH_TOKEN` e `WEBHOOK_SECRET`: somente
  server-side, nunca logados nem retornados ao cliente.
- Tokens OAuth cifrados em repouso (AES-256-GCM); apenas a Public Key vai ao browser.
- Ownership do pedido validado no polling; transições centralizadas.

## Documentação oficial

- [OAuth — obter access token](https://www.mercadopago.com.br/developers/en/docs/security/oauth/creation)
- [OAuth — renovar access token](https://www.mercadopago.com.br/developers/en/docs/security/oauth/renewal)
- [Pagamentos (Checkout Transparente)](https://www.mercadopago.com.br/developers/en/docs/checkout-api/landing)
- [Webhooks](https://www.mercadopago.com.br/developers/en/docs/your-integrations/notifications/webhooks)
- [MercadoPago.js v2](https://www.mercadopago.com.br/developers/en/docs/sdks-library/client-side/mp-js-v2)
