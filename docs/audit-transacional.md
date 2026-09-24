# Auditoria: Consistência Transacional e Máquina de Estados

Esta auditoria foca estritamente na integridade transacional, consistência de estados e concorrência do sistema de e-commerce.

---

## 1. MÁQUINA DE ESTADOS: Order (Pedidos)

Análise das transições atuais:

| Estado atual | Evento | Estado novo | Pode ocorrer? | Efeito Estoque | Efeito Pagamento | Efeito Cupom |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| PENDING | PAID | PAID | Sim | RESERVED → OUT | PENDING → PAID | Consumido |
| PENDING | CANCELED | CANCELED | Sim | RESERVED → RELEASED | - | Revertido |
| PENDING | EXPIRED | - | Não | - | - | - |
| PAID | CANCELED | CANCELED | Sim | OUT → RELEASED | PAID → REFUNDED | Revertido |
| PAID | REFUNDED | REFUNDED | Sim | OUT → RELEASED | PAID → REFUNDED | Revertido |
| CANCELED | PAID | PAID | 🔴 Sim (Inválido) | Erro lógico | - | - |
| EXPIRED | PAID | PAID | N/A | - | - | - |

**Identificado:** A transição `CANCELED → PAID` é tecnicamente possível pelo webhook atual, o que é um risco de integridade. O estado `EXPIRED` não existe.

---

## 2. MÁQUINA DE ESTADOS: Payment

*   **Estados:** `PENDING`, `AUTHORIZED`, `PAID`, `FAILED`, `REFUNDED`, `CANCELED`.
*   **Análise:** Webhooks de provedores podem enviar estados em qualquer ordem. O sistema atual sobrescreve o estado sem verificar a consistência.

---

## 3. MÁQUINA DE ESTADOS: StockReservation (Proposta)

*   **ACTIVE (Pedido PENDING):** `quantityReserved` > 0.
*   **CONSUMED (Pedido PAID):** `quantityReserved` = 0, `quantityOnHand` reduzido.
*   **RELEASED (Pedido CANCELED/REFUNDED):** `quantityReserved` = 0.
*   **EXPIRED (Timeout):** Transição automática para `RELEASED` após X horas.

---

## 4. FLUXO TRANSACIONAL RECOMENDADO

1.  **createOrder (Transacional):** `(RESERVE estoque + Pedido + Itens + CouponUsage + CartClear)`.
2.  **initiatePayment:** `(Payment + PaymentTransaction)`. Externa.
3.  **confirmOrderPayment (Transacional):** `(RELEASE RESERVA + OUT estoque + Pedido PAID + Payment PAID)`.

---

## 5. CENÁRIOS DE FALHA

### Pagamento falhando (Checkout)
*   Fluxo: `createOrder (PENDING + Reserva)` → `Payment FAILED` → `Inventory (RESERVED)`.
*   **Problema:** A reserva não é liberada.
*   **Solução:** Webhook de `FAILED` deve disparar `cancelOrder` (ou `releaseStock`).

### Pagamento atrasado após cancelamento
*   Fluxo: `Pending` → `Canceled` (libera estoque) → Webhook `APPROVED` chega.
*   **Problema:** O pedido vai para `PAID`, mas o estoque não está mais reservado.
*   **Solução:** `handleWebhook` deve rejeitar transições se `Order.status === 'CANCELED'`.

---

## 6. CONCORRÊNCIA DE ESTOQUE

**Solução recomendada:**
```sql
UPDATE inventory 
SET quantityReserved = quantityReserved + quantity
WHERE variantId = ? 
AND (quantityOnHand - quantityReserved) >= quantity
```
*   **Comportamento:** O banco bloqueia a linha (`Row Locking`). Se o saldo for insuficiente, `rowsAffected` será 0, permitindo tratar o erro na aplicação.

---

## 7. IDEMPOTÊNCIA

*   **POST /checkout:**
    *   A) Primeira: Sucesso.
    *   B) Retry: Se chave existir, retorna 200/201 com ID existente.
    *   C) Simultâneas: DB Unique Constraint (`idempotencyKey`) bloqueia a segunda.
    *   D) Diferentes payload: Rejeitar com 400 (chave já usada por pedido diferente).
    *   E) Usuários diferentes: Rejeitar com 403.

---

## 8. WEBHOOK

**Estratégia transacional idempotente:**
1.  Criar tabela `PaymentEvent` (externalEventId UNIQUE).
2.  Início da transação.
3.  Tentar inserir `PaymentEvent`. Se falhar, retornar 200 (já processado).
4.  Processar lógica de negócio.
5.  Commit.

---

## 9. CLASSIFICAÇÃO DE PRIORIDADES

| Prioridade | Problema |
| :--- | :--- |
| **CRÍTICO** | Inconsistência do Webhook (aceita pagamento de cancelado) |
| **CRÍTICO** | Concorrência de estoque (overselling por falta de lock) |
| **ALTO** | Falta de Idempotência no Checkout (pedidos duplicados) |
| **ALTO** | Falta de Idempotência no Webhook (duplicação de efeitos) |
| **MÉDIO** | Estados de Pedido Inválidos (CANCELED -> PAID) |
| **BAIXO** | Migração do Pricing Engine para Decimal.js |
