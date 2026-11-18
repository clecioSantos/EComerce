import "dotenv/config";
import { createServer } from "node:http";
import next from "next";

const port = Number(process.env.PORT ?? 3000);
if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error("PORT inválida.");
process.env.AGENT_EMBEDDED_PORT = String(port);

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev, hostname: "0.0.0.0", port });
await app.prepare();
const handleNext = app.getRequestHandler();

let agent = null;
if (process.env.AGENT_EMBEDDED === "true") {
  const required = ["DATABASE_URL", "MASTER_ENCRYPTION_KEY", "AGENT_ADMIN_PASSWORD",
    "META_APP_SECRET", "META_VERIFY_TOKEN", "GEMINI_API_KEY", "NEXT_PUBLIC_SITE_URL"];
  const missing = required.filter(name => !process.env[name]);
  if (missing.length) {
    console.warn("[agent] desativado: faltam variáveis: " + missing.join(", "));
  } else {
    try {
      agent = await import("./agent-service/src/server.ts");
      agent.startAgentWorker();
      console.info("[agent] webhook e worker iniciados no processo da loja.");
    } catch (error) {
      console.error("[agent] inicialização falhou; loja continua disponível:", error);
    }
  }
}

function isLoopback(address = "") {
  return address === "::1" || address === "127.0.0.1" || address === "::ffff:127.0.0.1";
}

const server = createServer((req, res) => {
  const parsed = new URL(req.url ?? "/", "http://localhost");
  const path = parsed.pathname;
  if (path === "/api/webhooks/whatsapp") {
    if (!agent) {
      res.writeHead(503, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      res.end(JSON.stringify({ error: "Agente não configurado." }));
      return;
    }
    req.url = "/webhook/whatsapp" + parsed.search;
    void agent.handleAgentRequest(req, res);
    return;
  }
  if (path.startsWith("/__internal/agent/")) {
    // These privileged APIs never traverse the public reverse proxy.
    if (!isLoopback(req.socket.remoteAddress) || !agent ||
        !path.startsWith("/__internal/agent/admin/api/") && path !== "/__internal/agent/admin/api") {
      res.writeHead(404, { "Cache-Control": "no-store" });
      res.end("Não encontrado");
      return;
    }
    req.url = path.replace("/__internal/agent/", "/") + parsed.search;
    void agent.handleAgentRequest(req, res);
    return;
  }
  void handleNext(req, res, parsed).catch(error => {
    console.error("[store] request failed", error);
    if (!res.headersSent) res.writeHead(500);
    res.end("Falha no processamento.");
  });
});

server.listen(port, "0.0.0.0", () => console.info("[ecomerce] escutando na porta " + port));
async function shutdown() {
  server.close();
  if (agent) await agent.stopAgentWorker().catch(error => console.error("[agent] close", error));
  process.exitCode = 0;
}
process.once("SIGTERM", () => { void shutdown(); });
process.once("SIGINT", () => { void shutdown(); });
