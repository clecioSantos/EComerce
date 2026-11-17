import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { getStoreAppearance } from "@/modules/settings/appearance";
import { StoreFooter } from "@/components/layout/store-footer";
import { StoreHeader } from "@/components/layout/store-header";
import { getCurrentUser } from "@/lib/auth/dal";
import { getCartDTO } from "@/modules/cart/cart.service";

export const dynamic = "force-dynamic";

// Text and controls must remain legible regardless of the merchant's brand colors.
function contrastingText(hex: string): string {
  const rgb = [1, 3, 5].map(index => {
    const value = parseInt(hex.slice(index, index + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const luminance = rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  return luminance > 0.179 ? "#14202b" : "#ffffff";
}

export async function generateMetadata(): Promise<Metadata> {
  const appearance = await getStoreAppearance();
  return {
    title: { default: appearance.name, template: `%s | ${appearance.name}` },
    applicationName: appearance.name,
    description: appearance.tagline,
    openGraph: { title: appearance.name, description: appearance.tagline, siteName: appearance.name },
  };
}

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
    "--primary-foreground": contrastingText(appearance.primaryColor),
    "--ring": appearance.primaryColor,
    "--brand-accent": appearance.accentColor,
    "--brand-accent-foreground": contrastingText(appearance.accentColor),
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
