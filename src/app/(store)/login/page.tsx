import Link from "next/link";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { getSession } from "@/lib/auth/dal";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Entrar",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (session?.user) redirect("/conta");

  const params = await searchParams;
  const callbackUrl =
    typeof params.callbackUrl === "string" ? params.callbackUrl : "/conta";

  return (
    <div className="mx-auto flex w-full max-w-md flex-col justify-center px-4 py-16">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Entrar</h1>
        <p className="text-muted-foreground text-sm">
          Acesse sua conta para acompanhar pedidos.
        </p>
      </div>
      <div className="mt-8">
        <LoginForm callbackUrl={callbackUrl} />
      </div>
      <p className="text-muted-foreground mt-6 text-center text-sm">
        Não tem conta?{" "}
        <Link href="/registro" className="text-foreground underline">
          Criar conta
        </Link>
      </p>
      <p className="text-muted-foreground mt-4 text-center text-xs">
        Ambiente de desenvolvimento: admin@ecommerce.local / admin12345
      </p>
    </div>
  );
}
