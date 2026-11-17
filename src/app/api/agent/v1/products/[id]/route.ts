import { authenticateAgent, agentError } from "@/lib/agent-api/auth";
import { prisma } from "@/lib/db/prisma";
import { mapProductDetail, productDetailInclude } from "@/modules/products/product.service";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { storeId } = await authenticateAgent(request);
    const { id } = await context.params;
    const product = await prisma.product.findFirst({
      where: { id, storeId, status: "ACTIVE" },
      include: productDetailInclude,
    });
    if (!product) return Response.json({ error: "Produto não encontrado." }, { status: 404 });
    return Response.json({ product: mapProductDetail(product) });
  } catch (error) {
    return agentError(error);
  }
}
