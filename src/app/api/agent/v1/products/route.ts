import { z } from "zod";
import { authenticateAgent, agentError } from "@/lib/agent-api/auth";
import { prisma } from "@/lib/db/prisma";
import { mapProductSummary, productSummaryInclude } from "@/modules/products/product.service";

const querySchema = z.object({
  q: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(30).default(10),
});

export async function GET(request: Request) {
  try {
    const { storeId } = await authenticateAgent(request);
    const params = new URL(request.url).searchParams;
    const parsed = querySchema.safeParse(Object.fromEntries(params));
    if (!parsed.success) return Response.json({ error: "Parâmetros inválidos." }, { status: 400 });

    const { q, limit } = parsed.data;
    const products = await prisma.product.findMany({
      where: {
        storeId,
        status: "ACTIVE",
        ...(q ? { OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { description: { contains: q, mode: "insensitive" as const } },
        ] } : {}),
      },
      include: productSummaryInclude,
      take: limit,
      orderBy: { createdAt: "desc" },
    });
    return Response.json({ products: products.map(mapProductSummary) });
  } catch (error) {
    return agentError(error);
  }
}
