import Link from "next/link";
import type { AppearanceInput } from "@/modules/settings/appearance";

export function StoreFooter({ appearance }: { appearance: AppearanceInput }) {
  const siteName = appearance.name;
  const year = new Date().getFullYear();

  return (
    <footer className="bg-muted/40 border-t">
      <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-10 sm:grid-cols-3">
        <div>
          <p className="text-base font-semibold">{siteName}</p>
          <p className="text-muted-foreground mt-2 text-sm">
            {appearance.tagline}
          </p>
        </div>
        <div className="text-sm">
          <p className="mb-2 font-medium">Atendimento</p>
          <ul className="text-muted-foreground space-y-1">
            <li>
              <Link href="/produtos" className="hover:text-foreground">
                Catálogo
              </Link>
            </li>
            <li>
              <Link href="/busca" className="hover:text-foreground">
                Busca
              </Link>
            </li>
            <li>
              <Link href="/conta/pedidos" className="hover:text-foreground">
                Meus pedidos
              </Link>
            </li>
          </ul>
        </div>
        <div className="text-sm">
          <p className="mb-2 font-medium">Sua conta</p>
          <ul className="text-muted-foreground space-y-1">
            <li>
            <li>
              <Link href="/login" className="hover:text-foreground">
                Entrar
              </Link>
            </li>
            <li>
              <Link href="/registro" className="hover:text-foreground">
                Criar conta
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="text-muted-foreground border-t px-4 py-4 text-center text-xs">
        © {year} {siteName}. Todos os direitos reservados.
      </div>
    </footer>
  );
}
