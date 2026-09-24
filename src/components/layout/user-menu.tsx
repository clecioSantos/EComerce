"use client";

import { LayoutDashboard, LogOut, Package, User as UserIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logoutAction } from "@/modules/customers/auth.actions";

export interface HeaderUser {
  name?: string | null;
  email?: string | null;
  role: "CUSTOMER" | "ADMIN";
}

export function UserMenu({ user }: { user: HeaderUser | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (!user) {
    return (
      <Button variant="ghost" size="sm" render={<Link href="/login" />}>
        <UserIcon className="mr-1 size-4" />
        Entrar
      </Button>
    );
  }

  function handleLogout() {
    startTransition(async () => {
      await logoutAction();
      router.push("/");
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" />}>
        <UserIcon className="size-5" />
        <span className="sr-only">Menu do usuário</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-1.5 py-1 text-xs font-medium text-muted-foreground">
          {user.name ?? user.email}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/conta" />}>
          <UserIcon className="mr-2 size-4" />
          Minha conta
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/conta/pedidos" />}>
          <Package className="mr-2 size-4" />
          Meus pedidos
        </DropdownMenuItem>
        {user.role === "ADMIN" ? (
          <DropdownMenuItem render={<Link href="/admin" />}>
            <LayoutDashboard className="mr-2 size-4" />
            Administração
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} disabled={pending}>
          <LogOut className="mr-2 size-4" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
