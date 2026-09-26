import { StoreSettingsForm } from "@/components/admin/store-settings-form";
import { listMelhorEnvioServices } from "@/modules/shipping/melhor-envio/services.service";
import { getStoreSettings } from "@/modules/settings/store-settings.service";

export const dynamic = "force-dynamic";

export const metadata = { title: "Configurações" };

export default async function AdminSettingsPage() {
  const [settings, { services, source }] = await Promise.all([
    getStoreSettings(),
    listMelhorEnvioServices(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground text-sm">
          Endereço de origem da loja e serviços de frete habilitados.
        </p>
      </div>

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
