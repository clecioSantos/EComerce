import Link from "next/link";
import { redirect } from "next/navigation";

import { RegisterForm } from "@/components/auth/register-form";
import { getSession } from "@/lib/auth/dal";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Criar conta",
  robots: { index: false, follow: false },
};

export default async function RegisterPage() {
  const session = await getSession();
  if (session?.user) redirect("/conta");

  return (
    <div className="mx-auto flex w-full max-w-md flex-col justify-center px-4 py-16">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Criar conta</h1>
        <p className="text-muted-foreground text-sm">
          Leva menos de um minuto.
        </p>
      </div>
      <div className="mt-8">
        <RegisterForm />
      </div>
      <p className="text-muted-foreground mt-6 text-center text-sm">
        Já tem conta?{" "}
        <Link href="/login" className="text-foreground underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}
