import Image from "next/image";
import Link from "next/link";

import { Price } from "@/components/shared/price";
import { Badge } from "@/components/ui/badge";
import type { ProductSummaryDTO } from "@/modules/products/types";

export function ProductCard({ product }: { product: ProductSummaryDTO }) {
  const hasDiscount =
    product.compareAtPrice != null && product.compareAtPrice > product.basePrice;

  return (
    <Link href={`/produtos/${product.slug}`} className="group block">
      <div className="bg-muted relative aspect-square overflow-hidden rounded-lg">
        {product.image ? (
          <Image
            src={product.image}
            alt={product.name}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="text-muted-foreground flex h-full items-center justify-center text-xs">
            Sem imagem
          </div>
        )}
        {hasDiscount ? (
          <Badge className="absolute top-2 left-2">Oferta</Badge>
        ) : null}
        {!product.inStock ? (
          <Badge variant="secondary" className="absolute top-2 right-2">
            Esgotado
          </Badge>
        ) : null}
      </div>
      <div className="space-y-1 pt-3">
        {product.categoryName ? (
          <p className="text-muted-foreground text-xs">{product.categoryName}</p>
        ) : null}
        <h3 className="line-clamp-2 text-sm font-medium">{product.name}</h3>
        <Price
          value={product.basePrice}
          compareAt={product.compareAtPrice}
          currency={product.currency}
          className="text-sm"
        />
      </div>
    </Link>
  );
}
