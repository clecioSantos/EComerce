import { redirect } from "next/navigation";

import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { getCurrentUser } from "@/lib/auth/dal";

export const dynamic = "force-dynamic";

export const metadata = {
  title: { default: "Administração", template: "%s | Admin" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=/admin");
  if (user.role !== "ADMIN") redirect("/");

  return (
    <div className="min-h-screen bg-[#f6f7f8] md:flex">
      <AdminSidebar />
      <main className="min-w-0 flex-1 p-4 md:p-8 lg:p-10">{children}</main>
    </div>
  );
}
