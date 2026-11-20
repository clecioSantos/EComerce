# Projeto de venda no condicional

Status: projeto aprovado; primeira versão implementada. Consulte também o guia de operação.
Data: 19/11/2026.

## 1. Objetivo e recomendação

Permitir que a cliente receba peças para experimentar, escolha quais deseja comprar e devolva as demais, com controle das mercadorias, prazos, devoluções e pagamento final.

Recomendo um módulo próprio de **Condicionais**, ligado aos pedidos de venda existentes. A solicitação de condicional não deve nascer como um pedido comum aguardando pagamento: ela representa uma remessa de mercadorias sob responsabilidade da cliente, que pode gerar uma venda parcial ou nenhuma venda.

Para a primeira versão, proponho aprovação manual da loja e pagamento das peças escolhidas no acerto final, iniciado pela própria cliente. Esse modelo depende de a loja aceitar o risco de enviar mercadorias antes do pagamento. Pré-autorização de cartão ou caução são alternativas para uma etapa posterior, sujeitas à validação técnica e comercial do provedor.

Todas as regras abaixo são propostas. Limites, prazos, fretes e condições comerciais precisam ser definidos antes de habilitar o recurso.

Requisito confirmado: o cadastro da cliente deve indicar sua elegibilidade para condicional e seus limites individuais de valor e quantidade. A elegibilidade cadastral não substitui a aprovação de cada solicitação.

## 2. O que existe e pode ser aproveitado

| Área        | Situação verificada no código                                     | Uso no condicional                                                       |
| ----------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Catálogo    | Produtos, variantes, preços, imagens e estoque                    | Reutilizar seleção de tamanho/cor e snapshots dos itens                  |
| Checkout    | `placeOrder` cria pedido e inicia pagamento na mesma operação     | Reutilizar componentes, mas criar entrada e serviço próprios             |
| Reservas    | `StockReservation` exige pedido e expira por padrão em 30 minutos | Manter para compra comum; criar alocação própria para o condicional      |
| Estoque     | Operações atômicas, movimentações e disponibilidade por variante  | Estender para remessa, custódia e conferência de devoluções              |
| Pagamentos  | Criação, consulta, webhooks, reconciliação e reembolso            | Reutilizar pagamento do acerto, adaptando efeitos sobre estoque          |
| Reembolso   | `refundPayment` devolve automaticamente todos os itens ao estoque | Separar devolução financeira de retorno físico no novo fluxo             |
| Frete       | Cotação por peso, dimensões e CEP; opção de retirada              | Reutilizar cotação de ida; criar controle de remessa e retorno           |
| Autorização | Sessão, usuário e administrador                                   | Exigir cliente autenticada e verificar propriedade/loja em cada operação |
| WhatsApp    | Agente consulta produtos e gera checkout de compra normal         | Integração específica em etapa posterior                                 |

Arquivos centrais analisados: `src/modules/checkout/checkout.service.ts`, `src/modules/orders/order.service.ts`, `src/modules/inventory/{inventory.service,reservation.service,expiration.service}.ts`, `src/modules/payments/{types,payment.service}.ts`, `src/modules/shipping/quote.service.ts`, `src/lib/auth/dal.ts` e `prisma/schema.prisma`.

A investigação inicial da main e da branch `feature/conditional-purchase-v2` não encontrou o fluxo. Durante a implementação foi identificada uma versão antiga na branch local `pendents`, acompanhada da migração `14_conditional_purchase` já aplicada no banco. A migração e os modelos legados foram recuperados e preservados; as tabelas de operações, clientes, termos e reservas estavam vazias. A busca inicial não cobriu adequadamente essa branch.

## 3. Escopo da primeira versão

Inclui:

- Recurso ativado por loja e habilitado por produto/variante.
- Solicitação pela cliente autenticada ou criação pelo administrador para uma cliente identificada.
- Ficha cadastral com situação de elegibilidade, limites individuais de valor/quantidade, utilização e saldo disponível por cliente e loja.
- Sacola de condicional separada da compra comum, sem misturar as duas operações na mesma finalização.
- Aprovação ou recusa manual, com limites de quantidade, valor e solicitações abertas.
- Reserva atômica na aprovação, separação e registro de saída das peças.
- Retirada ou envio, conforme os meios e a política de frete definidos pela loja.
- Confirmação de recebimento, prazo de escolha e prazo de devolução.
- Escolha por item e quantidade: ficar ou devolver.
- Pagamento do acerto, com cobrança somente das peças escolhidas e dos encargos previamente aceitos.
- Registro manual de retorno, conferência física e reposição dos itens aprovados.
- Acompanhamento pela cliente, painel administrativo e histórico de eventos.
- Avisos de prazo no sistema e processamento periódico das pendências.

Ficam para uma evolução:

- Aprovação automática por análise de crédito ou risco.
- Cobrança automática por silêncio, prazo vencido ou cartão salvo.
- Pré-autorização, captura parcial, caução e cobrança recorrente.
- Emissão automática de etiqueta de devolução e acompanhamento automático da transportadora.
- Troca de peças dentro do mesmo condicional; na primeira versão, abrir nova solicitação.
- Automação comercial pelo agente de WhatsApp e mensagens externas automáticas.
- Cupons e promoções condicionados ao conjunto final de peças; a primeira versão usa preços e descontos por item fixados na aprovação.

### 3.1. Cadastro da cliente, elegibilidade e limites

O cadastro deve reunir os dados de identificação e contato já existentes — nome completo, e-mail, telefone e endereços — e um perfil de condicional por loja. A necessidade de documento de identificação deve ser definida pela operação antes da implementação; não presumir que esse dado já exista no cadastro atual. Não coletar dados adicionais sem finalidade definida.

**Aba Condicional no cadastro administrativo da cliente:**

| Informação                      | Comportamento proposto                                                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Situação                        | Não avaliada, elegível, suspensa ou não elegível                                                                                |
| Limite de valor total em aberto | Teto monetário somando todos os condicionais ainda sob responsabilidade da cliente                                              |
| Limite de peças em aberto       | Teto de unidades físicas, somadas em todos os condicionais; duas unidades do mesmo SKU contam como duas peças                   |
| Limites por solicitação         | Tetos próprios de valor e quantidade por operação, além dos limites totais                                                      |
| Limite de operações simultâneas | Quantidade máxima de condicionais aprovados ainda não encerrados, inclusive quando ainda houver pagamento ou devolução pendente |
| Utilização atual                | Valor comprometido, peças comprometidas, operações abertas e pendências                                                         |
| Saldo disponível                | Diferença entre limites efetivos e utilização atual, sem exibir saldo negativo como capacidade utilizável                       |
| Avaliação e revisão             | Quem aprovou/alterou, quando, motivo e eventual data de validade da elegibilidade                                               |
| Observações internas            | Justificativa administrativa e ocorrências; não expor anotações internas à cliente                                              |

O perfil nasce **não avaliado e sem autorização para novas aprovações**. A liberação é manual por administrador autorizado. Não inferir elegibilidade por histórico de compras nem por agente de IA.

**Regras para definir os limites:**

- A loja configura os tetos gerais; o cadastro define os limites individuais da cliente. Como proposta inicial, vale o menor teto aplicável. Um limite individual não ultrapassa o teto da loja silenciosamente.
- Limite ausente não significa ilimitado: exigir definição dos limites de valor e quantidade antes de marcar o perfil como elegível. Zero significa nenhuma capacidade para novas aprovações.
- A mesma cliente pode ter condições diferentes em lojas diferentes. Identificar o perfil por cliente e loja, nunca somente pelo e-mail informado na solicitação.
- A moeda do limite deve corresponder à da operação. A primeira versão não mistura moedas nem soma valores sem conversão definida.
- Usar os preços e descontos fixados na aprovação para comprometer o limite monetário das mercadorias. Frete e outros encargos aparecem separadamente no acerto; não alterar o significado do limite ao longo da operação.
- A quantidade representa unidades, não quantidade de modelos ou variantes diferentes.
- Reduzir um limite não altera preços, escolhas ou remessas existentes. Se a utilização passar a superar o novo teto, mostrar a situação e bloquear novas aprovações até a regularização.
- Suspender ou tornar a cliente não elegível impede novas aprovações e novas saídas. Não impede consulta, pagamento, devolução ou conferência das operações anteriores; remessas aprovadas ainda não expedidas ficam para revisão administrativa.
- Pendências vencidas ou divergências impeditivas bloqueiam novas aprovações enquanto não forem resolvidas, independentemente de haver saldo numérico. Uma extensão de prazo ou resolução precisa de motivo e histórico.

**Quando o limite é comprometido e liberado:**

| Evento                                          | Efeito sobre o limite da cliente                                                                     |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Solicitação ainda não aprovada                  | Mostra capacidade estimada, mas não compromete saldo nem garante aprovação                           |
| Aprovação e reserva                             | Compromete valor e quantidade aprovados, na mesma transação da reserva de estoque                    |
| Expedição ou início da experimentação           | Mantém o comprometimento, sem contar a mesma operação novamente                                      |
| Escolha de comprar ou declaração de devolução   | Mantém o limite comprometido até pagamento confirmado ou conferência do retorno                      |
| Pagamento confirmado das peças escolhidas       | Libera o valor e a quantidade dessas peças, sem encerrar outras pendências da operação               |
| Devolução conferida e aprovada                  | Libera o valor e a quantidade dos itens efetivamente resolvidos                                      |
| Cancelamento/expiração antes da saída           | Libera somente a alocação ainda reservada na loja, exatamente uma vez                                |
| Avaria, extravio, divergência ou valor pendente | Mantém o compromisso ou bloqueio até resolução registrada; não liberar por simples mudança de status |

Proposta conservadora: uma devolução recebida, mas ainda não conferida, continua comprometendo o limite. Resolução administrativa excepcional deve registrar destinação e eventual obrigação financeira, sem apagar o histórico.

Exemplo ilustrativo: cliente elegível com limite total de **R$ 2.000 e 8 peças**; possui **R$ 750 e 3 peças** comprometidos. Restam **R$ 1.250 e 5 peças**, ainda sujeitos ao teto por solicitação, ao número de operações abertas e à ausência de bloqueios. Uma nova solicitação de R$ 1.300 ou 6 peças não pode ser aprovada. Esses números são apenas exemplo, não configuração definida.

**Validação obrigatória no servidor:** conferir cadastro, elegibilidade, validade, pendências e todos os limites na solicitação e novamente na aprovação. Na aprovação, bloquear a linha do perfil da cliente ou usar controle atômico equivalente, além de reservar o estoque. Duas solicitações simultâneas não podem consumir o mesmo saldo. Na saída, verificar se houve suspensão ou bloqueio desde a aprovação, sem comprometer o limite duas vezes.

Mudanças de elegibilidade, limites, validade, bloqueios e exceções exigem autor, data, valor anterior, valor novo e motivo. A cliente pode consultar sua situação, utilização e limites disponíveis; não pode editar sua autorização nem seus tetos. O administrador deve visualizar o resumo cadastral dentro do condicional, sem precisar sair da operação.

## 4. Jornada proposta

1. A cliente seleciona peças elegíveis, variante e quantidade na sacola de condicional.
2. Informa ou confirma endereço, meio de recebimento e aceita a versão vigente das condições.
3. O servidor valida produtos, loja, cadastro, elegibilidade, pendências, limites individuais/gerais e disponibilidade. Cria a solicitação sem cobrar e sem prometer estoque ou capacidade reservados.
4. O administrador consulta o resumo cadastral, aprova, compromete os limites da cliente e reserva as peças atomicamente. Elegibilidade, limites e disponibilidade são verificados novamente nessa etapa.
5. A loja separa, confere e registra a retirada ou postagem. O sistema registra exatamente as quantidades que saíram.
6. O recebimento é confirmado. Na primeira versão, a loja registra uma confirmação com evidência ou valida a declaração da cliente. Só então começa o prazo de experimentação.
7. A cliente marca as quantidades que quer comprar e devolver. O resumo mostra os valores finais antes da confirmação.
8. A escolha confirmada gera o acerto e um pedido de venda vinculado somente às peças escolhidas. Se não houver peças escolhidas, não criar venda fictícia de valor zero; tratar apenas eventuais encargos previstos.
9. A cliente paga e devolve as demais peças. São processos independentes: pagar não significa ter devolvido, e declarar devolução não significa retorno físico.
10. A loja recebe e confere as devoluções. Apenas peças aptas voltam à disponibilidade.
11. O condicional é encerrado quando não existem pendências de peças, conferência ou pagamento.

Exemplo: saem cinco peças; a cliente escolhe duas e devolve três. A venda contém duas peças. As três restantes só voltam ao disponível depois da chegada e conferência.

## 5. Estados e prazos

Evitar um único status tentando representar pagamento, transporte e devolução. Usar dimensões independentes e derivar um resumo legível na interface.

| Dimensão           | Estados propostos                                                                         |
| ------------------ | ----------------------------------------------------------------------------------------- |
| Solicitação        | Solicitada, aprovada, recusada, cancelada, encerrada                                      |
| Remessa de ida     | A separar, separada, expedida/retirada, recebida, com ocorrência                          |
| Escolha            | Não iniciada, aguardando escolha, confirmada                                              |
| Acerto financeiro  | Não gerado, aguardando pagamento, pago, falhou, vencido, em revisão                       |
| Devolução por item | Não solicitada, prevista, em retorno, recebida, em conferência, aprovada, com divergência |

Um condicional pode estar simultaneamente com pagamento concluído e devolução pendente. A tela deve mostrar as duas informações.

Prazos separados e configuráveis:

- Validade de uma solicitação ainda não aprovada.
- Limite de separação/expedição após reserva, com liberação apenas se as peças ainda estiverem na loja.
- Experimentação contada a partir do recebimento confirmado.
- Postagem ou entrega da devolução.
- Pagamento do acerto.
- Trânsito de retorno e conferência, acompanhados sem penalizar automaticamente a cliente por atraso da transportadora.

Vencimento gera pendência e alerta. **Nunca libera estoque de uma peça que já saiu da loja, nunca converte silêncio em compra e nunca dispara cobrança automática na primeira versão.** Cancelamento antes da saída pode liberar reserva; depois da saída exige tratamento de devolução e acerto.

## 6. Estoque: regra central

Proposta de significado dos saldos:

- `quantityOnHand`: peças fisicamente na loja, incluindo as recebidas em conferência.
- `quantityReserved`: peças fisicamente na loja e reservadas para compra ou condicional aprovado.
- `quantityOnConditional`: peças fora da loja, ainda sob controle do condicional, incluindo as em trânsito.
- `quantityQuarantined`: peças fisicamente na loja, indisponíveis enquanto aguardam conferência ou solução de divergência.
- Disponível = físico na loja − reservado − quarentena.

| Evento                            | Efeito esperado                                                             |
| --------------------------------- | --------------------------------------------------------------------------- |
| Aprovação                         | Aumenta reservado; reduz disponível                                         |
| Saída para condicional            | Reduz físico e reservado; aumenta em condicional                            |
| Cliente escolhe ficar             | Registra decisão; peças continuam sob controle até a confirmação financeira |
| Pagamento aprovado das escolhidas | Reduz em condicional; registra venda sem baixar o físico da loja novamente  |
| Cliente declara devolução         | Registra intenção; nenhum aumento de disponível                             |
| Chegada da devolução              | Reduz em condicional; aumenta físico e quarentena                           |
| Conferência aprovada              | Reduz quarentena; aumenta disponível                                        |
| Avaria, extravio ou divergência   | Mantém pendência ou registra destinação expressa, sem reposição automática  |

Implementar movimentações específicas e rastreáveis. Atualizar todas as leituras de disponibilidade, incluindo catálogo, carrinho, checkout comum, painel e API dos agentes. Os testes também devem assegurar que uma reserva comum não utilize unidades em quarentena.

As alterações devem ser atômicas e idempotentes, com validação de saldo no banco. Na implantação, os novos saldos começam em zero: não reinterpretar retroativamente pedidos nem movimentações existentes.

## 7. Modelo de dados proposto

| Entidade                          | Responsabilidade                                                                                                           |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `ConditionalSettings`             | Ativação e políticas por loja; limites, prazos, elegibilidade e fretes                                                     |
| `ConditionalCustomerProfile`      | Perfil único por cliente/loja, situação de elegibilidade, limites individuais, validade e avaliação administrativa         |
| `ConditionalCustomerProfileEvent` | Histórico de alterações de elegibilidade, limites, bloqueios e revisões, com autor e motivo                                |
| `ConditionalCase`                 | Cliente, loja, número, estados gerais, endereço, condições aceitas e datas                                                 |
| `ConditionalItem`                 | Variante e snapshot de SKU, preço, desconto, imagem, quantidades e decisões                                                |
| `ConditionalAllocation`           | Reserva/custódia por item e vínculo com as movimentações de estoque                                                        |
| `ConditionalShipment`             | Ida ou retorno, modalidade, custos, rastreio e evidências de recebimento                                                   |
| `ConditionalReturn` e itens       | Quantidades previstas/recebidas, conferência, condição e divergências                                                      |
| `ConditionalEvent`                | Histórico imutável de ações, responsável, motivo e chave de idempotência                                                   |
| Vínculo com `Order`               | Pedido de venda originado no acerto; origem de atendimento explícita para não reservar ou baixar o mesmo estoque novamente |

O desenho final de tabelas deve evitar duplicar saldos sem uma fonte de verdade. As quantidades acumuladas precisam ser reconciliáveis com as alocações e movimentações. Campos críticos não devem existir somente em JSON; metadados ficam para detalhes auxiliares.

Incluir isolamento por `storeId`, propriedade por cliente, controle de versão para alterações concorrentes, índices de pendências/prazos e restrições contra quantidades negativas ou superiores às enviadas. Aceites devem guardar versão das condições, data e identificação da cliente.

No perfil da cliente, prever campos tipados para `eligibilityStatus`, `maxOpenAmount`, `maxOpenUnits`, `maxCaseAmount`, `maxCaseUnits`, `maxOpenCases`, `currency`, `reviewedBy`, `reviewedAt` e eventual `eligibleUntil`. Os valores comprometidos devem ser derivados das alocações não resolvidas ou mantidos como projeção transacional reconciliável; não permitir um saldo manual independente das operações. Relacionar cada aprovação à versão da política e aos limites efetivos usados na decisão.

## 8. Pagamento e precificação

Reutilizar o provedor e a reconciliação já existentes para o pagamento voluntário do acerto. A interface atual `PaymentProvider` não expõe operações próprias de autorização, captura ou liberação; a presença do status `AUTHORIZED` não comprova que esse fluxo esteja implementado.

Separar a criação do pedido financeiro dos efeitos de atendimento/estoque. Pedidos provenientes do condicional usam as peças já em custódia; não passam pela reserva normal nem recebem uma segunda expedição. O encerramento não depende do status comum `DELIVERED`: depende do pagamento e da resolução de todas as peças.

Regras propostas:

- Guardar preços e descontos unitários aceitos na aprovação, com validade definida pela política.
- Calcular sempre no servidor, usando a aritmética monetária existente.
- Fixar a escolha enquanto houver uma tentativa de pagamento em andamento. Mudanças posteriores exigem revisão controlada e reconciliação da tentativa anterior.
- Criar tentativas idempotentes e impedir mais de uma venda/pagamento confirmado para a mesma versão do acerto.
- Pagamento recusado ou vencido mantém a pendência financeira e a custódia; não repõe mercadoria.
- Pagamento tardio, duplicado ou incompatível com uma revisão entra em conciliação, sem duplicar baixa de estoque.
- Devolução de peça não comprada não gera reembolso de mercadoria.
- Reembolso de peça comprada deve ter tratamento financeiro separado; sua disponibilidade só muda após retorno e conferência.
- Divergências, avarias e perdas exigem registro e análise manual; não pressupor cobrança aceita.

## 9. Frete e devolução

A cotação de ida pode usar o serviço atual e todas as peças da remessa. O retorno considera apenas as peças devolvidas, embalagem efetiva e sentido inverso do transporte.

Definir antes do lançamento quem paga ida e volta, quando paga, o que acontece se a cliente não ficar com nenhuma peça e como proceder em retiradas na loja. Não habilitar o fluxo enquanto essa política estiver indefinida. Mostrar custos confirmados e estimativas separadamente, sem prometer retorno gratuito ou descontar taxas não aceitas.

Na primeira versão, registrar postagem, rastreio e recebimento manualmente. Cotar frete não equivale a emitir etiqueta, contratar transporte ou comprovar entrega. A automação de logística reversa precisa de uma integração própria em etapa posterior.

## 10. Telas e ações

**Loja e conta da cliente:** identificação de produtos elegíveis, sacola de condicional, revisão das condições, confirmação de solicitação, lista de condicionais, detalhes com linha do tempo, prazo, seleção por item/quantidade, resumo do acerto, pagamento e acompanhamento da devolução.

**Administração:** menu Condicionais; lista com filtros por cliente, estado e pendência; aprovação/recusa; separação e saída; confirmação de recebimento; conferência por item; extensão de prazo com motivo; registro de ocorrências; acerto vinculado; histórico e relatórios de peças fora da loja.

**Cadastro de clientes:** detalhe com identificação, contato, endereços e aba Condicional; ações de avaliar, habilitar, suspender e revisar limites; indicadores de valor/peças comprometidos e disponíveis; histórico de alterações e operações da cliente. A listagem de clientes deve permitir filtrar por elegibilidade, bloqueio e limite excedido. A cliente visualiza seus limites e eventuais pendências em sua conta, com mensagens claras e sem observações administrativas internas.

No detalhe, apresentar blocos separados para **peças**, **pagamento**, **devolução** e **prazos**. Isso evita mostrar um condicional como finalizado quando ainda há mercadoria ou valor pendente.

**Configurações:** ativação por loja, produtos elegíveis, clientes habilitados, quantidade/valor máximos, limite de condicionais simultâneos, prazos, modalidades de entrega e versão das condições comerciais.

## 11. Serviços, permissões e tarefas periódicas

Criar domínio próprio em `src/modules/conditional/`, com regras de transição, validação de entrada, alocação, escolha, devolução, acerto e encerramento. Server Actions e rotas devem chamar esses mesmos serviços.

Cliente só consulta/decide sobre seus condicionais e nos estados permitidos. Administrador atua apenas na loja autorizada. Agentes não recebem permissão para aprovar, dispensar pagamento, conferir retorno ou baixar perdas.

O serviço central de elegibilidade deve ser usado tanto na criação administrativa quanto na solicitação pela loja, evitando que um canal contorne os limites. Alterar perfil e limites é uma permissão administrativa; a edição de nome, contato ou endereço pela cliente não concede autorização para condicional.

Usar transações locais para estado e estoque. Chamadas de pagamento/transportadora ficam fora das transações longas, com operação registrada, idempotência e reconciliação posterior. Eventos de notificação devem ser persistidos para permitir reprocessamento sem duplicação.

Criar processamento periódico de prazos, notificações e reconciliação de pendências. O repositório já possui serviços de expiração, mas isso não substitui configurar e verificar a execução agendada. As reservas de condicional não entram no expirador de 30 minutos das compras comuns.

## 12. Etapas e critérios de entrega

| Etapa               | Entrega                                               | Critério para avançar                                               |
| ------------------- | ----------------------------------------------------- | ------------------------------------------------------------------- |
| 1. Regras           | Política comercial e estados aprovados                | Decisões da seção 14 respondidas                                    |
| 2. Fundação         | Modelo, migrações, alocações e serviços transacionais | Concorrência, conservação de estoque e isolamento aprovados         |
| 3. Operação interna | Solicitação, aprovação, separação, saída e painel     | Administrador acompanha todas as peças sem cobrança automática      |
| 4. Cliente e acerto | Conta, escolha e pagamento vinculado                  | Compra parcial correta, sem reserva/baixa duplicada                 |
| 5. Retorno          | Recebimento, conferência, divergências e encerramento | Nenhuma peça volta ao disponível antes da conferência               |
| 6. Homologação      | Fluxos completos, prazos e regressão da compra comum  | Critérios da seção 13 cumpridos; lançamento inicialmente desativado |

As etapas são marcos técnicos; a primeira versão só fica pronta para uso quando o ciclo completo de ida, decisão, pagamento e retorno estiver homologado. Não disponibilizar uma interface de solicitação sem o controle operacional correspondente.

## 13. Critérios de aceitação e testes essenciais

- Duas clientes disputando a última unidade: apenas uma aprovação consegue reservá-la.
- Cliente não avaliada, suspensa, não elegível ou com autorização vencida não recebe nova aprovação; suspensão também impede nova saída.
- Duas aprovações concorrentes para a mesma cliente não ultrapassam seus limites totais de valor, peças ou operações abertas.
- Validar tetos por solicitação e acumulados, inclusive unidades repetidas do mesmo SKU e valores exatamente no limite.
- Pagamentos e devoluções parciais liberam apenas a parcela efetivamente resolvida; intenção de devolver e recebimento sem conferência não liberam capacidade.
- Redução de limite abaixo da utilização preserva operações anteriores e impede novas aprovações; eventos repetidos não liberam saldo em duplicidade.
- Cliente não altera sua elegibilidade/limites, e o perfil de uma loja não concede capacidade em outra.
- Cinco peças enviadas, duas compradas e três devolvidas: venda de duas e reposição de três após conferência, sem duplicação de movimentações.
- Quantidades parciais da mesma variante são tratadas corretamente.
- Cliente fica com todas; cliente devolve todas; devolução e pagamento em ordens diferentes.
- Cancelamento antes da expedição libera a reserva exatamente uma vez.
- Prazo vence com mercadoria fora da loja: permanece indisponível e gera alerta.
- Declaração de devolução, rastreio de retorno ou estorno financeiro não repõem estoque sozinhos.
- Retorno parcial, tamanho/SKU diferente, avaria e extravio impedem encerramento indevido.
- Tentativa recusada, timeout, webhook repetido/fora de ordem e pagamento tardio não duplicam venda nem movimentação.
- Alterações de preço posteriores não mudam silenciosamente o acordo aprovado.
- Cliente ou administrador de outra loja não acessa nem altera a operação.
- Produtos desativados depois da remessa continuam rastreáveis pelos snapshots.
- Compra comum, cupons, pagamento, cancelamento e estoque atuais continuam funcionando.
- Revisão visual e acessibilidade em desktop e celular, com seleção, foco, resumos e estados de erro.

## 14. Decisões comerciais pendentes

| Decisão                                 | Proposta inicial para discussão                                                                                                                    |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Quem pode solicitar?                    | Cliente autenticada com perfil de condicional elegível, limites definidos e sem bloqueios; aprovação manual por solicitação                        |
| Quem aprova?                            | Administrador autorizado da loja                                                                                                                   |
| Limite por operação?                    | Quantidade, valor e número de condicionais abertos configuráveis; sem números fixados neste projeto                                                |
| Limites por cliente?                    | Requisito confirmado: tetos individuais de valor e unidades; proposta de controlar por operação e no total em aberto, respeitando os tetos da loja |
| Quem altera a elegibilidade e limites?  | Administrador autorizado, com motivo e histórico; valores concretos e validade ainda a definir                                                     |
| Prazo para experimentar?                | Configurável, contado do recebimento confirmado                                                                                                    |
| Pagamento/garantia?                     | Pagamento voluntário no acerto final; envio sem garantia somente se a loja aceitar esse risco                                                      |
| Frete de ida e volta?                   | Política obrigatória por loja, exibida e aceita antes da aprovação                                                                                 |
| Cliente não escolhe ou não devolve?     | Alertas e tratamento manual, sem cobrança automática ou reposição fictícia                                                                         |
| Escolha feita pode ser alterada?        | Não durante pagamento pendente; revisão auditada quando a tentativa anterior estiver resolvida                                                     |
| Descontos e cupons?                     | Preço/desconto por item fixado na aprovação; promoções de conjunto em evolução futura                                                              |
| Venda presencial e WhatsApp?            | Criação pelo administrador na primeira versão; autoatendimento pelo agente posteriormente                                                          |
| Documentação fiscal e condições de uso? | Validar com os responsáveis da loja antes da operação real; geração fiscal não está implementada neste projeto                                     |

## 15. Principais riscos e lançamento

Os maiores riscos são mercadoria indisponível sendo revendida, baixa de estoque duplicada ao pagar, reposição antes da conferência, pagamento incompatível com alterações de escolha e envio de mercadoria sem garantia de recebimento do valor.

A liberação deve começar com o recurso desativado por padrão, habilitação controlada para testes e reconciliação de estoque/valores. Desativar novas solicitações não pode impedir acompanhar, receber devoluções ou acertar condicionais já abertos. Migrações devem ser aditivas e preservar pedidos existentes.

Pré-autorização de cartão, cobrança automática, emissão de documentos e logística reversa automatizada exigem validações próprias antes de serem prometidas. Este documento não pressupõe aprovação dessas integrações nem altera as condições comerciais da loja.

## 16. Resultado desta análise

É viável aproveitar catálogo, autenticação, parte do estoque, cotação e pagamento. O trabalho principal é construir o controle de custódia e devolução e separar esses eventos da venda e do pagamento. A recomendação é desenvolver o ciclo completo com aprovação manual primeiro, deixando garantias financeiras e automações para uma evolução validada.

Este documento registra o projeto aprovado. A implementação posterior e suas condições operacionais estão descritas em [Operação do condicional](condicional-operacao.md).
