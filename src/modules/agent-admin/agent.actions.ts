"use server";

import { requireAdmin } from "@/lib/auth/dal";
import {
  agentSettingsSchema, saveAgentSettings, getAgentState,
  listAgentConversations, getAgentConversation, setAgentConversationMode,
  startAgentMetaSignup, completeAgentMetaSignup, disableAgentWhatsapp,
} from "@/modules/agent-admin/agent.service";
import { z } from "zod";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };
async function adminCall<T>(task: () => Promise<T>): Promise<Result<T>> {
  try {
    await requireAdmin();
    return { ok: true, data: await task() };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "UNAUTHENTICATED" || message === "FORBIDDEN")
      return { ok: false, error: "Acesso restrito a administradores." };
    // Don't expose internal endpoints or credentials through errors.
    if (/^Serviço de agentes|^Senha administrativa|^Não foi possível acessar|^Conversa|^Agente associado|^Cadastre o agente|^Configure|^A URL pública|^O endereço/.test(message))
      return { ok: false, error: message };
    return { ok: false, error: "Não foi possível concluir a operação. Verifique a configuração do serviço." };
  }
}
export async function agentStateAction() {
  return adminCall(() => getAgentState());
}
export async function saveAgentAction(input: unknown) {
  const parsed = agentSettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Verifique telefone, token e orientações." };
  return adminCall(async () => { await saveAgentSettings(parsed.data); return getAgentState(); });
}
export async function agentConversationsAction() {
  return adminCall(() => listAgentConversations());
}
export async function agentConversationAction(id: string) {
  return adminCall(() => getAgentConversation(id));
}
export async function setAgentModeAction(id: string, mode: "ai" | "human") {
  if (mode !== "ai" && mode !== "human") return { ok: false as const, error: "Modo inválido." };
  return adminCall(async () => { await setAgentConversationMode(id, mode); return true; });
}
export async function beginMetaSignupAction() {
  return adminCall(() => startAgentMetaSignup());
}
export async function finishMetaSignupAction(input: unknown) {
  const schema = z.object({
    state: z.string().regex(/^[a-f0-9]{64}$/),
    code: z.string().min(4).max(2048),
    wabaId: z.string().regex(/^\\d{6,25}$/),
    phoneId: z.string().regex(/^\\d{6,25}$/),
    pin: z.string().regex(/^\\d{6}$/).optional(),
    coexistence: z.boolean(),
  });
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Resposta da Meta inválida." };
  return adminCall(() => completeAgentMetaSignup(parsed.data));
}
export async function disableWhatsappAction() {
  return adminCall(() => disableAgentWhatsapp());
}
