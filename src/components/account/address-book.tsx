"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { AddressForm } from "@/components/account/address-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  deleteAddressAction,
  setDefaultAddressAction,
} from "@/modules/customers/address.actions";
import type { CustomerAddressDTO } from "@/modules/customers/types";

export function AddressBook({ addresses }: { addresses: CustomerAddressDTO[] }) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerAddressDTO | null>(null);
  const [deleting, setDeleting] = useState<CustomerAddressDTO | null>(null);
  const [pending, startTransition] = useTransition();

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(address: CustomerAddressDTO) {
    setEditing(address);
    setFormOpen(true);
  }

  function confirmDelete() {
    if (!deleting) return;
    startTransition(async () => {
      const result = await deleteAddressAction(deleting.id);
      if (result.ok) {
        toast.success("Endereço excluído.");
        setDeleting(null);
        router.refresh();
      } else {
        toast.error(result.error ?? "Erro ao excluir endereço.");
      }
    });
  }

  function makeDefault(address: CustomerAddressDTO) {
    startTransition(async () => {
      const result = await setDefaultAddressAction(address.id);
      if (result.ok) {
        toast.success("Endereço padrão atualizado.");
        router.refresh();
      } else {
        toast.error(result.error ?? "Erro ao definir endereço padrão.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Endereços</h2>
        <Button size="sm" variant="outline" onClick={openCreate}>
          Adicionar endereço
        </Button>
      </div>

      {addresses.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nenhum endereço cadastrado.</p>
      ) : (
        <ul className="space-y-3">
          {addresses.map((address) => (
            <li key={address.id} className="rounded-md border p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {address.label ? `${address.label} — ` : ""}
                    {address.recipient}
                    {address.isDefault ? (
                      <Badge className="ml-2" variant="secondary">
                        Padrão
                      </Badge>
                    ) : null}
                  </p>
                  <p className="text-muted-foreground">
                    {address.line1}
                    {address.line2 ? `, ${address.line2}` : ""}
                  </p>
                  <p className="text-muted-foreground">
                    {address.city} - {address.state}, {address.postalCode}
                    {address.phone ? ` · ${address.phone}` : ""}
                  </p>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                <Button size="sm" variant="ghost" onClick={() => openEdit(address)}>
                  Editar
                </Button>
                {!address.isDefault ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => makeDefault(address)}
                    disabled={pending}
                  >
                    Definir como padrão
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => setDeleting(address)}
                >
                  Excluir
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar endereço" : "Novo endereço"}</DialogTitle>
            <DialogDescription>
              Preencha os dados de entrega. O CEP é obrigatório.
            </DialogDescription>
          </DialogHeader>
          <AddressForm address={editing} onDone={() => setFormOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir endereço</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir o endereço de{" "}
              <strong>{deleting?.recipient}</strong>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleting(null)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={pending}>
              {pending ? "Excluindo..." : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
