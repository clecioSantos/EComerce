"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, CheckCircle2, CircleAlert, MessageSquareText, RefreshCw, ShieldCheck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  saveAgentAction, agentConversationsAction, agentConversationAction, setAgentModeAction,
  beginMetaSignupAction, finishMetaSignupAction, disableWhatsappAction,
} from "@/modules/agent-admin/agent.actions";
import type { AgentConversation, AgentMessage, AgentState, AgentSettingsInput } from "@/modules/agent-admin/agent.service";

type FBApi = {
  init(options: { appId: string; version: string; cookie: boolean; xfbml: boolean }): void;
  login(callback: (result: { authResponse?: { code?: string } }) => void, options: Record<string, unknown>): void;
};
type FacebookWindow = Window & { FB?: FBApi; fbAsyncInit?: () => void };
type MetaSignup = {
  state: string; appId: string; configId: string; graphVersion: string;
  code?: string; wabaId?: string; phoneId?: string; coexistence?: boolean;
};

function getFB() { return window as FacebookWindow; }
async function loadMetaSdk(appId: string, graphVersion: string) {
  if (getFB().FB) { getFB().FB!.init({ appId, version: graphVersion, cookie: false, xfbml: false }); return; }
  await new Promise<void>((resolve, reject) => {
    getFB().fbAsyncInit = () => {
      getFB().FB!.init({ appId, version: graphVersion, cookie: false, xfbml: false });
      resolve();
    };
    const script = document.createElement("script");
    script.src = "https://connect.facebook.net/pt_BR/sdk.js";
    script.async = true;
    script.onerror = () => reject(new Error("Não foi possível carregar a Meta."));
    document.head.append(script);
  });
}

const field = "w-full";
const panel = "rounded-xl border bg-background p-5 shadow-sm";
const tones: AgentSettingsInput["tone"][] = [
  "descontraído e consultivo", "formal e objetivo", "acolhedor e paciente", "direto e técnico",
];

export function AgentManager({ initial }: { initial: AgentState }) {
  const [state, setState] = useState(initial);
  const [form, setForm] = useState<AgentSettingsInput>(initial.settings);
  const [busy, setBusy] = useState(false);
  const [metaReady, setMetaReady] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [conversations, setConversations] = useState<AgentConversation[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [activeMode, setActiveMode] = useState<"ai" | "human">("ai");
  const metaRef = useRef<MetaSignup | null>(null);
  const metaCompletingRef = useRef(false);

  const update = (next: Partial<AgentSettingsInput>) => setForm(prev => ({ ...prev, ...next }));
  const refreshConversations = useCallback(async () => {
    if (!state.connected || !state.serviceAvailable) return;
    const result = await agentConversationsAction();
    if (!result.ok) { setError(result.error); return; }
    setConversations(result.data);
  }, [state.connected, state.serviceAvailable]);

  useEffect(() => { void refreshConversations(); }, [refreshConversations]);

  async function save() {
    setBusy(true); setNotice(""); setError("");
    try {
      const result = await saveAgentAction(form);
      if (!result.ok) { setError(result.error); return; }
      setState(result.data);
      setForm({ ...result.data.settings, whatsappToken: "" });
      setNotice("Configurações do agente salvas.");
    } finally { setBusy(false); }
  }

  const completeMeta = useCallback(async () => {
    const current = metaRef.current;
    if (!current || metaCompletingRef.current || !current.code || !current.wabaId || !current.phoneId) return;
    metaCompletingRef.current = true;
    let pin: string | undefined;
    if (!current.coexistence) {
      pin = window.prompt("Defina o PIN de 6 dígitos para o registro do WhatsApp Cloud API:") ?? undefined;
      if (!pin || !/^\d{6}$/.test(pin)) {
        setError("A conexão requer um PIN de seis dígitos.");
        metaRef.current = null; metaCompletingRef.current = false; return;
      }
    }
    setBusy(true); setError(""); setNotice("Confirmando a conta e o número na Meta...");
    try {
      const result = await finishMetaSignupAction({
        state: current.state, code: current.code, wabaId: current.wabaId,
        phoneId: current.phoneId, coexistence: current.coexistence === true, pin,
      });
      if (!result.ok) { setError(result.error); return; }
      setNotice("WhatsApp conectado: " + result.data.phoneNumber);
      setForm(prev => ({ ...prev, phoneId: current.phoneId ?? "", whatsappNumber: result.data.phoneNumber, enabled: true, whatsappToken: "" }));
      setState(prev => ({ ...prev, settings: { ...prev.settings, enabled: true, phoneId: current.phoneId ?? "", whatsappNumber: result.data.phoneNumber } }));
    } finally {
      metaRef.current = null; metaCompletingRef.current = false; setBusy(false); setMetaReady(false);
    }
  }, []);

  useEffect(() => {
    function message(event: MessageEvent) {
      try {
        const origin = new URL(event.origin);
        if (origin.protocol !== "https:" || !(origin.hostname === "facebook.com" || origin.hostname.endsWith(".facebook.com"))) return;
      } catch { return; }
      let payload: unknown = event.data;
      if (typeof payload === "string") { try { payload = JSON.parse(payload); } catch { return; } }
      if (!payload || typeof payload !== "object") return;
      const p = payload as { type?: string; event?: string; data?: { waba_id?: string; phone_number_id?: string } };
      if (p.type !== "WA_EMBEDDED_SIGNUP" || !metaRef.current) return;
      if (p.event === "FINISH" || p.event === "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING") {
        metaRef.current = {
          ...metaRef.current,
          wabaId: String(p.data?.waba_id ?? ""),
          phoneId: String(p.data?.phone_number_id ?? ""),
          coexistence: p.event === "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING",
        };
        void completeMeta();
      }
      if (p.event === "ERROR" || p.event === "CANCEL") {
        metaRef.current = null;
        setMetaReady(false);
        setError("Cadastro interrompido ou cancelado pela Meta.");
      }
    }
    window.addEventListener("message", message);
    return () => window.removeEventListener("message", message);
  }, [completeMeta]);

  async function connectMeta() {
    setBusy(true); setNotice(""); setError(""); setMetaReady(false);
    try {
      const result = await beginMetaSignupAction();
      if (!result.ok) { setError(result.error); return; }
      metaRef.current = result.data;
      await loadMetaSdk(result.data.appId, result.data.graphVersion);
      setMetaReady(true);
      setNotice("Meta preparada. Clique em Autorizar na Meta para abrir a janela de conexão.");
    } catch { setError("Não foi possível iniciar a conexão com a Meta."); metaRef.current = null; }
    finally { setBusy(false); }
  }

  function authorizeMeta() {
    // Invoked immediately on a real click; prevents the browser from blocking the login popup.
    const setup = metaRef.current;
    if (!setup || !getFB().FB) { setError("Prepare novamente a conexão."); setMetaReady(false); return; }
    setMetaReady(false);
    setNotice("Conclua o cadastro na janela da Meta.");
    getFB().FB!.login(reply => {
      if (!reply.authResponse?.code) {
        setError("Autorização não concluída pela Meta.");
        metaRef.current = null; return;
      }
      if (!metaRef.current || metaRef.current.state !== setup.state) return;
      metaRef.current = { ...metaRef.current, code: reply.authResponse.code };
      void completeMeta();
    }, {
      config_id: setup.configId, response_type: "code",
      override_default_response_type: true, extras: { version: "v4", setup: {} },
    });
  }

  async function disconnect() {
    if (!window.confirm("Desativar o atendimento automático deste número?")) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await disableWhatsappAction();
      if (!result.ok) { setError(result.error); return; }
      update({ enabled: false });
      setState(prev => ({ ...prev, settings: { ...prev.settings, enabled: false } }));
      setNotice("Atendimento automático desativado.");
    } finally { setBusy(false); }
  }

  async function openConversation(conversationId: string) {
    setSelected(conversationId); setMessages([]); setError("");
    const result = await agentConversationAction(conversationId);
    if (!result.ok) { setError(result.error); return; }
    setMessages(result.data.messages);
    setActiveMode(result.data.conversation.mode);
  }
  async function switchMode() {
    if (!selected) return;
    setBusy(true); setError("");
    try {
      const next = activeMode === "ai" ? "human" : "ai";
      const result = await setAgentModeAction(selected, next);
      if (!result.ok) { setError(result.error); return; }
      setActiveMode(next);
      setConversations(prev => prev.map(c => c.id === selected ? { ...c, mode: next } : c));
      setNotice(next === "human" ? "Atendimento assumido. O agente não responderá automaticamente." : "Atendimento automático reativado.");
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><Bot className="size-7 text-primary" /> Agente de vendas</h1>
          <p className="mt-1 text-sm text-muted-foreground">Configuração e atendimentos do vendedor por WhatsApp da {state.storeName}.</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${state.connected && state.settings.enabled ? "bg-emerald-100 text-emerald-800" : "bg-muted text-muted-foreground"}`}>
          {state.connected && state.settings.enabled ? "Agente ativo" : state.connected ? "Agente desativado" : "Não cadastrado"}
        </span>
      </div>
      {state.reason ? (
        <div role="status" className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <CircleAlert className="mt-0.5 size-5 shrink-0" /><span>{state.reason}</span>
        </div>
      ) : null}
      {error ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
      {notice ? <p role="status" className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"><CheckCircle2 className="size-4" />{notice}</p> : null}

      <div className="grid min-w-0 gap-6 xl:grid-cols-2">
        <section className={panel + " space-y-5"}>
          <div><h2 className="text-lg font-bold">Personalidade e vendas</h2><p className="text-sm text-muted-foreground">O agente consulta os produtos cadastrados e utiliza as orientações abaixo para responder.</p></div>
          <div className="space-y-2">
            <Label htmlFor="agent-tone">Tom de voz</Label>
            <select id="agent-tone" className="h-9 w-full rounded-lg border bg-background px-3 text-sm" value={form.tone} onChange={e => update({ tone: e.target.value as AgentSettingsInput["tone"] })}>
              {tones.map(tone => <option key={tone} value={tone}>{tone}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="agent-instructions">Orientações para o vendedor</Label>
            <textarea id="agent-instructions" rows={6} maxLength={1500} value={form.instructions} onChange={e => update({ instructions: e.target.value })}
              placeholder="Ex.: Nossa loja prioriza moda feminina sofisticada, oferece também uma seleção masculina. Seja consultivo, valorize qualidade e caimento. Nunca invente disponibilidade nem descontos."
              className="w-full resize-y rounded-lg border bg-background p-3 text-sm" />
            <p className="text-right text-xs text-muted-foreground">{form.instructions.length}/1500</p>
          </div>
          <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={form.emojis} onChange={e=>update({ emojis: e.target.checked })}/> Permitir emojis discretos</label>
          <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={form.upsell} onChange={e=>update({ upsell: e.target.checked })}/> Sugerir produtos complementares</label>
        </section>

        <section className={panel + " space-y-5"}>
          <div><h2 className="text-lg font-bold">WhatsApp Business</h2><p className="text-sm text-muted-foreground">Conecte um número pela Meta ou informe as credenciais da Cloud API já existente.</p></div>
          <div className="rounded-lg border bg-muted/40 p-3 text-sm">
            <div className="flex items-center gap-2 font-medium"><ShieldCheck className="size-4 text-primary" /> Credenciais protegidas</div>
            <p className="mt-1 text-muted-foreground">Tokens são transmitidos ao servidor e não são exibidos novamente após salvar.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="agent-phone">Número com DDI (apenas dígitos)</Label><Input id="agent-phone" className={field} placeholder="5551999999999" value={form.whatsappNumber} onChange={e=>update({ whatsappNumber: e.target.value.replace(/\D/g,"") })} /></div>
            <div className="space-y-2"><Label htmlFor="agent-phone-id">Phone Number ID da Meta</Label><Input id="agent-phone-id" className={field} placeholder="123456789012345" value={form.phoneId} onChange={e=>update({ phoneId: e.target.value.replace(/\D/g,"") })} /></div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="agent-token">Token da API oficial do WhatsApp</Label>
            <Input id="agent-token" type="password" autoComplete="new-password" placeholder="Deixe vazio para manter o token atual" value={form.whatsappToken} onChange={e => update({ whatsappToken: e.target.value })} />
          </div>
          <label className="flex items-center gap-3 rounded-lg border px-3 py-3 text-sm font-medium">
            <input type="checkbox" checked={form.enabled} onChange={e=>update({ enabled: e.target.checked })}/>
            Atendimento automático ativo
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={save} disabled={busy || !state.serviceAvailable}>{busy ? "Aguarde..." : state.connected ? "Salvar configurações" : "Cadastrar agente"}</Button>
            <Button type="button" variant="outline" onClick={metaReady ? authorizeMeta : connectMeta} disabled={busy || !state.connected || !state.serviceAvailable}>{metaReady ? "Autorizar na Meta" : "Conectar pela Meta"}</Button>
            {state.connected ? <Button type="button" variant="ghost" onClick={disconnect} disabled={busy}>Desativar WhatsApp</Button> : null}
          </div>
          {!state.connected && <p className="text-xs text-muted-foreground">Primeiro cadastre o agente desativado. Depois conecte o WhatsApp pela Meta ou configure número, ID e token manualmente.</p>}
        </section>
      </div>

      <section className={panel + " space-y-4"}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><h2 className="flex items-center gap-2 text-lg font-bold"><MessageSquareText className="size-5" /> Atendimentos</h2><p className="text-sm text-muted-foreground">Visualize conversas e assuma o atendimento quando necessário.</p></div>
          <Button variant="outline" type="button" disabled={!state.connected || !state.serviceAvailable} onClick={()=>void refreshConversations()}><RefreshCw className="size-4" /> Atualizar</Button>
        </div>
        <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(200px,0.7fr)_minmax(0,1.3fr)]">
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {conversations.length === 0 ? <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Nenhuma conversa registrada nesta loja.</p> :
              conversations.map(conversation => (
                <button key={conversation.id} type="button" onClick={()=>void openConversation(conversation.id)}
                  className={`w-full rounded-lg border p-3 text-left text-sm hover:border-primary ${selected === conversation.id ? "border-primary bg-primary/5" : ""}`}>
                  <span className="block font-semibold">{conversation.phone}</span>
                  <span className="text-xs text-muted-foreground">{conversation.mode === "ai" ? "Agente automático" : "Atendimento humano"}</span>
                </button>
              ))}
          </div>
          <div className="min-h-44 rounded-lg border bg-muted/20 p-4">
            {selected ? (
              <>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                  <span className="flex items-center gap-2 text-sm font-semibold"><UserRound className="size-4"/> {conversations.find(c=>c.id===selected)?.phone}</span>
                  <Button variant="outline" size="sm" type="button" disabled={busy} onClick={()=>void switchMode()}>
                    {activeMode === "ai" ? "Assumir atendimento" : "Devolver para IA"}
                  </Button>
                </div>
                <div className="max-h-80 space-y-3 overflow-y-auto">
                  {messages.map((message,index)=>(
                    <div key={index} className={`max-w-[95%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${message.role === "user" ? "bg-background" : "ml-auto bg-primary/10"}`}>
                      <span className="mb-1 block text-xs font-semibold">{message.role === "user" ? "Cliente" : "Agente"}</span>{message.text}
                    </div>
                  ))}
                  {messages.length === 0 ? <p className="text-sm text-muted-foreground">Sem mensagens disponíveis.</p> : null}
                </div>
              </>
            ) : <p className="text-sm text-muted-foreground">Selecione uma conversa para visualizar o histórico.</p>}
          </div>
        </div>
      </section>
    </div>
  );
}
