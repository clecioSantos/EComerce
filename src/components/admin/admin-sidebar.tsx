"use client";

import {
  Boxes,
  LayoutDashboard,
  Menu,
  Package,
  Percent,
  Settings,
  Shapes,
  ShoppingCart,
  Tags,
  Ticket,
  Users,
  Warehouse,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/produtos", label: "Produtos", icon: Package },
  { href: "/admin/categorias", label: "Categorias", icon: Shapes },
  { href: "/admin/tipos", label: "Tipos de produto", icon: Boxes },
  { href: "/admin/atributos", label: "Atributos", icon: Tags },
  { href: "/admin/estoque", label: "Estoque", icon: Warehouse },
  { href: "/admin/pedidos", label: "Pedidos", icon: ShoppingCart },
  { href: "/admin/clientes", label: "Clientes", icon: Users },
  { href: "/admin/cupons", label: "Cupons", icon: Ticket },
  { href: "/admin/promocoes", label: "Promoções", icon: Percent },
  { href: "/admin/configuracoes", label: "Configurações", icon: Settings },
];

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 p-3">
      {NAV_ITEMS.map((item) => {
        const active =
          item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AdminSidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <aside className="bg-background hidden w-64 shrink-0 border-r md:block">
        <div className="flex h-16 items-center border-b px-5 font-semibold">Painel</div>
        <NavList />
        <div className="p-3">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            render={<Link href="/" />}
          >
            Ver loja
          </Button>
        </div>
      </aside>

      <div className="bg-background flex h-16 items-center justify-between border-b px-4 md:hidden">
        <span className="font-semibold">Painel</span>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger render={<Button variant="ghost" size="icon" />}>
            <Menu className="size-5" />
            <span className="sr-only">Abrir menu</span>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <div className="flex h-16 items-center border-b px-5 font-semibold">
              Painel
            </div>
            <NavList onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
