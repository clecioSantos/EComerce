# Agente de vendas no painel da loja

## Interface

O administrador autenticado acessa **Administração → Agente de vendas** ou **Configurações → Configurar agente**.

A integração usa server actions do Next.js e uma vinculação interna entre `stores.agentServiceId` e o serviço independente de agentes. **Não** embute o painel independente em iframe, nem expõe seu `ADMIN_PASSWORD` no navegador. O lojista visualiza e administra somente o agente da loja atual.

Funcionalidades:
- Cadastro do agente (cria automaticamente uma chave de API comercial exclusiva e armazena apenas seu SHA-256 no banco da loja).
- Configuração de tom de voz, orientações, emojis e sugestões de complementos.
- Conexão manual da WhatsApp Cloud API (número, Phone Number ID e token) ou Meta Embedded Signup V4.
- Ativar/desativar atendimento automático.
- Ver conversas e alternar, com verificação de propriedade, entre atendimento humano e IA.

**Limitação atual:** a vitrine principal ainda está vinculada à loja `legacy-store`. O painel serve a essa loja; múltiplas lojas e checkout multitenant em produção continuam bloqueados até a auditoria de isolamento.

## Passo 1: atualizar banco do EComerce

A migração `20261117000300_store_agent_binding` acrescenta a coluna opcional `stores.agentServiceId`.

Faça backup e execute, com `DIRECT_URL` apontando para o banco de destino:

```sh
npx prisma migrate deploy
```

Não execute `prisma migrate reset` nem o seed destrutivo.

## Passo 2: implantar o agent-service separadamente

O servidor da loja (Next.js) e o processo do WhatsApp **são dois apps Node independentes**. Na Hostinger, implante `agent-service/` como uma segunda aplicação Node, com domínio HTTPS próprio, por exemplo `https://agente.exemplo.com`. Essa URL deve chegar à porta definida em `PORT` (padrão 3100) do processo do agente. Configure persistência e reinicialização do processo, pois ele recebe webhooks e processa a fila.

Dentro do diretório `agent-service`:

```sh
npm install
npm run typecheck
npm run start
```

Use um **PostgreSQL separado** para o agente. Execute o conteúdo de `agent-service/schema.sql` nesse banco antes de iniciar; para instalações antigas, também aplique `agent-service/migrations/002_embedded_signup.sql`. **Não use o seed nem o banco da loja para as tabelas `agent_*`**.

Variáveis no servidor do agente, conforme `agent-service/.env.example`:
- `DATABASE_URL`: PostgreSQL próprio do agente.
- `MASTER_ENCRYPTION_KEY`: 32 bytes em hexadecimal, para cifrar tokens.
- `ADMIN_PASSWORD`: senha forte (16+ caracteres), compartilhada apenas com o backend do EComerce.
- `PUBLIC_BASE_URL`: endereço HTTPS próprio do agente.
- `OPENAI_API_KEY` e `OPENAI_MODEL`: credenciais e modelo usado nas respostas.
- `META_APP_ID`, `META_CONFIG_ID`, `META_APP_SECRET`, `META_VERIFY_TOKEN` e `META_GRAPH_VERSION`.
- `ALLOWED_COMMERCE_HOSTS`: hostname público HTTPS da loja, sem protocolo, por exemplo `loja.exemplo.com`.

O app precisa de registro e permissões adequados na Meta. Configure `https://agente.exemplo.com/webhook/whatsapp` e assinatura de eventos `messages`; os domínios Meta autorizados devem incluir a origem HTTPS da loja onde roda o SDK.

## Passo 3: configurar o Next.js da loja

Defina na **aplicação EComerce** (não como variáveis `NEXT_PUBLIC_*`, exceto a URL pública):

```env
NEXT_PUBLIC_SITE_URL=https://loja.exemplo.com
AGENT_SERVICE_URL=https://agente.exemplo.com
AGENT_ADMIN_PASSWORD=mesma-senha-forte-do-agent-service
```

Reinicie ambos os processos. Em **Administração → Agente de vendas**, clique **Cadastrar agente** com o atendimento desativado. Isso cria uma credencial comercial automaticamente; nenhuma chave precisa ser copiada manualmente.

Após o cadastro:
1. Clique **Conectar pela Meta** e conclua o Embedded Signup; ou informe número com DDI, Phone Number ID, token oficial e salve.
2. Ative o atendimento apenas após confirmar a conexão e testar o webhook.
3. Ajuste as orientações de vendas da loja.
4. Envie mensagens de um número de teste e veja **Atendimentos**, incluindo a opção de assumir atendimento.

## Cuidados

- Meta e OpenAI exigem contas e credenciais válidas. O deploy da `main` isoladamente **não** inicia o serviço do agente, nem conecta o WhatsApp.
- Os tokens de WhatsApp são mantidos cifrados no banco do agente, e não retornam à interface.
- Nunca coloque `ADMIN_PASSWORD`, `OPENAI_API_KEY` ou tokens Meta em `NEXT_PUBLIC_*`.
- Se `AGENT_SERVICE_URL` ou `AGENT_ADMIN_PASSWORD` estiverem ausentes, a tela indica que a configuração do servidor está pendente e impede salvar.
- Esta integração não elimina os riscos de autenticação global do dashboard independente; o painel da loja usa autenticação de administrador e verifica o vínculo da conversa antes de alterar o modo.
- Verifique o build, o serviço, o webhook e a operação real com Meta antes de oferecer o recurso comercialmente.
