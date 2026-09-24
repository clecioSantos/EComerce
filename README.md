# E-commerce Core

Plataforma de e-commerce **modular e extensível**. O domínio principal é genérico:
catálogo, variantes, estoque, carrinho, checkout, pedidos, pagamentos e promoções
funcionam para **qualquer segmento** (roupas, calçados, eletrônicos, alimentos,
móveis, cosméticos, acessórios...).

> A loja de roupas é apenas a **primeira implementação** do catálogo. Não existe
> `if (product.type === "clothing")` espalhado pelo código.

---

## Stack

| Camada         | Tecnologia                                   |
| -------------- | -------------------------------------------- |
| Framework      | Next.js 16 (App Router, Turbopack)           |
| Linguagem      | TypeScript (strict)                          |
| UI             | Tailwind CSS v4 + shadcn/ui (Base UI)        |
| Banco          | PostgreSQL                                   |
| ORM            | Prisma 7 (`prisma-client` + driver adapter)  |
| Autenticação   | Auth.js (NextAuth v5) — Credentials + JWT    |
| Validação      | Zod                                          |
| Formulários    | React Hook Form                              |
| Qualidade      | ESLint, Prettier                             |
| Testes         | Vitest (unidade) + Playwright (e2e)          |
| Infra local    | Docker Compose (PostgreSQL)                  |

---

## Arquitetura

O sistema é dividido em **Core** (reutilizável) e **Domain Extensions**
(configuração por tipo de produto). Nada no Core conhece "cor" ou "tamanho".

```
CORE                                  DOMAIN EXTENSIONS
├── Catalog                           ├── Product Types
├── Products                          ├── Attributes
├── Inventory                         ├── Variants
├── Cart                              └── Regras de negócio customizadas
├── Checkout
├── Orders
├── Customers
├── Payments        (PaymentProvider)
├── Shipping        (ShippingProvider)
├── Promotions      (motor de preços)
├── Reviews
└── Authentication
```

Um **Product** não tem `size`/`color`. Ele tem `attributes` (descritivos) e
`variants`. O **ProductType** define quais atributos existem:

```
ProductType "Clothing"     -> Color, Size, Gender, Material
ProductType "Electronics"  -> RAM, Storage, Voltage, Color
ProductType "Food"         -> Weight, Flavor, Packaging
```

### Estrutura de pastas

```
src/
  app/
    (store)/                 # vitrine (home, produtos, categorias, busca, carrinho,
                             # checkout, conta, login, registro)
    admin/                   # painel (dashboard, produtos, categorias, tipos,
                             # atributos, estoque, pedidos, clientes, cupons)
    api/
      auth/[...nextauth]/    # Auth.js
      webhooks/payments/[provider]/
    sitemap.ts, robots.ts
  modules/                   # o domínio, por coesão
    pricing/                 # motor de preços puro
    promotions/              # promoções + cupons
    catalog/                 # busca, facetas, tipos de produto
    products/                # schemas, variantes, serviço de produto
    categories/              # árvore e serviço
    inventory/               # regras puras + serviço
    cart/                    # regras puras + serviço + server actions
    checkout/                # orquestração de checkout
    orders/                  # máquina de estados + serviço
    customers/               # clientes + endereços + auth actions
    payments/                # PaymentProvider + registry + mock
    shipping/                # ShippingProvider + registry + fixed/pickup
    reviews/
    admin/                   # server actions do painel
  components/
    ui/                      # shadcn/ui
    layout/, product/, cart/, checkout/, catalog/, auth/, admin/, shared/
  lib/
    db/prisma.ts, auth/, env.ts, format.ts, slug.ts, utils.ts
  types/
  proxy.ts                   # "middleware" do Next 16 (otimista)
prisma/
  schema.prisma, seed.ts, migrations/
tests/unit/                  # Vitest
e2e/                         # Playwright
```

### Abstrações plugáveis

**Pagamento** — `PaymentProvider` (`createPayment`, `getPaymentStatus`, `refund`,
`handleWebhook`). Implementação atual: `MockPaymentProvider`. Para adicionar um
provider real, crie uma classe que implemente a interface e registre em
`src/modules/payments/registry.ts`. O `Order` nunca fala com SDKs externos.

**Frete** — `ShippingProvider` (`quote`). Providers atuais: `fixed` e `pickup`.
Registre novos em `src/modules/shipping/registry.ts`.

O provider ativo vem das variáveis `PAYMENT_PROVIDER` e `SHIPPING_PROVIDER`.

---

## Modelo de dados

Relacional e normalizado. Principais entidades:

- **Identidade**: `User`, `Address`, `Account`, `Session`, `VerificationToken`
- **Catálogo**: `Brand`, `Category` (hierárquica via `parentId`), `ProductType`,
  `ProductAttribute`, `ProductAttributeValue`, `ProductAttributeAssignment`,
  `Product`, `ProductImage`, `ProductVariant`, `ProductVariantAttribute`
- **Estoque**: `Inventory` (por variante), `InventoryMovement` (histórico com motivo)
- **Carrinho**: `Cart`, `CartItem`
- **Pedidos**: `Order`, `OrderItem` (com snapshot do produto no momento da compra)
- **Pagamentos**: `Payment`, `PaymentTransaction`
- **Promoções**: `Promotion`, `Coupon`, `CouponUsage`
- **Avaliações**: `Review`

Pontos-chave:

- O preço base fica em `Product`; preço/estoque/atributos ficam na **variante**.
- `ProductVariantAttribute` liga variante ↔ valor de atributo (genérico).
- `ProductAttributeAssignment` guarda atributos descritivos (não-variante).
- `OrderItem.attributesSnapshot` congela os atributos comprados.
- `Inventory` nunca está em `Product`.

A migração inicial está em `prisma/migrations/0_init/migration.sql` (gerada com
`prisma migrate diff`, sem necessidade de banco).

---

## Como executar

### 1. Pré-requisitos

- Node.js 20.9+ (recomendado 22+)
- Docker (para o PostgreSQL de desenvolvimento)

### 2. Instalar dependências

```bash
npm install
```

### 3. Subir o PostgreSQL

```bash
docker compose up -d
```

O `docker-compose.yml` já cria o banco `ecommerce` e o banco `ecommerce_shadow`
(usado pelo `prisma migrate dev`).

> O projeto usa Prisma 7 com **driver adapter** (`@prisma/adapter-pg`).

### 4. Configurar ambiente

```bash
cp .env.example .env
```

Ajuste as variáveis se necessário. Gere um segredo forte para `AUTH_SECRET`:

```bash
openssl rand -base64 32
```

### 5. Prisma

```bash
npm run db:generate     # gera o client em src/generated/prisma
npm run db:migrate      # aplica as migrations (dev)
npm run db:seed         # popula dados de exemplo
```

Alternativas:

```bash
npm run db:deploy       # migrations em produção (CI)
npm run db:push         # sincroniza schema sem criar migration
npm run db:studio       # Prisma Studio
npm run db:reset        # recria o banco e roda o seed
```

### 6. Desenvolvimento

```bash
npm run dev
```

Acesse <http://localhost:3000>.

**Credenciais do seed**

| Perfil  | E-mail                     | Senha        |
| ------- | -------------------------- | ------------ |
| Admin   | admin@ecommerce.local      | admin12345   |
| Cliente | cliente@ecommerce.local    | cliente12345 |

### 7. Qualidade e testes

```bash
npm run lint
npm run typecheck
npm test                 # Vitest (unitário, sem banco)
npm run test:integration # Vitest + PostgreSQL real (requer banco migrado e populado)
npx playwright install   # uma vez: baixa os navegadores
npm run test:e2e         # Playwright (requer app + banco)
npm run build
```

---

## Como criar um novo Product Type

1. Acesse **Admin → Tipos de produto**.
2. Informe o nome (ex.: "Calçados").
3. Adicione atributos, definindo para cada um:
   - nome e tipo (`TEXT`, `NUMBER`, `BOOLEAN`, `SELECT`, `MULTI_SELECT`, ...);
   - **Define variante** (gera variantes);
   - **Filtrável** (aparece como filtro na loja);
   - **Obrigatório**;
   - valores (ex.: `37, 38, 39, 40`) para tipos de seleção.
4. Salve. O tipo aparece na criação de produtos.

Alternativa via código/seed: use `createProductType` de
`src/modules/catalog/product-type.service.ts`.

## Como adicionar um novo PaymentProvider

1. Crie `src/modules/payments/providers/<nome>.provider.ts` implementando
   `PaymentProvider` (`src/modules/payments/types.ts`).
2. Registre-o em `src/modules/payments/registry.ts`:

```ts
registerPaymentProvider(new StripePaymentProvider());
```

3. Aponte `PAYMENT_PROVIDER` no `.env` para o id do provider.

Nenhuma lógica de pedido precisa mudar.

## Como adicionar um novo ShippingProvider

1. Crie `src/modules/shipping/providers/<nome>.provider.ts` implementando
   `ShippingProvider` (`src/modules/shipping/types.ts`).
2. Registre em `src/modules/shipping/registry.ts`:

```ts
registerShippingProvider(new CorreiosShippingProvider());
```

3. Aponte `SHIPPING_PROVIDER` no `.env`.

---

## Decisões arquiteturais

- **Core genérico**: atributos/valores/variantes substituem campos específicos.
  O tipo de produto é dado, não código.
- **Preço centralizado**: `modules/pricing` é puro e testável; o carrinho só
  exibe o resultado. Nunca se confia em preço/estoque do frontend — o checkout
  recalcula tudo no servidor.
- **Estoque na variante**: com reservas, disponibilidade e histórico de
  movimentos com motivo.
- **Snapshots em pedidos**: `OrderItem` guarda nome, SKU, preço e atributos do
  momento da compra.
- **Providers plugáveis** para pagamento e frete, com providers de
  desenvolvimento (mock) e registro aberto para extensão.
- **Autorização perto dos dados**: `lib/auth/dal.ts` centraliza verificação de
  sessão/papel; o `proxy.ts` faz apenas checagem otimista de cookie.
- **Prisma 7** com `prisma-client` gerado em `src/generated/prisma` e driver
  adapter do PostgreSQL; URLs de conexão vivem em `prisma.config.ts`.
- **Next 16**: `params`/`searchParams` assíncronos, `proxy` no lugar de
  `middleware`, Turbopack por padrão.

## Segurança

- TypeScript strict + Zod em todas as entradas.
- Sessão/segredo apenas no servidor (`AUTH_SECRET`, `DATABASE_URL`).
- `.env.example` versionado; `.env` ignorado; nenhuma credencial real.
- Rotas admin protegidas por `requireAdmin()`; conta por `requireUser()`.
- Server Actions validam autorização e revalidam dados.

## Núcleo transacional (consistência, concorrência e idempotência)

Implementado em etapas pequenas, validando a cada passo:

- **Máquinas de estado centralizadas** (`modules/orders/order.ts`, `modules/payments/state.ts`):
  transições válidas explícitas; `CANCELED/EXPIRED → PAID` é proibido; um pagamento
  `FAILED` **não** cancela o pedido.
- **`StockReservation`**: reserva explícita por pedido/variante, estados
  `ACTIVE/CONSUMED/RELEASED/EXPIRED` e `expiresAt`.
- **Estoque concorrente**: `applyInventoryMovement` usa
  `UPDATE ... WHERE (quantityOnHand - quantityReserved) >= q` (SQL guardado),
  eliminando race conditions. `Inventory` continua sendo a fonte da verdade.
- **Checkout atômico**: `createOrder` cria pedido + itens + reserva de estoque +
  consumo de cupom + limpeza de carrinho em uma única transação.
- **Idempotência do checkout**: `Order.idempotencyKey` (UNIQUE) + `requestHash`.
  Retry/duplo clique/concorrência devolvem o mesmo pedido; chave com payload
  diferente é rejeitada.
- **Webhook idempotente**: `PaymentEvent` com `@@unique([provider, externalEventId])`
  processado na mesma transação das alterações; duplicatas são ignoradas.
- **Pagamento após cancelamento**: não reabre o pedido nem consome reserva
  liberada; o pagamento fica registrado para revisão/reembolso.
- **RELEASE / CONSUME / RESTOCK** separados: cancelar `PENDING` libera reserva;
  pagar consome; reembolsar devolve ao físico.
- **Expiração**: `expireOverdueReservations` (idempotente), pronta para um
  cron/job externo.
- **Variant Signature**: `ProductVariant.signature` determinística +
  `@@unique([productId, signature])` impede variantes duplicadas.
- **Pricing com Decimal**: aritmética monetária em `decimal.js` (sem float).
- **Observabilidade**: logs estruturados com `pino`, `x-request-id` propagado
  pelo `proxy.ts` e eventos de negócio (`ORDER_CREATED`, `STOCK_RESERVED`,
  `WEBHOOK_DUPLICATE`, ...).

### Verificação de integração (contra o banco real)

```bash
# Windows (cmd)
set NODE_OPTIONS=--conditions=react-server && npx tsx scripts/verify-transactional.ts

# Linux/macOS
NODE_OPTIONS=--conditions=react-server npx tsx scripts/verify-transactional.ts
```

Cobre 14 verificações: concorrência da última unidade, idempotência simultânea,
webhook recebido 10x, pagamento aprovado após cancelamento e expiração idempotente.

## Expiração automática de reservas (cron)

Endpoint interno protegido que executa a expiração idempotente de reservas
vencidas (reutiliza `expireOverdueReservations`; seguro sob concorrência):

```
GET/POST /api/internal/expire-reservations
Header: x-cron-secret: <CRON_SECRET>   (ou Authorization: Bearer <CRON_SECRET>)
```

Sem `CRON_SECRET` configurado (ou com segredo inválido) a rota responde `401`.

Agendamento (ex.: a cada 5 minutos):

```bash
# Linux (crontab)
*/5 * * * * curl -fsS -X POST -H "x-cron-secret: $CRON_SECRET" https://SEU_HOST/api/internal/expire-reservations
```

```powershell
# Windows (Agendador de Tarefas)
Invoke-RestMethod -Method Post -Uri https://SEU_HOST/api/internal/expire-reservations -Headers @{ "x-cron-secret" = $env:CRON_SECRET }
```

```json
// Vercel (vercel.json) — usa Authorization: Bearer <CRON_SECRET> automaticamente
{ "crons": [{ "path": "/api/internal/expire-reservations", "schedule": "*/5 * * * *" }] }
```

## Próximos passos

- Providers reais de pagamento (Mercado Pago, Stripe, PagBank) e de frete
  (Correios, Melhor Envio).
- Upload de imagens (S3/Cloudinary) no lugar de URLs.
- Cupons de frete grátis e descontos por quantidade no motor de preços.
- Busca full-text e facetas com contagem.
- Agendador (cron) chamando `expireOverdueReservations`.
- Rate limiting e verificação de assinatura dos webhooks.
