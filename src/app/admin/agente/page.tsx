import { AgentManager } from "@/components/admin/agent-manager";
import { getAgentState } from "@/modules/agent-admin/agent.service";

export const dynamic = "force-dynamic";
export const metadata = { title: "Agente de vendas", robots: { index: false, follow: false } };

export default async function AdminAgentPage() {
  const state = await getAgentState();
  return <AgentManager initial={state} />;
}
