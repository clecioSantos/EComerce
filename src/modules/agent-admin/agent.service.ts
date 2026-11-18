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
  phoneId: z.string().regex(/^\d{6,25}$/).or(z.literal("")),
  whatsappNumber: z.string().regex(/^\d{8,16}$/).or(z.literal("")),
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

function remoteConfig(): { origin: string; apiPrefix: string; requestOrigin: string; authorization: string } | null {
  const password = process.env.AGENT_ADMIN_PASSWORD;
  if (process.env.AGENT_EMBEDDED === "true") {
    if (!password) return null;
    // Loopback requests reach the same Node server without consuming a second app slot.
    // The internal admin route rejects all external TCP clients.
    const port = Number(process.env.PORT ?? process.env.AGENT_EMBEDDED_PORT ?? 3000);
    if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error("Porta interna inválida.");
    const siteUrl = publicCommerceUrl();
    return {
      origin: "http://127.0.0.1:" + port,
      apiPrefix: "/__internal/agent/admin/api",
      requestOrigin: siteUrl,
      authorization: "Basic " + Buffer.from("admin:" + password).toString("base64"),
    };
  }
  const raw = process.env.AGENT_SERVICE_URL;
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
  return {
    origin: url.origin,
    apiPrefix: "/admin/api",
    requestOrigin: url.origin,
    authorization: "Basic " + Buffer.from("admin:" + password).toString("base64"),
  };
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
  if (process.env.AGENT_EMBEDDED === "true") {
    // Run the agent API in-process. Managed Next.js hosts may not accept TCP
    // connections to 127.0.0.1 even when the public application is healthy.
    // Caller authentication remains enforced by the Next.js server actions.
    const { executeEmbeddedAgentAdmin } = await import("../../../agent-service/src/server");
    const result = await executeEmbeddedAgentAdmin(path, method, payload);
    if (result.status === 401) throw new Error("Senha administrativa do serviço de agentes incorreta.");
    if (result.status === 403) throw new Error("Serviço de agentes recusou a origem desta operação.");
    if (result.status < 200 || result.status >= 300) {
      throw new Error("Serviço de agentes não concluiu a operação (" + result.status + ").");
    }
    return result.body as T;
  }
  const response = await fetch(cfg.origin + cfg.apiPrefix + path, {
    method,
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
    headers: {
      Authorization: cfg.authorization,
      ...(payload ? { "Content-Type": "application/json", Origin: cfg.requestOrigin } : {}),
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

function agentDiagnostic(error: unknown): { code: string; guidance: string; errorName: string; causeCode?: string } {
  const e = error instanceof Error ? error : new Error("Unknown agent service failure");
  const cause = (e as Error & { cause?: { code?: unknown } }).cause;
  const causeCode = typeof cause?.code === "string" ? cause.code : undefined;
  const message = e.message;
  let code = "AGENT_UNEXPECTED_ERROR";
  let guidance = "Falha inesperada ao consultar o agente. Consulte os logs do servidor usando o código de diagnóstico.";
  if (message.includes("Senha administrativa")) {
    code = "AGENT_AUTH_FAILED";
    guidance = "O serviço recusou a autenticação (HTTP 401). Confira AGENT_ADMIN_PASSWORD e se a mesma senha está configurada no serviço.";
  } else if (message.includes("recusou a origem")) {
    code = "AGENT_ORIGIN_REJECTED";
    guidance = "O serviço recusou a origem (HTTP 403). Confira NEXT_PUBLIC_SITE_URL e ALLOWED_COMMERCE_HOSTS.";
  } else if (/operação \((\d{3})\)/.test(message)) {
    const status = message.match(/operação \((\d{3})\)/)?.[1] ?? "unknown";
    code = "AGENT_HTTP_" + status;
    guidance = "O serviço retornou HTTP " + status + ". Consulte os logs da rota interna do agente na Hostinger.";
  } else if (e.name === "TimeoutError" || e.name === "AbortError") {
    code = "AGENT_TIMEOUT";
    guidance = "A conexão com o agente excedeu 12 segundos. Confira se a rota interna iniciou e está acessível no servidor.";
  } else if (e instanceof TypeError && /fetch|network/i.test(message)) {
    code = "AGENT_CONNECTION_FAILED";
    guidance = "Não foi possível estabelecer conexão com o serviço do agente. Confira PORT, AGENT_EMBEDDED e os logs de inicialização.";
  } else if (message.includes("PORT") || message.includes("Porta interna")) {
    code = "AGENT_INVALID_PORT";
    guidance = "A porta interna do agente é inválida. Confira PORT e AGENT_EMBEDDED_PORT.";
  } else if (message.includes("NEXT_PUBLIC_SITE_URL") || message.includes("URL pública") || message.includes("Endereço da loja")) {
    code = "AGENT_SITE_URL_INVALID";
    guidance = "Confira NEXT_PUBLIC_SITE_URL: use o endereço HTTPS público da loja.";
  } else if (message.includes("AGENT_SERVICE_URL") || message.includes("endereço do serviço")) {
    code = "AGENT_SERVICE_URL_INVALID";
    guidance = "Confira AGENT_SERVICE_URL ou habilite AGENT_EMBEDDED=true para usar o serviço integrado.";
  }
  return { code, guidance, errorName: e.name, ...(causeCode ? { causeCode } : {}) };
}

export async function getAgentState(): Promise<AgentState> {
  const store = await ownStore();
  const fallback = { connected: Boolean(store.agentServiceId), settings: defaults, storeName: store.name };
  try {
    const configured = remoteConfig() !== null;
    if (!configured) {
      const missing = ["AGENT_ADMIN_PASSWORD", ...(process.env.AGENT_EMBEDDED === "true" ? [] : ["AGENT_SERVICE_URL"])].filter(name => !process.env[name]);
      const code = "AGENT_CONFIG_MISSING";
      console.error("[agent-admin] healthcheck failed", { code, missing });
      return {
        ...fallback, configured: false, serviceAvailable: false,
        reason: "Diagnóstico " + code + ": falta configurar " + missing.join(", ") + ". Para serviço integrado, use AGENT_EMBEDDED=true; salve as variáveis e reinicie a aplicação.",
      };
    }
    // Also check the remote before displaying an enabled setup button.
    const available = await remote<{ stores: RemoteStore[] }>("/stores");
    if (!store.agentServiceId) return { ...fallback, configured: true, serviceAvailable: true };
    const remoteStore = available.stores.find(item => item.id === store.agentServiceId);
    if (!remoteStore) {
      console.error("[agent-admin] healthcheck failed", { code: "AGENT_STORE_NOT_FOUND" });
      return {
        ...fallback, configured: true, serviceAvailable: false,
        reason: "Diagnóstico AGENT_STORE_NOT_FOUND: a loja está vinculada, mas o cadastro não foi encontrado no serviço. Confira o banco utilizado pelo agente.",
      };
    }
    return {
      connected: true, configured: true, serviceAvailable: true,
      settings: publicSettings(remoteStore), storeName: store.name,
    };
  } catch (error) {
    const diagnostic = agentDiagnostic(error);
    // Never log credentials, authorization headers or full URLs.
    // Only emit a bounded error category; never log credential values or connection URLs.
    const errorMessage = error instanceof Error ? error.message : "";
    const detail = /Cannot find module|Cannot read properties|is not a function|Max clients reached|EMAXCONNSESSION|pool_size/i.test(errorMessage)
      ? errorMessage.slice(0, 140).replace(/postgres(?:ql)?:\/\/\S+/gi, "[database-url]")
      : undefined;
    console.error("[agent-admin] healthcheck failed", {
      code: diagnostic.code, errorName: diagnostic.errorName,
      ...(diagnostic.causeCode ? { causeCode: diagnostic.causeCode } : {}),
      ...(detail ? { detail } : {}),
    });
    return {
      ...fallback, configured: true, serviceAvailable: false,
      reason: "Diagnóstico " + diagnostic.code + ": " + diagnostic.guidance,
    };
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
      const linked = await prisma.store.updateMany({ where: { id: store.id, agentServiceId: null }, data: { agentServiceId: result.id } });
      if (linked.count !== 1) throw new Error("Agente já vinculado à loja; atualize a página antes de continuar.");
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
