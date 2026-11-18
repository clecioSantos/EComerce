# Agente de vendas na Hostinger — uma aplicação Node.js

## Arquitetura unificada

A aplicação Next.js e o agente de WhatsApp usam o **mesmo processo Node.js** e **a mesma porta** da aplicação Hostinger. Não é necessário reservar outra vaga Node, outra aplicação, outro domínio ou outro banco PostgreSQL.

- `npm run build` continua compilando o Next.js com Webpack.
- `npm start` agora usa `node --import tsx server.mjs`.
- `server.mjs` cria o servidor Next.js, hospeda `/api/webhooks/whatsapp` e inicializa o worker de mensagens com timer no mesmo processo.
- Todas as tabelas de atendimento do agente ficam no **PostgreSQL já usado pela loja**, com nomes `agent_*`, criadas na migração Prisma `20261117000400_embedded_agent_tables`.
- O painel **Administração → Agente de vendas** usa apenas chamadas de servidor, que acessam uma API interna via loopback `127.0.0.1:PORT`. A API recusa conexões remotas antes de processar qualquer solicitação.
- As credenciais comerciais geradas pelo painel continuam associadas à loja `legacy-store`; não são compartilhadas com outros lojistas.
- As respostas recebidas da Meta são confirmadas por HMAC antes do enfileiramento. O worker processa a fila persistida no PostgreSQL com tentativas e controle de falhas.

`agent-service/src/standalone.ts` continua existindo **somente para compatibilidade** com instalações antigas em servidor separado; não é usado no deploy Hostinger unificado.

## 1. Migrar o banco existente

Faça backup e execute **uma vez**, conectado ao PostgreSQL correto (mesmo valor de `DIRECT_URL` usado nas migrações da loja):

```sh
npx prisma migrate status
npx prisma migrate deploy
```

As migrações pendentes `20261117000300_store_agent_binding` e `20261117000400_embedded_agent_tables` são aditivas, não apagam produtos, pedidos, clientes ou pagamentos. **Não use `prisma migrate reset` nem `prisma/seed.ts`**.

## 2. Configurar a mesma aplicação na Hostinger

Mantenha como diretório raiz a **raiz do repositório EComerce**, não `agent-service/`.

Comando de build: `npm run build`  
Comando de inicialização: `npm start`  
Porta: a `PORT` fornecida pela Hostinger (o aplicativo usa `3000` como fallback).

Configure na **mesma aplicação**:

```env
AGENT_EMBEDDED=true
NEXT_PUBLIC_SITE_URL=https://loja.seudominio.com
AGENT_ADMIN_PASSWORD=uma-senha-longa-de-16-caracteres-ou-mais
MASTER_ENCRYPTION_KEY=64-caracteres-hexadecimais
META_APP_ID=identificador-do-aplicativo-meta
META_CONFIG_ID=identificador-do-embedded-signup
META_APP_SECRET=segredo-do-app-meta
META_VERIFY_TOKEN=seu-token-de-verificacao-de-webhook
META_GRAPH_VERSION=v23.0
GEMINI_API_KEY=sua-chave-gemini
GEMINI_MODEL=gemini-2.5-flash
ALLOWED_COMMERCE_HOSTS=loja.seudominio.com
```

Mantenha as variáveis já existentes da loja: `DATABASE_URL`, `AUTH_SECRET`, Mercado Pago, frete etc. Em modo integrado, `DATABASE_URL` é **compartilhada**; não é necessário banco separado nem `AGENT_SERVICE_URL`. Não configure `PUBLIC_BASE_URL` para outro domínio — por padrão, o agente usa `NEXT_PUBLIC_SITE_URL`.

Gere a chave AES com `openssl rand -hex 32` ou o equivalente PowerShell. **Não comite credenciais no GitHub, nem use `NEXT_PUBLIC_` para segredos.**

Se alguma das variáveis indispensáveis estiver ausente, o servidor mantém a **loja funcionando**, mas não inicia o agente; um aviso aparece nos logs e a tela administrativa informa indisponibilidade.

## 3. Configurar a Meta

Na Meta for Developers, habilite WhatsApp Cloud API + Embedded Signup e configure o webhook no **mesmo domínio da loja**:

```text
https://loja.seudominio.com/api/webhooks/whatsapp
```

Use o valor de `META_VERIFY_TOKEN` como Verify Token; assine o campo `messages`. O token de acesso do WhatsApp pertence ao número e pode ser configurado pelo painel; `META_APP_SECRET` e `GEMINI_API_KEY` ficam apenas no backend.

O Meta Embedded Signup exige configuração de domínio/origem OAuth e permissões de WhatsApp aprovadas pela Meta. Sem essas permissões, o cadastro por SDK não finaliza mesmo com o servidor funcionando.

## 4. Administrar o agente

Entre como administrador da loja, acesse **Administração → Agente de vendas**.

1. Configure personalidade, instruções de atendimento e preferências.
2. Cadastre o agente inicialmente **desativado**. O backend cria automaticamente a credencial comercial e vincula o agente à loja.
3. Escolha **Conectar pela Meta** e **Autorizar na Meta**, ou informe o número, Phone Number ID e token manualmente.
4. Confirme a conexão antes de ativar o atendimento.
5. Envie uma mensagem de outro número para testar. Em **Atendimentos**, consulte mensagens, assuma a conversa e devolva à IA.

## Validação e limitações

- Verifique em uma aplicação rodando: `GET /api/webhooks/whatsapp` sem verify token deve retornar **403** (agente ativo) ou **503** (agente não configurado).
- O painel `/admin/agente` exige login de administrador. O caminho `/__internal/agent/admin/api/*` aceita **apenas loopback** e ainda exige autenticação Basic no servidor. Não configure proxy público para expor essas rotas.
- O worker depende de processo Node persistente, disponível no ambiente informado. Em escalonamento horizontal com várias instâncias, a fila usa `FOR UPDATE SKIP LOCKED`, mas a aplicação deve ser monitorada.
- O Next.js **não deve** ser iniciado por `next start` diretamente nesta arquitetura. Isso abre a loja mas não inicia o webhook/worker integrado.
- O worker herda regras de fila e retry do serviço anterior. Integração ponta a ponta com a Meta só pode ser concluída após credenciais, conexão real e teste de mensagens.
- O isolamento multiloja da loja virtual ainda precisa de auditoria completa para produção com várias lojas.
