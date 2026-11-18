import { z } from "zod";
import { authenticateAgent, agentError } from "@/lib/agent-api/auth";
import { prisma } from "@/lib/db/prisma";
import { mapProductSummary, productSummaryInclude } from "@/modules/products/product.service";

const querySchema = z.object({
  q: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(30).default(10),
});

const stopWords = new Set(["uma", "uns", "umas", "para", "com", "sem", "que",
  "quero", "queria", "gostaria", "procurando", "procuro", "voce",
  "tem", "vende", "loja", "favor", "preciso", "comprar", "alguma"]);

function searchTerms(text: string): string[] {
  return [...new Set(text.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR").split(/[^a-z0-9]+/)
    .filter(word => word.length > 2 && !stopWords.has(word)))].slice(0, 6);
}

export async function GET(request: Request) {
  try {
    const { storeId } = await authenticateAgent(request);
    const params = new URL(request.url).searchParams;
    const parsed = querySchema.safeParse(Object.fromEntries(params));
    if (!parsed.success) return Response.json({ error: "Parâmetros inválidos." }, { status: 400 });

    const { q, limit } = parsed.data;
    const terms = q ? searchTerms(q) : [];
    const products = await prisma.product.findMany({
      where: {
        storeId,
        status: "ACTIVE",
        ...(terms.length ? { OR: terms.flatMap(term => [
          { name: { contains: term, mode: "insensitive" as const } },
          { description: { contains: term, mode: "insensitive" as const } },
          { shortDescription: { contains: term, mode: "insensitive" as const } },
          { category: { is: { name: { contains: term, mode: "insensitive" as const } } } },
          { productType: { is: { name: { contains: term, mode: "insensitive" as const } } } },
        ]) } : q ? { OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { description: { contains: q, mode: "insensitive" as const } },
        ] } : {}),
      },
      include: productSummaryInclude,
      take: terms.length ? 60 : limit,
      orderBy: { createdAt: "desc" },
    });
    const scored = products.map(product => {
      const searchable = [product.name, product.shortDescription ?? "", product.description ?? "",
        product.category?.name ?? "", product.productType.name].join(" ")
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
      return { product, score: terms.reduce((score, term) => score + (searchable.includes(term) ? 1 : 0), 0) };
    }).sort((a, b) => b.score - a.score || b.product.createdAt.getTime() - a.product.createdAt.getTime());
    return Response.json({ products: scored.slice(0, limit).map(({product}) => mapProductSummary(product)) });
  } catch (error) {
    return agentError(error);
  }
}
