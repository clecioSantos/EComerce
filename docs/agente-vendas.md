# Integração do agente de vendas — primeira etapa

Esta branch é uma fundação incremental. Não representa isolamento multiloja completo nem implantação pronta para produção.

## Alterações
- A migration cria a loja principal `legacy-store` e vincula produtos, carrinhos e pedidos existentes, sem apagar dados.
- As credenciais dos agentes são armazenadas apenas como hash SHA-256.
- Os endpoints são autenticados e vinculados à loja da credencial:
  - `GET /api/agent/v1/products?q=camiseta&limit=10`
  - `GET /api/agent/v1/products/{id}`
  - `POST /api/agent/v1/checkout-links` com JSON `{ "items": [{ "variantId": "ID", "quantity": 1 }] }`.
- O checkout link dura 24 horas, é de uso único e não realiza pagamento pelo WhatsApp.

## Desenvolvimento
1. Faça backup do banco antes de migrar.
2. Execute `npm run db:generate` e `npm run db:migrate` no ambiente de desenvolvimento.
3. Crie uma chave com `npx tsx scripts/create-agent-key.ts loja-principal`.
4. Configure `Authorization: Bearer <chave>` nas chamadas feitas pelo servidor do agente (nunca no navegador).
5. Rode `npm run typecheck`, `npm test`, `npm run test:integration` e `npm run test:e2e` antes de promover a branch.

## Limitações que precisam ser resolvidas antes da segunda loja
- Atualmente categorias, clientes, autenticação, configurações, pagamentos, promoções, cupons e outras entidades permanecem globais.
- A vitrine, rotas do painel e serviços antigos ainda não filtram todos os acessos por loja.
- Índices únicos de slug, SKU e outras chaves precisam ser revistos para escopo por loja.
- O handoff do checkout agora prioriza temporariamente o carrinho enviado pelo agente, inclusive para clientes logados. Ainda é necessário validar esse comportamento com testes de integração e E2E.
- Falta criar um painel para provisionamento/revogação das chaves, auditoria e rate limits.
- O serviço conversacional de IA e o conector WhatsApp serão outro projeto.

**Não conecte lojas adicionais nem implante esta branch em produção sem concluir a auditoria de tenant e os testes.**