# V1 — Vitrine moderna e identidade configurável

## O que mudou
- Home comercial genérica com hero, categorias, destaques e novidades; removidas as seções demonstrativas de arquitetura da página pública.
- Cabeçalho e rodapé utilizam nome, logo e frase configuráveis.
- Cores principais da vitrine via tokens CSS por loja e cantos discretamente arredondados.
- Menu **Administração → Configurações → Identidade visual**: nome, frase, URL HTTPS para logo e cores principal/destaque.
- Título e metadados da vitrine vinculados ao nome comercial.
- Estrutura de dados `stores` guarda a identidade por estabelecimento, sem duplicar o aplicativo.

## Como testar quando retomar os testes
1. Aplicar migrações Prisma em um banco de desenvolvimento (`npm run db:deploy`).
2. Abrir `/admin/configuracoes` como administrador.
3. Salvar nome, frase, cores e URL HTTPS de uma logo.
4. Acessar `/`, `/produtos`, `/carrinho`, `/checkout` e testar responsividade e acessibilidade em desktop e celular.
5. Conferir que busca, carrinho, checkout, promoções e administração continuam funcionando.

## Limites da V1
O storefront existente ainda serve a loja de id `legacy-store`. O modelo `Store` já tem campos de identidade independentes por loja, mas **seleção da loja por domínio, isolamento completo do checkout e painel por tenant ainda não estão implementados**. Não habilite várias lojas reais nesse mesmo storefront antes de completar o isolamento comercial.

Logo é configurado como URL HTTPS (não há upload de arquivo na V1). A identidade visual é aplicada somente à loja pública atual; painel administrativo mantém identidade neutra.

**Validação:** testes de compilação, integração, regressão visual e navegação real não foram executados nesta entrega, conforme solicitação de adiá-los. A branch deve ser validada em ambiente de desenvolvimento antes de uso comercial.
