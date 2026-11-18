import { config } from "./config.js";

export type GeminiPart = {
 text?: string;
 functionCall?: { name: string; args?: Record<string, unknown>; id?: string };
 functionResponse?: { name: string; response: Record<string, unknown>; id?: string };
 inlineData?: { mimeType: string; data: string };
 thoughtSignature?: string;
};
export type GeminiContent = { role: "user" | "model"; parts: GeminiPart[] };
export type GeminiResponse = {
 candidates?: { content?: GeminiContent; finishReason?: string }[];
 promptFeedback?: { blockReason?: string };
};

export async function generateGemini(
 contents: GeminiContent[],
 options: { systemInstruction?: string; tools?: object[]; maxOutputTokens?: number; timeoutMs?: number; toolMode?: "NONE" } = {},
): Promise<GeminiContent> {
 const controller = new AbortController();
 const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 30000);
 try {
  const model = config.GEMINI_MODEL;
  // Model is encoded as a single path segment. Never take the endpoint URL from clients.
  const response = await fetch(
   "https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":generateContent", {
    method: "POST",
    headers: { "x-goog-api-key": config.GEMINI_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
     contents,
     ...(options.systemInstruction ? { systemInstruction: { parts: [{ text: options.systemInstruction }] } } : {}),
     ...(options.tools ? { tools: options.tools } : {}),
     ...(options.toolMode ? { toolConfig: { functionCallingConfig: { mode: options.toolMode } } } : {}),
     generationConfig: { maxOutputTokens: options.maxOutputTokens ?? 768 },
    }),
    signal: controller.signal,
   },
  );
  if (!response.ok) {
   // Do not log response bodies: upstream failures can contain sensitive request details.
   throw new Error("Gemini indisponível (HTTP " + response.status + ")");
  }
  const data = await response.json() as GeminiResponse;
  const candidate = data.candidates?.[0];
  if (!candidate?.content?.parts?.length) {
   throw new Error("Gemini não retornou uma resposta utilizável" +
    (data.promptFeedback?.blockReason ? " (bloqueada)" : ""));
  }
  return candidate.content;
 } finally { clearTimeout(timer); }
}

export function outputText(response: GeminiContent): string {
 return response.parts.map(part => part.text ?? "").join("").trim();
}
