import Link from "next/link";
import type { AppearanceInput } from "@/modules/settings/appearance";

export function StoreFooter({ appearance }: { appearance: AppearanceInput }) {
  const siteName = appearance.name;
  const year = new Date().getFullYear();

  return (
    <footer className="border-t-4 border-primary bg-primary/[0.055]">
      <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-10 sm:grid-cols-3">
        <div>
          <div className="mb-3 flex items-center gap-3">
            {appearance.logoUrl ? (
              <img src={appearance.logoUrl} alt={`Logotipo de ${siteName}`} className="h-12 w-auto max-w-36 object-contain" />
            ) : (
              <span className="flex size-10 items-center justify-center rounded-md bg-primary font-bold text-primary-foreground">{siteName.slice(0, 1).toUpperCase()}</span>
            )}
            <p className="text-lg font-bold tracking-tight text-primary">{siteName}</p>
          </div>
          <p className="text-muted-foreground mt-2 text-sm">
            {appearance.tagline}
          </p>
        </div>
        <div className="text-sm">
          <p className="mb-2 font-bold text-primary">Atendimento</p>
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
          <p className="mb-2 font-bold text-primary">Sua conta</p>
          <ul className="text-muted-foreground space-y-1">
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
      <div className="border-t border-primary/15 px-4 py-4 text-center text-xs text-muted-foreground">
        © {year} {siteName}. Todos os direitos reservados.
      </div>
    </footer>
  );
}
