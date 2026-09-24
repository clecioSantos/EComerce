import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

interface PriceProps {
  value: number;
  compareAt?: number | null;
  currency?: string;
  className?: string;
}

export function Price({ value, compareAt, currency = "BRL", className }: PriceProps) {
  const hasDiscount = compareAt != null && compareAt > value;
  return (
    <span className={cn("flex items-baseline gap-2", className)}>
      <span className="font-semibold">{formatCurrency(value, currency)}</span>
      {hasDiscount ? (
        <span className="text-muted-foreground text-sm line-through">
          {formatCurrency(compareAt, currency)}
        </span>
      ) : null}
    </span>
  );
}
