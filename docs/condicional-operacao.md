# Operação do condicional — primeira versão

## Onde usar

- **Administração → Condicionais → Políticas e produtos**: definir tetos, prazos, condições, política de frete e produtos elegíveis.
- **Administração → Clientes → abrir cadastro**: conferir nome, contato e endereço; avaliar elegibilidade e definir limites individuais de valor e peças, por solicitação e no total em aberto, e quantidade de operações simultâneas.
- **Minha conta → Meus condicionais e limites**: consultar situação e capacidade, solicitar peças e acompanhar cada operação.
- Na página de um produto habilitado, o link **Solicitar para experimentar no condicional** leva à sacola própria de condicional com a variante selecionada.

O recurso começa desativado. Clientes começam sem avaliação e sem limites. Produto habilitado não concede autorização à cliente. Para ativar, a loja precisa definir limites positivos e as condições comerciais; nenhum valor de crédito ou política de frete é presumido como aprovado.

## Ciclo operacional

1. Cliente autenticada seleciona variantes e quantidades, endereço cadastrado e entrega. Nome e telefone podem ser atualizados em Minha conta.
2. Ela revisa condições, fretes e taxa de retorno informada, aceita a versão e envia a solicitação. O administrador também pode registrar uma solicitação para uma cliente autorizada, com o aceite dela.
3. Administrador aprova: disponibilidade e limites são verificados novamente, e a reserva é feita na mesma transação. O valor total em aberto respeita os tetos da loja e os individuais.
4. Administrador registra saída e evidência de retirada/postagem. Peças passam ao saldo **Em condicional** e deixam o físico da loja.
5. Administrador confirma recebimento pela cliente com evidência. Começa o prazo de experimentação.
6. Cliente informa quantas unidades quer comprar de cada variante. A escolha fica fixada, gera o acerto e não altera as quantidades em estoque por si só.
7. Cliente inicia o pagamento por **PIX**. Webhooks e reconciliação do provedor confirmam o pagamento; não existe cobrança automática por prazo vencido ou cartão salvo.
8. Cliente informa o retorno; a loja registra as quantidades efetivamente recebidas. Elas entram em **Em conferência**, sem ficarem disponíveis para venda.
9. Conferência aprovada libera as peças e o limite correspondente. Divergência mantém quarentena; baixa física sem cobrança precisa de decisão e justificativa administrativas.
10. O sistema encerra o condicional quando peças e acerto estiverem resolvidos e não houver ocorrência aberta.

Pagamento e devolução são independentes. Pagamento aprovado não significa que as outras peças retornaram. Uma declaração de retorno ou um prazo vencido nunca repõe estoque.

## Prazos e ocorrências

As telas mostram os prazos vencidos e bloqueiam novas aprovações para clientes com pendências. O administrador pode registrar/resolver ocorrências e prorrogar escolha, retorno e pagamento com motivo e histórico.

O endpoint já existente `/api/internal/expire-reservations` também executa a manutenção do condicional, protegido por `CRON_SECRET`. É necessário manter o agendamento externo desse endpoint. O botão **Revisar prazos e gerar avisos** permite a mesma manutenção manual. Solicitações e reservas vencidas ainda na loja são canceladas e liberadas. Peças que saíram não são liberadas por expiração.

Avisos da primeira versão ficam no próprio sistema. Não há envio automático de WhatsApp/e-mail nem emissão automática de etiqueta reversa.

## Frete e pagamento

A ida utiliza a cotação já existente, com retirada quando disponível pelo serviço atual. A loja configura se assume a ida ou a inclui no acerto. A taxa de retorno é um valor previamente acordado e exibido antes do aceite; não deve ser confundida com uma cotação automática de logística reversa. É cobrada somente quando existem peças previstas para devolução.

O acerto usa preços por item registrados na solicitação e aceitos na aprovação, sem cupons ou promoções de conjunto nesta primeira versão. Não há edição da escolha depois da confirmação. Divergências devem ser acompanhadas administrativamente, sem emitir cobranças adicionais automáticas.

Devolução posterior de peças já compradas pode ser recebida e conferida no detalhe. O reembolso integral pelo pedido vinculado só é permitido depois da conferência de todas as peças compradas. Esse reembolso não repõe estoque outra vez. Reembolsos parciais e recálculo de escolhas não são automatizados.

## Banco e compatibilidade

A migração antiga `14_conditional_purchase` foi recuperada da branch local `pendents`; seu checksum corresponde ao registro já aplicado no banco. Seus modelos e tabelas foram preservados. Na inspeção anterior à implementação, clientes, operações, termos e reservas antigos estavam vazios. A versão atual usa as novas tabelas e não converte operações legadas automaticamente.

A migração `20261119000100_conditional_purchase` adiciona o fluxo atual, os saldos de custódia/conferência e o vínculo com pedidos. Não muda preços, estoques ou elegibilidade existentes. As novas tabelas têm RLS e acesso direto revogado para os papéis públicos da Data API; a aplicação utiliza seus serviços autenticados no servidor.

A aplicação atual ainda opera a vitrine e o painel da loja `legacy-store`; o módulo segue esse mesmo limite. Os dados novos são separados por loja, mas isso não habilita uma vitrine multiloja nem permite escolher livremente um tenant pelo navegador.

## Verificação e limites

Os testes transacionais usam loja, produtos e clientes fictícios exclusivos de cada execução e removidos ao final. Frete e provedor de pagamento são simulados nesses testes; não há cobranças reais. Os cenários incluem compra parcial, concorrência de limites, suspensão, retorno parcial, quarentena, reembolso sem reposição duplicada e isolamento entre clientes.

A primeira versão mantém aprovação manual, pagamento voluntário por PIX e devolução/conferência operadas pela loja. Não inclui pré-autorização de cartão, caução, análise automática de crédito, documentos fiscais ou contratação automática de transporte.
