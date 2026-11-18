# Prévia de produtos no WhatsApp

## Diagnóstico em 18/11/2026

O banco armazena URLs em `product_images.url`, e não os bytes das fotos. A foto principal é selecionada por `isPrimary`, com alternativa por `position`. O catálogo demonstrativo usa imagens Unsplash e as identifica como ilustrativas; esta correção utiliza exatamente a foto cadastrada, sem substituir o catálogo ou inventar fotos.

A `main` já tinha metadados absolutos e `preview_url: true`. Na URL de exemplo, `facebookexternalhit/1.1` e `WhatsApp/2.24.0` receberam HTTP 200, sem redirecionamento, com Open Graph no HTML. A imagem externa respondeu HTTP 200 `image/jpeg`, 216.307 bytes. Esses resultados não comprovam que a Meta consiga acessar a imagem a partir de sua infraestrutura nem que o cartão visual funcione.

`meta-externalagent/1.1` recebeu HTTP 429 com corpo vazio, `Server: hcdn`, `platform: hostinger` e `x-hcdn-request-id: 0bdf6bf5fd7bdb26f6e1785dfc27c99c-asc-edge13` (17:30 UTC). A aplicação não contém regra de rate limit equivalente. Isso é evidência de restrição na camada de hospedagem/CDN para essa solicitação, não prova de que todos os IPs da Meta estejam bloqueados. Não foi possível inspecionar a configuração do hPanel com as ferramentas/credenciais disponíveis.

O robots.txt permite páginas de produtos, imagens estáticas e `/media/`; bloqueia `/api`, razão pela qual a nova rota de imagens fica fora de `/api`. O proxy só exige login em `/admin` e `/conta`. Não foram observados redirecionamentos de autenticação para o produto. Acessibilidade no navegador isoladamente não foi usada como critério de sucesso.

## Correção

- O Open Graph e o Twitter usam a rota absoluta HTTPS `/media/products/[slug]/preview.jpg` da loja. O nome, a descrição e a URL canônica vêm do produto. Sem foto, não é anunciada uma imagem fictícia.
- O Next.js entrega os metadados no `<head>` inicial para qualquer user-agent (`htmlLimitedBots: /.*/`). Isso pode atrasar o primeiro byte pelo tempo da consulta dos metadados, evitando depender de streaming/JavaScript.
- A rota pública consulta somente produtos ativos, seleciona a foto principal e converte os bytes reais em JPEG 1200×1200 com contenção e fundo branco. Páginas públicas também deixam de exibir produtos inativos.
- Não há parâmetro de URL remota. Arquivos relativos são lidos somente dentro de `public`, com verificação de caminho real/symlinks, extensão e decodificação raster. URLs privadas e serviços internos não são buscados.
- Provedores externos permitidos são os já usados pela loja: `images.unsplash.com`, `picsum.photos`, `fastly.picsum.photos` e `placehold.co`. Credenciais, portas alternativas, esquemas inseguros e redirecionamentos para outros hosts são recusados. Um novo provedor exige revisão explícita dessa lista.
- Até três redirecionamentos, timeout de 10 segundos, entrada máxima de 8 MiB/16 milhões de pixels, saída JPEG abaixo de 5 MiB. Cache em memória limitado a 24 imagens por uma hora e duas conversões simultâneas; HTTP cache por cinco minutos. Mudanças de foto podem levar esses intervalos para aparecer. Reiniciar o processo esvazia o cache; a primeira carga ainda requer a origem cadastrada disponível para o servidor. Falhas retornam 503 sem expor URLs ou erros internos.
- `sharp` já era dependência do Next.js; agora é declarado diretamente para a conversão e os testes, sem introduzir outra biblioteca de imagens.
- Os links do agente passam pela validação do domínio HTTPS da loja, apontam diretamente para `/produtos/[slug]` e respeitam três produtos no total mesmo com várias chamadas de ferramentas. O envio continua sendo mensagem de texto com `preview_url: true`, uma por produto, sem anexos de imagem.

## Validação

Executados com sucesso: typecheck da loja e do agente, 242 testes da loja (26 arquivos), 14 testes do agente e build de produção. Os testes novos cobrem metadados de fontes externas/relativas, produto sem foto, rota pública, seleção principal, JPEG/dimensões/tamanho, erros de origem e prevenção de SSRF. O lint dos arquivos novos e da página/configuração alterada passou.

O lint global tem cinco erros anteriores a esta branch: três `no-explicit-any` em `agent-service/src/gemini.test.ts`, um em `meta-signup.ts` e `set-state-in-effect` em `src/components/admin/agent-manager.tsx`. Foram reproduzidos usando os arquivos originais da `main` via `git show HEAD:... | eslint --stdin`. Não foram incluídas alterações alheias para ocultar esses problemas.

No build de produção local, usando o produto real e somente leituras do banco, os quatro user-agents (Facebook, WhatsApp, Meta e navegador) receberam HTTP 200, metadados completos no `<head>` e JPEG de 221.367 bytes/1200×1200 servido pela rota da loja. O worker de mensagens não foi iniciado. Nenhuma mensagem real foi enviada.

Para repetir em um build local com a URL canônica da produção:

```sh
node scripts/verify-product-preview.mjs http://localhost:3100 demo-vestido-midi-aurora https://loja.boradedelivery.com
```

Após publicar, executar:

```sh
node scripts/verify-product-preview.mjs https://loja.boradedelivery.com demo-vestido-midi-aurora
```

Testes de integração transacionais e E2E de checkout existentes criam e apagam registros e exigem catálogo semeado. Não foram executados contra o banco conectado; é necessário PostgreSQL isolado para executá-los sem afetar dados da loja. Não foram executados seed, migrações, alteração de credenciais ou operações destrutivas.

## Verificações externas pendentes

1. No hPanel/CDN, investigar o HTTP 429 pelo request ID acima e permitir o acesso público dos crawlers legítimos da Meta às páginas `/produtos/*` e às imagens `/media/products/*`, sem remover a proteção das áreas privadas. As ferramentas disponíveis não permitem editar essas regras.
2. Publicar a branch aprovada e repetir o verificador HTTP contra a URL real; confirmar o novo `og:image` no domínio da loja. Metadados do HTML antigo em produção não validam a implementação nova.
3. Pedir nova coleta no depurador da Meta e compartilhar o link pelo agente com uma conta de teste autorizada. Confirmar foto, nome, descrição e abertura da página tocando no cartão. A Meta pode manter cache do cartão anterior.

A prévia visual NÃO foi confirmada no WhatsApp nem no depurador da Meta. O HTTP 429 externo e o lint global impedem afirmar que todas as verificações passaram; o merge automático fica pendente enquanto essas condições não forem resolvidas.
