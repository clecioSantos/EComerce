import { config } from "./config.js";
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
 const form=new FormData();
 form.append("model","whisper-1");
 form.append("file",new Blob([bytes],{type:metadata.mime_type||"audio/ogg"}),"audio.ogg");
 const transcript=await fetch("https://api.openai.com/v1/audio/transcriptions",{
  method:"POST",headers:{Authorization:"Bearer "+config.OPENAI_API_KEY},body:form
 });
 if(!transcript.ok) throw new Error("Não foi possível transcrever o áudio.");
 const result=await transcript.json() as {text?:string};
 return (result.text||"").slice(0,3000);
}
