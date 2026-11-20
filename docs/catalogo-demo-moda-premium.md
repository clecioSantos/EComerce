# Catálogo demonstrativo de moda premium

## O que foi alterado

- Coleção: `premium-fashion-v1`, com 16 peças de exemplo (12 femininas, 4 masculinas).
- Destaques: 8 peças femininas, priorizando vestidos e alfaiataria.
- Faixa sugerida: R$ 329,90 a R$ 1.299,90.
- Categorias principais na vitrine: Feminino e Masculino, com subdivisões para vestidos, blusas, saias, tricôs, alfaiataria, camisas e casacos.
- Fotos editoriais gratuitas licenciadas no Unsplash, referenciadas pelo identificador e URL da foto. **As fotos são ilustrativas**; podem não corresponder exatamente ao produto fictício.
- Preços, estoque, material e variantes são dados de demonstração, não uma confirmação de que peças estejam fisicamente disponíveis.

## Base existente

A carga executada na loja de teste arquivou os seis produtos legados específicos com imagens Picsum e dois registros de teste `itest_mp_`, preservando seus IDs, vínculos históricos, pedidos, itens de carrinho e avaliações.

Não apague produtos nem reexecute o seed geral: `prisma/seed.ts` faz reset destrutivo e agora exige confirmação explícita por variável de ambiente. O script seguro é o abaixo.

## Reaplicação controlada

O importador é idempotente por slug. Produtos da coleção já existentes são ignorados para não sobrescrever alterações de preço, estoque ou fotografia feitas por lojistas.

Visualizar operação sem gravar:

```bash
npm run catalog:fashion-demo
```

Aplicar apenas itens ausentes (apenas no banco conectado em `DATABASE_URL`):

```bash
npm run catalog:fashion-demo -- --apply
```

Arquivar os antigos exemplos identificáveis:

```bash
npm run catalog:fashion-demo -- --apply --archive-legacy
```

**Não confundir catálogo fictício com inventário comercial.** Antes de disponibilizar para compras reais, substitua imagens pelos itens efetivos, confirme composição e disponibilidade, ajuste preços e estoque e desative produtos de exemplo não vendidos.

## Alterar a aparência comercial

As categorias e o acervo continuam usando o motor genérico do EComerce. Uma próxima loja pode cadastrar outros itens e tipos sem mudar o código. Para customizar o nome, logo e cores, acesse Administração > Configurações > Identidade visual.

## Dados de envio para testes

O script `node scripts/fill-fashion-demo-logistics.mjs` mostra uma prévia de preenchimento de pesos e embalagens estimados. Use `--apply` para aplicar somente aos produtos ativos da coleção `premium-fashion-v1` na loja de demonstração, sem substituir campos já preenchidos. Um snapshot anterior é salvo em `artifacts/shipping-demo/`, e as variantes recebem a marca `shippingDemoEstimate.testOnly` nos metadados.

As estimativas variam de 0,3 a 1,2 kg, com embalagens de 30 × 25 a 35 × 30 cm e alturas de 4 a 10 cm. Servem exclusivamente para testar a integração de frete. Substitua pelas medidas e pesos reais dos produtos embalados antes de realizar vendas ou emitir etiquetas.
