import type { CSSProperties } from "react";
import { getStoreAppearance } from "@/modules/settings/appearance";
import { StoreFooter } from "@/components/layout/store-footer";
import { StoreHeader } from "@/components/layout/store-header";
import { getCurrentUser } from "@/lib/auth/dal";
import { getCartDTO } from "@/modules/cart/cart.service";

export const dynamic = "force-dynamic";

export default async function StoreLayout({ children }: LayoutProps<"/">) {
  const [currentUser, appearance] = await Promise.all([getCurrentUser(), getStoreAppearance()]);
  const cart = await getCartDTO(currentUser?.id);
  const user = currentUser
    ? {
        name: currentUser.name,
        email: currentUser.email,
        role: currentUser.role,
      }
    : null;

  const themedStyle = {
    "--primary": appearance.primaryColor,
    "--ring": appearance.primaryColor,
    "--brand-accent": appearance.accentColor,
    "--radius": "0.375rem",
  } as CSSProperties;

  return (
    <div className="flex min-h-screen flex-col" style={themedStyle}>
      <StoreHeader cartCount={cart.itemCount} user={user} appearance={appearance} />
      <main className="flex-1">{children}</main>
      <StoreFooter appearance={appearance} />
    </div>
  );
}
