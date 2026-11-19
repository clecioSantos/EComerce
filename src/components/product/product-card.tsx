import Image from "next/image";
import Link from "next/link";

import { Price } from "@/components/shared/price";
import { Badge } from "@/components/ui/badge";
import type { ProductSummaryDTO } from "@/modules/products/types";

export function ProductCard({ product }: { product: ProductSummaryDTO }) {
  const hasDiscount =
    product.compareAtPrice != null && product.compareAtPrice > product.basePrice;

  return (
    <Link
      href={`/produtos/${product.slug}`}
      className="group focus-visible:outline-primary block rounded-xl outline-offset-4 focus-visible:outline-2"
    >
      <div className="bg-muted relative aspect-[3/4] overflow-hidden">
        {product.image ? (
          <Image
            src={product.image}
            alt={product.name}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            className="object-cover transition-transform duration-500 motion-safe:group-hover:scale-[1.035]"
          />
        ) : (
          <div className="text-muted-foreground flex h-full items-center justify-center text-xs">
            Sem imagem
          </div>
        )}
        {hasDiscount ? (
          <Badge className="absolute top-3 left-3 border-0 bg-[var(--brand-accent)] font-bold text-[var(--brand-accent-foreground)]">
            Oferta
          </Badge>
        ) : null}
        {!product.inStock ? (
          <Badge variant="secondary" className="absolute top-2 right-2">
            Esgotado
          </Badge>
        ) : null}
      </div>
      <div className="space-y-2 pt-4 pb-3">
        {product.categoryName ? (
          <p className="text-muted-foreground text-xs">{product.categoryName}</p>
        ) : null}
        <h3 className="group-hover:text-primary line-clamp-2 text-sm font-semibold transition-colors">
          {product.name}
        </h3>
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
