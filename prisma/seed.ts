import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { variantSignature } from "../src/modules/products/variant";
import { hashSync } from "bcryptjs";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL não definida. Copie .env.example para .env.");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

function imageUrl(seed: string) {
  return `https://picsum.photos/seed/${seed}/800/800`;
}

async function reset() {
  await prisma.couponUsage.deleteMany();
  await prisma.paymentTransaction.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.inventoryMovement.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.productVariantAttribute.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.productImage.deleteMany();
  await prisma.productAttributeAssignment.deleteMany();
  await prisma.product.deleteMany();
  await prisma.productAttributeValue.deleteMany();
  await prisma.productAttribute.deleteMany();
  await prisma.productType.deleteMany();
  await prisma.review.deleteMany();
  await prisma.promotion.deleteMany();
  await prisma.coupon.deleteMany();
  await prisma.category.deleteMany();
  await prisma.brand.deleteMany();
  await prisma.address.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();
}

async function seedUsers() {
  const admin = await prisma.user.create({
    data: {
      name: "Administrador",
      email: "admin@ecommerce.local",
      passwordHash: hashSync("admin12345", 10),
      role: "ADMIN",
    },
  });

  const customer = await prisma.user.create({
    data: {
      name: "Cliente Exemplo",
      email: "cliente@ecommerce.local",
      passwordHash: hashSync("cliente12345", 10),
      role: "CUSTOMER",
      addresses: {
        create: {
          recipient: "Cliente Exemplo",
          line1: "Rua das Flores, 123",
          city: "São Paulo",
          state: "SP",
          postalCode: "01000-000",
          isDefault: true,
        },
      },
    },
  });

  return { admin, customer };
}

async function seedCategories() {
  const fashion = await prisma.category.create({
    data: { name: "Moda", slug: "moda", position: 0 },
  });
  const male = await prisma.category.create({
    data: { name: "Masculino", slug: "masculino", parentId: fashion.id, position: 0 },
  });
  const female = await prisma.category.create({
    data: { name: "Feminino", slug: "feminino", parentId: fashion.id, position: 1 },
  });

  const tshirts = await prisma.category.create({
    data: { name: "Camisetas", slug: "camisetas", parentId: male.id, position: 0 },
  });
  const pants = await prisma.category.create({
    data: { name: "Calças", slug: "calcas", parentId: male.id, position: 1 },
  });
  const dresses = await prisma.category.create({
    data: { name: "Vestidos", slug: "vestidos", parentId: female.id, position: 0 },
  });
  await prisma.category.create({
    data: { name: "Blusas", slug: "blusas", parentId: female.id, position: 1 },
  });

  const electronics = await prisma.category.create({
    data: { name: "Eletrônicos", slug: "eletronicos", position: 1 },
  });
  const phones = await prisma.category.create({
    data: { name: "Celulares", slug: "celulares", parentId: electronics.id, position: 0 },
  });
  const notebooks = await prisma.category.create({
    data: { name: "Notebooks", slug: "notebooks", parentId: electronics.id, position: 1 },
  });

  return { fashion, male, female, tshirts, pants, dresses, electronics, phones, notebooks };
}

async function seedClothingType() {
  return prisma.productType.create({
    data: {
      name: "Roupas",
      slug: "roupas",
      description: "Vestuário em geral — atributos e variantes genéricos.",
      icon: "shirt",
      attributes: {
        create: [
          {
            name: "Cor",
            slug: "cor",
            type: "SELECT",
            isRequired: true,
            isFilterable: true,
            isVariantDefining: true,
            position: 0,
            values: {
              create: [
                { value: "Preto", slug: "preto", position: 0 },
                { value: "Branco", slug: "branco", position: 1 },
                { value: "Azul", slug: "azul", position: 2 },
              ],
            },
          },
          {
            name: "Tamanho",
            slug: "tamanho",
            type: "SELECT",
            isRequired: true,
            isFilterable: true,
            isVariantDefining: true,
            position: 1,
            values: {
              create: [
                { value: "P", slug: "p", position: 0 },
                { value: "M", slug: "m", position: 1 },
                { value: "G", slug: "g", position: 2 },
                { value: "GG", slug: "gg", position: 3 },
              ],
            },
          },
          {
            name: "Gênero",
            slug: "genero",
            type: "SELECT",
            isFilterable: true,
            position: 2,
            values: {
              create: [
                { value: "Unissex", slug: "unissex" },
                { value: "Masculino", slug: "masculino" },
                { value: "Feminino", slug: "feminino" },
              ],
            },
          },
          {
            name: "Material",
            slug: "material",
            type: "SELECT",
            isFilterable: true,
            position: 3,
            values: {
              create: [
                { value: "Algodão", slug: "algodao" },
                { value: "Poliéster", slug: "poliester" },
                { value: "Jeans", slug: "jeans" },
              ],
            },
          },
        ],
      },
    },
    include: { attributes: { include: { values: true } } },
  });
}

async function seedElectronicsType() {
  return prisma.productType.create({
    data: {
      name: "Eletrônicos",
      slug: "eletronicos",
      description: "Notebooks, celulares e afins.",
      icon: "cpu",
      attributes: {
        create: [
          {
            name: "RAM",
            slug: "ram",
            type: "SELECT",
            isRequired: true,
            isFilterable: true,
            isVariantDefining: true,
            position: 0,
            values: {
              create: [
                { value: "8GB", slug: "8gb" },
                { value: "16GB", slug: "16gb" },
                { value: "32GB", slug: "32gb" },
              ],
            },
          },
          {
            name: "Armazenamento",
            slug: "armazenamento",
            type: "SELECT",
            isRequired: true,
            isFilterable: true,
            isVariantDefining: true,
            position: 1,
            values: {
              create: [
                { value: "256GB", slug: "256gb" },
                { value: "512GB", slug: "512gb" },
                { value: "1TB", slug: "1tb" },
              ],
            },
          },
          {
            name: "Cor",
            slug: "cor",
            type: "SELECT",
            isFilterable: true,
            isVariantDefining: true,
            position: 2,
            values: {
              create: [
                { value: "Prata", slug: "prata" },
                { value: "Grafite", slug: "grafite" },
              ],
            },
          },
          {
            name: "Voltagem",
            slug: "voltagem",
            type: "SELECT",
            isFilterable: true,
            position: 3,
            values: {
              create: [
                { value: "110V", slug: "110v" },
                { value: "220V", slug: "220v" },
                { value: "Bivolt", slug: "bivolt" },
              ],
            },
          },
        ],
      },
    },
    include: { attributes: { include: { values: true } } },
  });
}

async function seedFoodType() {
  return prisma.productType.create({
    data: {
      name: "Alimentos",
      slug: "alimentos",
      description: "Produtos alimentícios em geral.",
      icon: "apple",
      attributes: {
        create: [
          {
            name: "Peso",
            slug: "peso",
            type: "SELECT",
            isFilterable: true,
            isVariantDefining: true,
            position: 0,
            values: {
              create: [
                { value: "100g", slug: "100g" },
                { value: "500g", slug: "500g" },
                { value: "1kg", slug: "1kg" },
              ],
            },
          },
          {
            name: "Sabor",
            slug: "sabor",
            type: "SELECT",
            isFilterable: true,
            isVariantDefining: true,
            position: 1,
            values: {
              create: [
                { value: "Chocolate", slug: "chocolate" },
                { value: "Baunilha", slug: "baunilha" },
              ],
            },
          },
          {
            name: "Embalagem",
            slug: "embalagem",
            type: "SELECT",
            position: 2,
            values: {
              create: [
                { value: "Caixa", slug: "caixa" },
                { value: "Pote", slug: "pote" },
              ],
            },
          },
        ],
      },
    },
    include: { attributes: { include: { values: true } } },
  });
}

type AttributeValueMap = Map<string, { attributeId: string; id: string }>;

function buildValueMap(
  type: { attributes: { id: string; slug: string; values: { id: string; slug: string }[] }[] },
): Map<string, AttributeValueMap> {
  const byAttribute = new Map<string, AttributeValueMap>();
  for (const attribute of type.attributes) {
    const valueMap: AttributeValueMap = new Map();
    for (const value of attribute.values) {
      valueMap.set(value.slug, { attributeId: attribute.id, id: value.id });
    }
    byAttribute.set(attribute.slug, valueMap);
  }
  return byAttribute;
}

async function createVariant(params: {
  productId: string;
  sku: string;
  price: number;
  compareAtPrice?: number;
  position: number;
  stock: number;
  values: { attributeId: string; attributeValueId: string }[];
}) {
  const variant = await prisma.productVariant.create({
    data: {
      productId: params.productId,
      sku: params.sku,
      signature: variantSignature(
        params.values.map((value) => value.attributeValueId),
      ),
      price: params.price,
      compareAtPrice: params.compareAtPrice ?? null,
      position: params.position,
      attributes: { create: params.values },
      inventory: {
        create: {
          quantityOnHand: params.stock,
          reorderLevel: 3,
        },
      },
    },
    include: { inventory: true },
  });

  if (variant.inventory && params.stock > 0) {
    await prisma.inventoryMovement.create({
      data: {
        inventoryId: variant.inventory.id,
        variantId: variant.id,
        type: "IN",
        quantity: params.stock,
        reason: "Carga inicial (seed)",
      },
    });
  }

  return variant;
}

async function main() {
  console.log("Limpando dados existentes...");
  await reset();

  console.log("Criando usuários...");
  const { admin } = await seedUsers();

  console.log("Criando categorias...");
  const categories = await seedCategories();

  const brandAtelier = await prisma.brand.create({
    data: { name: "Atelier", slug: "atelier" },
  });
  const brandTech = await prisma.brand.create({
    data: { name: "TechOne", slug: "techone" },
  });

  console.log("Criando tipos de produto...");
  const clothing = await seedClothingType();
  const electronics = await seedElectronicsType();
  await seedFoodType();

  const clothingValues = buildValueMap(clothing);
  const electronicsValues = buildValueMap(electronics);

  const color = (slug: string) => clothingValues.get("cor")!.get(slug)!;
  const size = (slug: string) => clothingValues.get("tamanho")!.get(slug)!;

  console.log("Criando produtos de vestuário...");

  type ClothingProduct = {
    name: string;
    slug: string;
    price: number;
    compareAtPrice?: number;
    categoryId: string;
    featured?: boolean;
    material: string;
    gender: string;
    description: string;
    colors: string[];
    sizes: string[];
  };

  const clothingProducts: ClothingProduct[] = [
    {
      name: "Camiseta Oversized",
      slug: "camiseta-oversized",
      price: 129.9,
      compareAtPrice: 159.9,
      categoryId: categories.tshirts.id,
      featured: true,
      material: "algodao",
      gender: "unissex",
      description: "Camiseta oversized em algodão de alta gramatura.",
      colors: ["preto", "branco"],
      sizes: ["p", "m", "g"],
    },
    {
      name: "Camiseta Básica",
      slug: "camiseta-basica",
      price: 79.9,
      categoryId: categories.tshirts.id,
      material: "algodao",
      gender: "unissex",
      description: "Camiseta básica de algodão, caimento regular.",
      colors: ["branco", "azul"],
      sizes: ["p", "m", "g", "gg"],
    },
    {
      name: "Calça Jeans",
      slug: "calca-jeans",
      price: 219.9,
      categoryId: categories.pants.id,
      featured: true,
      material: "jeans",
      gender: "masculino",
      description: "Calça jeans de corte reto com elastano.",
      colors: ["azul"],
      sizes: ["p", "m", "g"],
    },
    {
      name: "Moletom",
      slug: "moletom",
      price: 189.9,
      categoryId: categories.pants.id,
      material: "poliester",
      gender: "unissex",
      description: "Moletom com capuz, forro felpado.",
      colors: ["preto", "azul"],
      sizes: ["m", "g", "gg"],
    },
    {
      name: "Jaqueta Corta-Vento",
      slug: "jaqueta-corta-vento",
      price: 279.9,
      compareAtPrice: 349.9,
      categoryId: categories.pants.id,
      material: "poliester",
      gender: "masculino",
      description: "Jaqueta corta-vento leve e impermeável.",
      colors: ["preto"],
      sizes: ["m", "g"],
    },
  ];

  for (const item of clothingProducts) {
    const product = await prisma.product.create({
      data: {
        name: item.name,
        slug: item.slug,
        description: item.description,
        shortDescription: item.description.slice(0, 120),
        status: "ACTIVE",
        productTypeId: clothing.id,
        categoryId: item.categoryId,
        brandId: brandAtelier.id,
        basePrice: item.price,
        compareAtPrice: item.compareAtPrice ?? null,
        isFeatured: item.featured ?? false,
        images: {
          create: [
            {
              url: imageUrl(item.slug),
              alt: item.name,
              position: 0,
              isPrimary: true,
            },
          ],
        },
        assignments: {
          create: [
            {
              attributeId: clothingValues.get("material")!.get(item.material)!.attributeId,
              attributeValueId: clothingValues.get("material")!.get(item.material)!.id,
            },
            {
              attributeId: clothingValues.get("genero")!.get(item.gender)!.attributeId,
              attributeValueId: clothingValues.get("genero")!.get(item.gender)!.id,
            },
          ],
        },
      },
    });

    let position = 0;
    for (const colorSlug of item.colors) {
      for (const sizeSlug of item.sizes) {
        await createVariant({
          productId: product.id,
          sku: `${item.slug.toUpperCase().replace(/-/g, "")}-${colorSlug}-${sizeSlug}`.toUpperCase(),
          price: item.price,
          compareAtPrice: item.compareAtPrice,
          position: position++,
          stock: 10 + position,
          values: [
            { attributeId: color(colorSlug).attributeId, attributeValueId: color(colorSlug).id },
            { attributeId: size(sizeSlug).attributeId, attributeValueId: size(sizeSlug).id },
          ],
        });
      }
    }
  }

  console.log("Criando produto eletrônico (prova de desacoplamento)...");
  const ram = (slug: string) => electronicsValues.get("ram")!.get(slug)!;
  const storage = (slug: string) => electronicsValues.get("armazenamento")!.get(slug)!;
  const eColor = (slug: string) => electronicsValues.get("cor")!.get(slug)!;

  const notebook = await prisma.product.create({
    data: {
      name: "Notebook Pro 14",
      slug: "notebook-pro-14",
      description:
        "Notebook com atributos genéricos de RAM e armazenamento — sem nenhuma regra de vestuário.",
      status: "ACTIVE",
      productTypeId: electronics.id,
      categoryId: categories.notebooks.id,
      brandId: brandTech.id,
      basePrice: 4599.0,
      compareAtPrice: 5299.0,
      isFeatured: true,
      images: {
        create: [
          {
            url: imageUrl("notebook-pro-14"),
            alt: "Notebook Pro 14",
            position: 0,
            isPrimary: true,
          },
        ],
      },
      assignments: {
        create: [
          {
            attributeId: electronicsValues.get("voltagem")!.get("bivolt")!.attributeId,
            attributeValueId: electronicsValues.get("voltagem")!.get("bivolt")!.id,
          },
        ],
      },
    },
  });

  const notebookVariants = [
    { ram: "8gb", storage: "256gb", price: 4599.0 },
    { ram: "16gb", storage: "512gb", price: 5799.0 },
    { ram: "16gb", storage: "1tb", price: 6799.0 },
  ];

  let notebookPosition = 0;
  for (const variant of notebookVariants) {
    const ramValue = ram(variant.ram);
    const storageValue = storage(variant.storage);
    await createVariant({
      productId: notebook.id,
      sku: `NOTEBOOK-PRO14-${variant.ram.toUpperCase()}-${variant.storage.toUpperCase()}`,
      price: variant.price,
      compareAtPrice: 5299.0,
      position: notebookPosition++,
      stock: 5 + notebookPosition,
      values: [
        { attributeId: ramValue.attributeId, attributeValueId: ramValue.id },
        { attributeId: storageValue.attributeId, attributeValueId: storageValue.id },
        { attributeId: eColor("prata").attributeId, attributeValueId: eColor("prata").id },
      ],
    });
  }

  console.log("Criando promoções e cupons...");
  await prisma.promotion.create({
    data: {
      name: "10% acima de R$ 300",
      type: "PERCENTAGE",
      value: 10,
      scope: "CART",
      minSubtotal: 300,
      isActive: true,
      stackable: true,
      priority: 10,
    },
  });

  await prisma.promotion.create({
    data: {
      name: "Frete grátis acima de R$ 199",
      type: "FREE_SHIPPING",
      value: 0,
      scope: "CART",
      minSubtotal: 199,
      isActive: true,
      stackable: true,
      priority: 20,
    },
  });

  await prisma.coupon.create({
    data: {
      code: "BEMVINDO10",
      description: "10% de desconto para novos clientes",
      type: "PERCENTAGE",
      value: 10,
      minSubtotal: 100,
      maxUses: 1000,
      maxUsesPerUser: 1,
      isActive: true,
    },
  });

  await prisma.coupon.create({
    data: {
      code: "FRETEZERO",
      description: "Frete grátis",
      type: "FREE_SHIPPING",
      value: 0,
      isActive: true,
    },
  });

  console.log("Criando avaliações de exemplo...");
  const camisetaOversized = await prisma.product.findUnique({
    where: { slug: "camiseta-oversized" },
  });
  if (camisetaOversized) {
    await prisma.review.create({
      data: {
        productId: camisetaOversized.id,
        authorName: "Ana Souza",
        rating: 5,
        title: "Excelente qualidade",
        comment: "Tecido muito bom e caimento perfeito.",
        status: "APPROVED",
      },
    });
  }

  console.log("\nSeed concluído com sucesso!");
  console.log("Admin:    admin@ecommerce.local / admin12345");
  console.log("Cliente:  cliente@ecommerce.local / cliente12345");
  console.log(`Admin id: ${admin.id}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
