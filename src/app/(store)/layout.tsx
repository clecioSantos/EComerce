import { StoreFooter } from "@/components/layout/store-footer";
import { StoreHeader } from "@/components/layout/store-header";
import { getCurrentUser } from "@/lib/auth/dal";
import { getCartDTO } from "@/modules/cart/cart.service";

export const dynamic = "force-dynamic";

export default async function StoreLayout({ children }: LayoutProps<"/">) {
  const currentUser = await getCurrentUser();
  const cart = await getCartDTO(currentUser?.id);
  const user = currentUser
    ? {
        name: currentUser.name,
        email: currentUser.email,
        role: currentUser.role,
      }
    : null;

  return (
    <div className="flex min-h-screen flex-col">
      <StoreHeader cartCount={cart.itemCount} user={user} />
      <main className="flex-1">{children}</main>
      <StoreFooter />
    </div>
  );
}
