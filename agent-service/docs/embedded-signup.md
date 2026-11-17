# Embedded Signup V4: configuração e segurança

1. Na Meta for Developers, configure um app com WhatsApp Business Platform e Facebook Login for Business no modo **WhatsApp Embedded Signup V4**. Solicite as permissões necessárias e habilite o aplicativo para os estabelecimentos autorizados.
2. Configure **META_APP_ID**, **META_APP_SECRET**, **META_CONFIG_ID**, **META_VERIFY_TOKEN** e **META_GRAPH_VERSION** (conforme Graph API suportada). O segredo só fica no backend.
3. Configure domínio HTTPS permitido pela Meta, origem do SDK e endpoint de webhooks `https://<host>/webhook/whatsapp`. Habilite o webhook `messages`.
4. No ambiente do agente, configure **ALLOWED_COMMERCE_HOSTS** com os domínios das APIs de lojas aprovadas, separados por vírgula. Não permita destinos arbitrários.
5. Cadastre uma loja com a chave da API comercial e clique **Conectar WhatsApp pela Meta** no painel `/admin`. A conexão usa o SDK JavaScript (V4) e troca o code no servidor, vinculando o WABA e o Phone Number ID à loja via Graph API.
6. Um número novo exige PIN de 6 dígitos para registro. Na coexistência, a Meta pode usar uma etapa própria e dispensar `/register`, desde que o fluxo informe essa condição.
7. A conexão só é ativada após confirmação da Meta, assinatura de webhooks e registro quando aplicável. Se houver erro, o cadastro não é ativado. Teste com conta Meta autorizada antes de oferecer o recurso aos clientes.

## Limitações
- A aprovação da Meta, permissões, contas comerciais e confirmação dos números dependem do fornecedor e não podem ser concluídas por código.
- Atualmente o painel usa autenticação única de administrador da plataforma; ainda não é um portal separado com permissões por lojista.
- O isolamento dos dados comerciais no EComerce ainda requer revisão global de todas as consultas públicas, pagamentos, configurações e cupons antes de várias lojas operarem em produção.
- Os testes de infraestrutura, webhook real, build e ponta a ponta não foram executados nesta entrega.
- O número cadastrado manualmente ainda é suportado para uso inicial e contingência.
