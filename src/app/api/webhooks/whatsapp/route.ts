import type { IncomingMessage, ServerResponse } from "node:http";
import { handleAgentRequest, startAgentWorker } from "../../../../../agent-service/src/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Hostinger runs the Next.js standalone server, not the custom server.mjs.
// Make Meta's webhook available as an ordinary Next.js route in both runtimes.
async function handle(request: Request): Promise<Response> {
  if (process.env.AGENT_EMBEDDED !== "true") {
    return Response.json({ error: "Agente integrado desativado." }, { status: 503 });
  }

  try {
    const url = new URL(request.url);
    const headers = Object.fromEntries(request.headers.entries());
    const body = request.method === "POST"
      ? Buffer.from(await request.arrayBuffer())
      : Buffer.alloc(0);

    if (body.length > 1024 * 1024) {
      return Response.json({ error: "Corpo excedeu o limite." }, { status: 413 });
    }

    // Preserve the exact body and X-Hub-Signature-256 for Meta verification.
    const req = {
      method: request.method,
      headers,
      url: "/webhook/whatsapp" + url.search,
      async *[Symbol.asyncIterator](): AsyncGenerator<Buffer> {
        if (body.length) yield body;
      },
    } as unknown as IncomingMessage;

    let status = 200;
    const responseHeaders = new Headers();
    const chunks: Buffer[] = [];
    const res = {
      writeHead(code: number, values?: Record<string, string>) {
        status = code;
        for (const [key, value] of Object.entries(values ?? {}))
          responseHeaders.set(key, value);
        return this;
      },
      end(chunk?: string | Buffer) {
        if (chunk !== undefined) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        return this;
      },
    } as unknown as ServerResponse;

    await handleAgentRequest(req, res);
    // Start the worker in the same persistent Next.js process on first webhook call.
    // The worker handles only signed and queued events; it is idempotent per process.
    startAgentWorker();
    return new Response(Buffer.concat(chunks), { status, headers: responseHeaders });
  } catch (error) {
    console.error("[agent-webhook] request failed", error instanceof Error ? error.name : "unknown");
    return Response.json({ error: "Falha no webhook do WhatsApp." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
