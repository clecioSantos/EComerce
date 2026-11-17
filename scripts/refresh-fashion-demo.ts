import "dotenv/config";

import { readFileSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { variantSignature } from "../src/modules/products/variant";

// Non-destructive demo collection import. NEVER run prisma/seed.ts on an existing store:
// that legacy seed invokes reset() and deletes orders, customers and other live data.
const raw = readFileSync(new URL("./catalogs/premium-fashion.json", import.meta.url), "utf8");
type CatalogProduct = {
  slug: string; name: string; category: string; price: number; color: string;
  material: string; gender: "feminino" | "masculino"; featured: boolean;
  photo: string; source: string; description: string;
};
const catalog = JSON.parse(raw) as {
  collection: string; disclaimer: string;
  categories: { slug: string; name: string; parent: string; position: number }[];
  colors: [string, string][]; materials: [string, string][];
  products: CatalogProduct[];
};
const apply = process.argv.includes("--apply");
const archiveLegacy = process.argv.includes("--archive-legacy");
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL must be configured");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

const oldDemo: Record<string, string> = {
  "camiseta-oversized": "Camiseta Oversized",
  "camiseta-basica": "Camiseta Básica",
  "calca-jeans": "Calça Jeans",
  "moletom": "Moletom",
  "jaqueta-corta-vento": "Jaqueta Corta-Vento",
  "notebook-pro-14": "Notebook Pro 14",
};

async function run() {
  if (!apply) {
    console.log(`Dry run: ${catalog.products.length} premium fashion demo products; ${catalog.products.filter(p => p.gender === "feminino").length} feminine. No database writes.`);
    console.log("Use --apply to insert demo catalog; append --archive-legacy to hide the old sample products.");
    return;
  }
  const store = await prisma.store.findUnique({ where: { id: "legacy-store" } });
  const clothing = await prisma.productType.findUnique({
    where: { slug: "roupas" }, include: { attributes: { include: { values: true } } },
  });
  if (!store || !clothing) throw new Error("Legacy store and clothing type must already exist. No changes made.");
  const female = await prisma.category.findUnique({ where: { slug: "feminino" } });
  const male = await prisma.category.findUnique({ where: { slug: "masculino" } });
  if (!female || !male) throw new Error("Expected existing Feminino and Masculino categories.");
  const brand = await prisma.brand.findUnique({ where: { slug: "atelier" } });

  const attr = (slug: string) => {
    const found = clothing.attributes.find(x => x.slug === slug);
    if (!found) throw new Error("Missing clothing attribute: " + slug);
    return found;
  };
  const color = attr("cor"), size = attr("tamanho");
  const material = attr("material"), gender = attr("genero");
  for (const [slug, value] of catalog.colors) {
    await prisma.productAttributeValue.upsert({
      where: { attributeId_slug: { attributeId: color.id, slug } },
      create: { attributeId: color.id, slug, value }, update: {},
    });
  }
  for (const [slug, value] of catalog.materials) {
    await prisma.productAttributeValue.upsert({
      where: { attributeId_slug: { attributeId: material.id, slug } },
      create: { attributeId: material.id, slug, value }, update: {},
    });
  }
  await prisma.category.update({ where: { id: female.id }, data: { parentId: null, position: 0, isActive: true } });
  await prisma.category.update({ where: { id: male.id }, data: { parentId: null, position: 1, isActive: true } });
  for (const item of catalog.categories) {
    const parentId = item.parent === "feminino" ? female.id : male.id;
    await prisma.category.upsert({
      where: { slug: item.slug },
      create: { name: item.name, slug: item.slug, parentId, position: item.position },
      update: { isActive: true },
    });
  }
  // Only deactivate obsolete root demo sections; retain rows and all past references.
  await prisma.category.updateMany({ where: { slug: { in: ["moda","eletronicos","notebooks","celulares"] } }, data: { isActive: false } });
  const valueId = async (attributeId: string, slug: string) => {
    const val = await prisma.productAttributeValue.findUnique({ where: { attributeId_slug: { attributeId, slug } } });
    if (!val) throw new Error(`Missing attribute value ${slug}`);
    return val.id;
  };
  let created = 0, skipped = 0;
  for (const item of catalog.products) {
    const existing = await prisma.product.findUnique({ where: { slug: item.slug } });
    if (existing) {
      // Never overwrite manually edited products or inventory.
      skipped++;
      continue;
    }
    const category = await prisma.category.findUniqueOrThrow({ where: { slug: item.category } });
    const colorValue = await valueId(color.id, item.color);
    const materialValue = await valueId(material.id, item.material);
    const genderValue = await valueId(gender.id, item.gender);
    const sizes = await Promise.all(["p","m","g","gg"].map(x=>valueId(size.id,x)));
    const product = await prisma.product.create({
      data: {
        storeId: store.id, name: item.name, slug: item.slug,
        status: "ACTIVE", productTypeId: clothing.id, categoryId: category.id,
        brandId: brand?.id ?? null, basePrice: item.price, isFeatured: item.featured,
        description: item.description + "\n\nProduto demonstrativo: foto ilustrativa, preço, materiais e estoque sujeitos a confirmação antes da venda.",
        shortDescription: item.description,
        metadata: { demoCollection: catalog.collection, illustrative: true, imageSource: "https://unsplash.com/photos/" + item.source },
        images: { create: [{
          url: `https://images.unsplash.com/photo-${item.photo}?auto=format&fit=crop&w=900&h=1100&q=82`,
          alt: "Imagem editorial ilustrativa de " + item.name, isPrimary: true, position: 0,
        }] },
        assignments: { create: [
          { attributeId: gender.id, attributeValueId: genderValue },
          { attributeId: material.id, attributeValueId: materialValue },
        ] },
      },
    });
    for (let i=0; i<sizes.length; i++) {
      const sizeValue = sizes[i];
      const v = await prisma.productVariant.create({
        data: {
          productId: product.id, sku: item.slug.toUpperCase() + "-" + ["P","M","G","GG"][i],
          signature: variantSignature([colorValue, sizeValue]), price: item.price, position: i,
          attributes: { create: [
            { attributeId: color.id, attributeValueId: colorValue },
            { attributeId: size.id, attributeValueId: sizeValue },
          ] },
          inventory: { create: { quantityOnHand: 8, reorderLevel: 2 } },
        },
        include: { inventory: true },
      });
      if(v.inventory) await prisma.inventoryMovement.create({ data: {
        inventoryId: v.inventory.id, variantId: v.id, type:"IN", quantity:8,
        reason: "Estoque demonstrativo da coleção " + catalog.collection,
      } });
    }
    created++;
  }
  let archived = 0;
  if (archiveLegacy) {
    const candidates = await prisma.product.findMany({
      where: { storeId: "legacy-store", status: "ACTIVE",
        OR: [{ slug: { in: Object.keys(oldDemo) } }, { slug: { startsWith: "itest_mp_" } }],
      },
      include: { images: true },
    });
    for (const product of candidates) {
      const isOldSeed = oldDemo[product.slug] === product.name &&
        product.images.some(i => i.url === `https://picsum.photos/seed/${product.slug}/800/800`);
      const isTestFixture = product.slug.startsWith("itest_mp_") && product.name.startsWith("itest_mp_");
      if (!isOldSeed && !isTestFixture) continue;
      await prisma.product.update({ where: { id: product.id }, data: { status: "ARCHIVED", isFeatured: false } });
      archived++;
    }
  }
  console.log(JSON.stringify({created, skipped, archived, total: catalog.products.length}));
}
run().catch(err => { console.error(err); process.exitCode=1; }).finally(async()=>{await prisma.$disconnect()});
