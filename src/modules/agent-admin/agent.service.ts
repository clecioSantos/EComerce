import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";

import { prisma } from "@/lib/db/prisma";
import { PUBLIC_STOREFRONT_STORE_ID } from "@/modules/settings/appearance";

const storeId = PUBLIC_STOREFRONT_STORE_ID;

const preferencesSchema = z.object({
  tone: z.enum(["descontraído e consultivo", "formal e objetivo", "acolhedor e paciente", "direto e técnico"]),
  instructions: z.string().trim().max(1500),
  emojis: z.boolean(),
  upsell: z.boolean(),
});
export const agentSettingsSchema = z.object({
  enabled: z.boolean(),
  phoneId: z.string().regex(/^\\d{6,25}$/).or(z.literal("")),
  whatsappNumber: z.string().regex(/^\\d{8,16}$/).or(z.literal("")),
  whatsappToken: z.string().max(4096).default(""),
  ...preferencesSchema.shape,
});
export type AgentSettingsInput = z.infer<typeof agentSettingsSchema>;

type RemoteStore = {
  id: string; name: string; store_url: string; whatsapp_phone_id: string | null;
  whatsapp_number: string; enabled: boolean;
  preferences: Partial<z.infer<typeof preferencesSchema>>;
};
export type AgentState = {
  connected: boolean;
  serviceAvailable: boolean;
  configured: boolean;
  settings: AgentSettingsInput;
  storeName: string;
  reason?: string;
};

export type AgentConversation = {
  id: string; phone: string; mode: "ai" | "human"; updated_at: string;
};
export type AgentMessage = { role: "user" | "assistant"; text: string; created_at: string };

const defaults: AgentSettingsInput = {
  enabled: false, phoneId: "", whatsappNumber: "", whatsappToken: "",
  tone: "descontraído e consultivo", instructions: "", emojis: true, upsell: true,
};

function remoteConfig(): { origin: string; authorization: string } | null {
  const raw = process.env.AGENT_SERVICE_URL;
  const password = process.env.AGENT_ADMIN_PASSWORD;
  if (!raw || !password) return null;
  const url = new URL(raw);
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("AGENT_SERVICE_URL deve ser somente a origem do serviço.");
  }
  if (url.protocol !== "https:" &&
      !(process.env.NODE_ENV !== "production" && url.protocol === "http:" &&
        (url.hostname === "localhost" || url.hostname === "127.0.0.1"))) {
    throw new Error("O endereço do serviço de agentes precisa usar HTTPS.");
  }
  return { origin: url.origin, authorization: "Basic " + Buffer.from("admin:" + password).toString("base64") };
}

function publicCommerceUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL;
  if (!raw) throw new Error("Configure NEXT_PUBLIC_SITE_URL antes de cadastrar o agente.");
  const url = new URL(raw);
  if (url.username || url.password || url.search || url.hash) throw new Error("Endereço da loja inválido.");
  if (url.protocol !== "https:" &&
    !(process.env.NODE_ENV !== "production" && url.protocol === "http:" && url.hostname === "localhost")) {
    throw new Error("A URL pública da loja precisa usar HTTPS.");
  }
  return url.origin;
}

async function remote<T>(path: string, method = "GET", payload?: object): Promise<T> {
  const cfg = remoteConfig();
  if (!cfg) throw new Error("Serviço de agentes ainda não configurado no servidor.");
  const response = await fetch(cfg.origin + "/admin/api" + path, {
    method,
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
    headers: {
      Authorization: cfg.authorization,
      ...(payload ? { "Content-Type": "application/json", Origin: cfg.origin } : {}),
    },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error("Senha administrativa do serviço de agentes incorreta.");
    if (response.status === 403) throw new Error("Serviço de agentes recusou a origem desta operação.");
    throw new Error("Serviço de agentes não concluiu a operação (" + response.status + ").");
  }
  return response.json() as Promise<T>;
}

async function ownStore() {
  return prisma.store.findUniqueOrThrow({
    where: { id: storeId },
    select: { id: true, name: true, agentServiceId: true },
  });
}
async function ownRemoteStore(id: string): Promise<RemoteStore> {
  const result = await remote<{ stores: RemoteStore[] }>("/stores");
  const found = result.stores.find(item => item.id === id);
  if (!found) throw new Error("Agente associado não encontrado no serviço. Verifique a instalação.");
  return found;
}
const remoteId = async (): Promise<string> => {
  const store = await ownStore();
  if (!store.agentServiceId) throw new Error("Cadastre o agente primeiro.");
  return store.agentServiceId;
};
function publicSettings(store: RemoteStore): AgentSettingsInput {
  const prefs = store.preferences ?? {};
  return {
    ...defaults,
    enabled: store.enabled,
    phoneId: store.whatsapp_phone_id ?? "",
    whatsappNumber: store.whatsapp_number ?? "",
    tone: preferencesSchema.shape.tone.safeParse(prefs.tone).success
      ? prefs.tone as AgentSettingsInput["tone"] : defaults.tone,
    instructions: typeof prefs.instructions === "string" ? prefs.instructions : "",
    emojis: prefs.emojis !== false,
    upsell: prefs.upsell !== false,
  };
}

export async function getAgentState(): Promise<AgentState> {
  const store = await ownStore();
  const configured = remoteConfig() !== null;
  if (!configured) return { connected: false, serviceAvailable: false, configured, settings: defaults, storeName: store.name,
    reason: "Configure AGENT_SERVICE_URL e AGENT_ADMIN_PASSWORD na Hostinger e implante o serviço independente." };
  try {
    if (!store.agentServiceId) return { connected: false, serviceAvailable: true, configured, settings: defaults, storeName: store.name };
    const remoteStore = await ownRemoteStore(store.agentServiceId);
    return { connected: true, serviceAvailable: true, configured, settings: publicSettings(remoteStore), storeName: store.name };
  } catch {
    return { connected: Boolean(store.agentServiceId), serviceAvailable: false, configured, settings: defaults, storeName: store.name,
      reason: "Não foi possível acessar o serviço do agente. Verifique a URL, senha e estado do processo." };
  }
}

export async function saveAgentSettings(input: AgentSettingsInput) {
  const settings = agentSettingsSchema.parse(input);
  const store = await ownStore();
  const payload = {
    name: store.name, storeUrl: publicCommerceUrl(),
    phoneId: settings.phoneId, whatsappNumber: settings.whatsappNumber,
    whatsappToken: settings.whatsappToken || undefined,
    enabled: settings.enabled,
    preferences: { tone: settings.tone, instructions: settings.instructions, emojis: settings.emojis, upsell: settings.upsell },
  };
  if (!store.agentServiceId) {
    if (settings.enabled) throw new Error("Cadastre o agente desativado antes de conectar o WhatsApp.");
    // Generate a key for the commerce API; only its SHA-256 hash goes into Prisma.
    const token = "ecom_agent_" + randomBytes(32).toString("hex");
    const keyHash = createHash("sha256").update(token).digest("hex");
    const credential = await prisma.agentApiCredential.create({
      data: { storeId: store.id, name: "Agente de vendas - integração automática", keyHash },
    });
    try {
      const result = await remote<{ id: string }>("/stores", "POST", { ...payload, commerceKey: token });
      // Bind only after the service acknowledges the new store.
      await prisma.store.update({ where: { id: store.id, agentServiceId: null }, data: { agentServiceId: result.id } });
      return;
    } catch (error) {
      await prisma.agentApiCredential.update({
        where: { id: credential.id }, data: { isActive: false, revokedAt: new Date() },
      });
      throw error;
    }
  }
  // Require a valid, existing binding. Never allow a browser-provided store ID.
  const existing = await ownRemoteStore(store.agentServiceId);
  const next = { ...payload, phoneId: settings.phoneId || existing.whatsapp_phone_id || "",
    whatsappNumber: settings.whatsappNumber || existing.whatsapp_number || "" };
  await remote("/stores/" + store.agentServiceId, "PUT", next);
}

export async function listAgentConversations(): Promise<AgentConversation[]> {
  const id = await remoteId();
  await ownRemoteStore(id);
  const result = await remote<{ conversations: AgentConversation[] }>("/conversations?storeId=" + encodeURIComponent(id));
  return result.conversations;
}
export async function getAgentConversation(conversationId: string) {
  if (!z.string().uuid().safeParse(conversationId).success) throw new Error("Conversa inválida.");
  const storeId = await remoteId();
  const result = await remote<{ conversation: { id: string; store_id: string; phone: string; mode: "ai" | "human" }; messages: AgentMessage[] }>("/conversations/" + conversationId);
  if (result.conversation.store_id !== storeId) throw new Error("Conversa não pertence à loja.");
  return result;
}
export async function setAgentConversationMode(conversationId: string, mode: "ai" | "human") {
  // The worker's old admin endpoint is global; verify ownership BEFORE mutation.
  await getAgentConversation(conversationId);
  await remote("/conversations/" + conversationId + "/mode", "PUT", { mode });
}
export async function startAgentMetaSignup() {
  const id = await remoteId();
  await ownRemoteStore(id);
  return remote<{ state: string; appId: string; configId: string; graphVersion: string }>("/stores/" + id + "/meta/start", "POST", {});
}
export async function completeAgentMetaSignup(input: { state: string; code: string; wabaId: string; phoneId: string; pin?: string; coexistence: boolean }) {
  const id = await remoteId();
  await ownRemoteStore(id);
  return remote<{ connected: boolean; phoneNumber: string }>("/stores/" + id + "/meta/complete", "POST", input);
}
export async function disableAgentWhatsapp() {
  const id = await remoteId();
  await ownRemoteStore(id);
  return remote("/stores/" + id + "/meta/disconnect", "POST", {});
}
