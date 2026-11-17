import Image from "next/image";
import Link from "next/link";

import { Price } from "@/components/shared/price";
import { Badge } from "@/components/ui/badge";
import type { ProductSummaryDTO } from "@/modules/products/types";

export function ProductCard({ product }: { product: ProductSummaryDTO }) {
  const hasDiscount =
    product.compareAtPrice != null && product.compareAtPrice > product.basePrice;

  return (
    <Link href={`/produtos/${product.slug}`} className="group block rounded-xl outline-offset-4 focus-visible:outline-2 focus-visible:outline-primary">
      <div className="bg-muted relative aspect-square overflow-hidden rounded-xl border border-primary/10 transition-colors group-hover:border-primary/40">
        {product.image ? (
          <Image
            src={product.image}
            alt={product.name}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.035]"
          />
        ) : (
          <div className="text-muted-foreground flex h-full items-center justify-center text-xs">
            Sem imagem
          </div>
        )}
        {hasDiscount ? (
          <Badge className="absolute top-3 left-3 border-0 bg-[var(--brand-accent)] font-bold text-[var(--brand-accent-foreground)]">Oferta</Badge>
        ) : null}
        {!product.inStock ? (
          <Badge variant="secondary" className="absolute top-2 right-2">
            Esgotado
          </Badge>
        ) : null}
      </div>
      <div className="space-y-1.5 border-b-2 border-transparent pt-3 pb-3 transition-colors group-hover:border-primary">
        {product.categoryName ? (
          <p className="text-muted-foreground text-xs">{product.categoryName}</p>
        ) : null}
        <h3 className="line-clamp-2 text-sm font-semibold transition-colors group-hover:text-primary">{product.name}</h3>
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
