import Link from "next/link";
import { Bot, ArrowRight } from "lucide-react";
import { AppearanceForm } from "@/components/admin/appearance-form";
import { getStoreAppearance } from "@/modules/settings/appearance";
import { StoreSettingsForm } from "@/components/admin/store-settings-form";
import { listMelhorEnvioServices } from "@/modules/shipping/melhor-envio/services.service";
import { getStoreSettings } from "@/modules/settings/store-settings.service";

export const dynamic = "force-dynamic";

export const metadata = { title: "Configurações" };

export default async function AdminSettingsPage() {
  const [settings, appearance, { services, source }] = await Promise.all([
    getStoreSettings(),
    getStoreAppearance(),
    listMelhorEnvioServices(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground text-sm">
          Personalize a marca, cores e endereço da loja sem alterar o código.
        </p>
      </div>

      <AppearanceForm initial={appearance} />

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-background p-5">
        <div className="flex items-start gap-3">
          <Bot className="mt-1 size-6 text-primary" />
          <div><h2 className="text-lg font-semibold">Agente de vendas</h2>
            <p className="text-sm text-muted-foreground">Configure o vendedor por WhatsApp, conecte a Meta e acompanhe as conversas.</p></div>
        </div>
        <Link href="/admin/agente" className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
          Configurar agente <ArrowRight className="size-4" />
        </Link>
      </section>

      <StoreSettingsForm
        services={services}
        serviceSource={source}
        initial={
          settings
            ? {
                postalCode: settings.postalCode,
                street: settings.street,
                number: settings.number,
                complement: settings.complement ?? "",
                district: settings.district,
                city: settings.city,
                state: settings.state,
                shippingServiceIds: settings.shippingServiceIds,
              }
            : null
        }
      />
    </div>
  );
}
