import { config } from "./config.js";
import { generateGemini, outputText } from "./gemini.js";
import { decrypt } from "./security.js";
import type { Store } from "./db.js";

export async function sendText(store: Store, to: string, body: string) {
 const controller = new AbortController();
 const timeout = setTimeout(() => controller.abort(),15000);
 try {
  const res = await fetch("https://graph.facebook.com/"+config.META_GRAPH_VERSION+"/"+encodeURIComponent(store.whatsapp_phone_id)+"/messages", {
   method:"POST",
   headers: {Authorization:"Bearer "+decrypt(store.whatsapp_token_enc),"Content-Type":"application/json"},
   body:JSON.stringify({messaging_product:"whatsapp",recipient_type:"individual",to,type:"text",text:{preview_url:true,body:body.slice(0,3500)}}),
   signal:controller.signal,
  });
  if (!res.ok) throw new Error("Falha ao enviar mensagem pelo WhatsApp ("+res.status+")");
 } finally {clearTimeout(timeout);}
}
export async function transcribeAudio(store: Store, mediaId: string): Promise<string> {
 const bearer="Bearer "+decrypt(store.whatsapp_token_enc);
 const mediaRes=await fetch("https://graph.facebook.com/"+config.META_GRAPH_VERSION+"/"+encodeURIComponent(mediaId),{headers:{Authorization:bearer}});
 if(!mediaRes.ok) throw new Error("Não foi possível localizar o áudio.");
 const metadata=await mediaRes.json() as {url?:string;mime_type?:string};
 if (!metadata.url || !metadata.url.startsWith("https://")) throw new Error("Mídia inválida");
 const url = new URL(metadata.url);
 if (url.hostname !== "lookaside.fbsbx.com") throw new Error("Origem de mídia não permitida.");
 const download=await fetch(url,{headers:{Authorization:bearer}});
 if(!download.ok) throw new Error("Não foi possível baixar o áudio.");
 const bytes=await download.arrayBuffer();
 if(bytes.byteLength>15*1024*1024) throw new Error("Áudio excede o limite.");
 // Inline Gemini requests must remain below the request's 20 MB total body limit.
 // A 10 MB audio payload becomes about 13.4 MB after base64 encoding.
 if(bytes.byteLength>10*1024*1024)throw new Error("Áudio muito grande para transcrição.");
 const mimeType=(metadata.mime_type||"audio/ogg").split(";")[0].trim().toLowerCase();
 const allowed = new Set(["audio/ogg","audio/mpeg","audio/mp3","audio/mp4","audio/m4a","audio/wav","audio/webm","audio/aac","audio/flac"]);
 if(!allowed.has(mimeType))throw new Error("Formato de áudio não suportado.");
 const transcript=await generateGemini([
  {role:"user",parts:[
   {text:"Transcreva integralmente em português o que é dito neste áudio de WhatsApp. Retorne somente as palavras faladas, sem explicações, cabeçalhos ou comentários. Se o áudio não tiver fala compreensível, retorne uma string vazia."},
   {inlineData:{mimeType,data:Buffer.from(bytes).toString("base64")}},
  ]},
 ],{maxOutputTokens:1600,timeoutMs:60000});
 return outputText(transcript).slice(0,3000);
}
