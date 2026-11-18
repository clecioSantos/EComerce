import type { IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { config } from "./config.js";
import { pool, query, type Store, type Conversation } from "./db.js";
import { encrypt, safeEqual, validMetaSignature } from "./security.js";
import { renderDashboard } from "./dashboard.js";
import { respond } from "./ai.js";
import { sendText, transcribeAudio } from "./whatsapp.js";
import { prepareSignup, completeSignup, disconnectSignup } from "./meta-signup.js";
import { validateCommerceUrl } from "./commerce-security.js";

type Json = Record<string, unknown>;
const storeInputs = (o:Json) => ({
 name:String(o.name||"").trim().slice(0,100),
 storeUrl:String(o.storeUrl||"").trim(),
 phoneId:String(o.phoneId||"").trim(),
 whatsappNumber:String(o.whatsappNumber||"").trim(),
 whatsappToken:typeof o.whatsappToken==="string"?o.whatsappToken.trim():"",
 commerceKey:typeof o.commerceKey==="string"?o.commerceKey.trim():"",
 enabled:o.enabled===true,
 preferences: typeof o.preferences==="object"&&o.preferences&&!Array.isArray(o.preferences)?o.preferences as Json:{},
});
function ensureStoreInput(x: ReturnType<typeof storeInputs>, creating:boolean) {
 const url=validateCommerceUrl(x.storeUrl);
 if (!["https:","http:"].includes(url.protocol) ||
     (url.protocol==="http:" && url.hostname!=="localhost")) throw Error("Informe URL HTTPS da loja.");
 if (!x.name || (x.phoneId && !/^\d{6,25}$/.test(x.phoneId)) || (x.whatsappNumber && !/^\d{8,16}$/.test(x.whatsappNumber))) throw Error("Nome ou identificação do WhatsApp inválidos.");
 if (creating&&!x.commerceKey)throw Error("A chave da API comercial é obrigatória no cadastro.");
 if (creating && x.enabled && (!x.phoneId || !x.whatsappNumber || !x.whatsappToken)) throw Error("Conecte ou configure o WhatsApp antes de ativar.");
 if (x.preferences.instructions && String(x.preferences.instructions).length>1500)throw Error("Orientações muito extensas.");
 if (x.preferences.tone && String(x.preferences.tone).length>100)throw Error("Tom inválido.");
 if (!["true","false"].includes(String(x.enabled)))throw Error("Status inválido.");
}
function respondJson(res:ServerResponse,status:number,data:unknown){
 res.writeHead(status,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"});res.end(JSON.stringify(data));
}
function responseError(res:ServerResponse,status:number,error:string){respondJson(res,status,{error});}
async function rawBody(req:IncomingMessage,max=1024*1024):Promise<Buffer>{
 const chunks:Buffer[]=[];let size=0;
 for await(const chunk of req) {const bytes=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);size+=bytes.byteLength;
  if(size>max)throw Error("Corpo excedeu o limite");chunks.push(bytes);}
 return Buffer.concat(chunks);
}
async function requestJson(req:IncomingMessage) {
 const body=await rawBody(req);const obj:unknown=JSON.parse(body.toString("utf8"));
 if (!obj||typeof obj!=="object"||Array.isArray(obj)) throw Error("JSON inválido");
 return obj as Json;
}
function authorized(req:IncomingMessage){
 const value=req.headers.authorization;
 if (!value?.startsWith("Basic "))return false;
 try{const decoded=Buffer.from(value.slice(6),"base64").toString("utf8");
  const colon=decoded.indexOf(":");return colon>=0&&safeEqual(decoded.slice(colon+1),config.ADMIN_PASSWORD);
 }catch{return false;}
}
/**
 * Trusted in-process admin entry point for the embedded Next.js integration.
 * This is never exposed as an HTTP route. Next server actions enforce requireAdmin()
 * before calling the agent service, and adminApi retains payload/origin validation.
 */
export async function executeEmbeddedAgentAdmin(
 path:string, method="GET", payload?:object,
):Promise<{status:number;body:unknown}> {
 if (!path.startsWith("/") || path.startsWith("//") || path.includes("..")) throw Error("Rota do agente inválida.");
 // A lightweight async-iterable request avoids Node stream module interop
 // issues when Next.js bundles this module into a production Server Action.
 const headers: Record<string,string> = {};
 if (payload !== undefined) {
  headers.origin=new URL(config.PUBLIC_BASE_URL).origin;
  headers["content-type"]="application/json";
 }
 const req = {
  method,
  headers,
  async *[Symbol.asyncIterator](): AsyncGenerator<Buffer> {
   if (payload !== undefined) yield Buffer.from(JSON.stringify(payload));
  },
 } as unknown as IncomingMessage;
 let status=200;
 let responseBody="";
 const res = {
  writeHead(code:number) {status=code;return this;},
  end(chunk?:string|Buffer) {if(chunk!==undefined)responseBody+=Buffer.isBuffer(chunk)?chunk.toString("utf8"):String(chunk);return this;},
 } as unknown as ServerResponse;
 const url=new URL("/admin/api"+path,config.PUBLIC_BASE_URL);
 await adminApi(req,res,url);
 let body:unknown;
 try {body=JSON.parse(responseBody);} catch {body={error:"Resposta inválida do serviço integrado."};}
 return {status,body};
}

async function adminApi(req:IncomingMessage,res:ServerResponse,url:URL) {
 const method=req.method||"GET", path=url.pathname;
 // Enforce same-origin on every state-changing admin action, including Meta signup routes.
 if(method!=="GET" && method!=="HEAD") {
  const origin=req.headers.origin;
  const expected=new URL(config.PUBLIC_BASE_URL).origin;
  if(origin && origin!==expected) return responseError(res,403,"Origem inválida.");
  const fetchSite=req.headers["sec-fetch-site"];
  if(fetchSite==="cross-site") return responseError(res,403,"Requisição entre sites não autorizada.");
 }
 const signup=url.pathname.match(/^\/admin\/api\/stores\/([a-f0-9-]{36})\/meta\/(start|complete|disconnect)$/);
 if(signup){
  if(method!=="POST")return responseError(res,405,"Método inválido");
  const storeId=signup[1],action=signup[2];
  if(action==="start")return respondJson(res,200,await prepareSignup(storeId));
  if(action==="disconnect")return respondJson(res,200,await disconnectSignup(storeId));
  const body=await requestJson(req);
  const result=await completeSignup(storeId,{state:String(body.state||""),code:String(body.code||""),wabaId:String(body.wabaId||""),phoneId:String(body.phoneId||""),pin:typeof body.pin==="string"?body.pin:undefined,coexistence:body.coexistence===true});
  if(result.storeId!==storeId) return responseError(res,403,"Loja não autorizada");
  return respondJson(res,200,result);
 }
 if(path==="/admin/api/stores"&&method==="GET"){
  const stores=await query<Store>("SELECT * FROM agent_stores ORDER BY name");
  return respondJson(res,200,{stores:stores.map(s=>({id:s.id,name:s.name,store_url:s.store_url,whatsapp_phone_id:s.whatsapp_phone_id,whatsapp_number:s.whatsapp_number,enabled:s.enabled,preferences:s.preferences}))});
 }
 if((path==="/admin/api/stores"&&method==="POST")||(/^\/admin\/api\/stores\/[a-f0-9-]{36}$/.test(path)&&method==="PUT")){
  const input=storeInputs(await requestJson(req));const creating=method==="POST";ensureStoreInput(input,creating);
  const id=creating?randomUUID():path.split("/").pop()!;
  const values=[input.name,input.storeUrl,input.phoneId,input.whatsappNumber,input.enabled,
    JSON.stringify({tone:input.preferences.tone||"descontraído e consultivo",instructions:input.preferences.instructions||"",
      emojis:input.preferences.emojis!==false,upsell:input.preferences.upsell!==false})];
  if(creating){
   await query("INSERT INTO agent_stores(id,name,store_url,whatsapp_phone_id,whatsapp_number,enabled,preferences,commerce_api_key_enc,whatsapp_token_enc) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
    [id,input.name,input.storeUrl,input.phoneId||null,input.whatsappNumber,input.enabled,values[5],encrypt(input.commerceKey),input.whatsappToken?encrypt(input.whatsappToken):""]);
  }else{
   if(input.enabled){const [old]=await query<Store>("SELECT * FROM agent_stores WHERE id=$1",[id]);if(!old||!(input.phoneId||old.whatsapp_phone_id)||!(input.whatsappNumber||old.whatsapp_number)||!(input.whatsappToken||old.whatsapp_token_enc))throw Error("Conecte o WhatsApp antes de ativar.");}
   const r=await pool.query("UPDATE agent_stores SET name=$2,store_url=$3,whatsapp_phone_id=$4,whatsapp_number=$5,enabled=$6,preferences=$7,commerce_api_key_enc=COALESCE($8,commerce_api_key_enc),whatsapp_token_enc=COALESCE($9,whatsapp_token_enc),updated_at=now() WHERE id=$1",
    [id,...values,input.commerceKey?encrypt(input.commerceKey):null,input.whatsappToken?encrypt(input.whatsappToken):null]);
   if(!r.rowCount)return responseError(res,404,"Loja não encontrada");
  }
  return respondJson(res,200,{id});
 }
 if(path==="/admin/api/conversations"&&method==="GET"){
  const storeId=url.searchParams.get("storeId");
  if(!storeId||!/^[a-f0-9-]{36}$/.test(storeId))return responseError(res,400,"Identificador inválido");
  const conversations=await query<Conversation>("SELECT id,store_id,phone,mode,updated_at FROM agent_conversations WHERE store_id=$1 ORDER BY updated_at DESC LIMIT 100",[storeId]);
  return respondJson(res,200,{conversations});
 }
 const match=path.match(/^\/admin\/api\/conversations\/([a-f0-9-]{36})(?:\/(mode))?$/);
 if(match){
  const id=match[1];
  if(method==="GET"&&!match[2]){
   const rows=await query<Conversation>("SELECT id,store_id,phone,mode FROM agent_conversations WHERE id=$1",[id]);
   if(!rows[0])return responseError(res,404,"Conversa inexistente");
   const messages=await query<{role:string;text:string;created_at:string}>("SELECT role,text,created_at FROM agent_messages WHERE conversation_id=$1 ORDER BY created_at DESC LIMIT 80",[id]);
   return respondJson(res,200,{conversation:rows[0],messages:messages.reverse()});
  }
  if(method==="PUT"&&match[2]==="mode"){
   const body=await requestJson(req);
   if(body.mode!=="ai"&&body.mode!=="human")return responseError(res,400,"Modo inválido");
   await query("UPDATE agent_conversations SET mode=$2,updated_at=now() WHERE id=$1",[id,body.mode]);
   return respondJson(res,200,{ok:true});
  }
 }
 return responseError(res,404,"Rota inexistente");
}

type MetaMessage={id?:string;from?:string;type?:string;text?:{body?:string};audio?:{id?:string}};
async function webhook(req:IncomingMessage,res:ServerResponse,url:URL){
 if(req.method==="GET"){
  const ok=url.searchParams.get("hub.mode")==="subscribe"&&
    safeEqual(url.searchParams.get("hub.verify_token")||"",config.META_VERIFY_TOKEN);
  if(!ok)return responseError(res,403,"Token de verificação inválido");
  res.writeHead(200,{"Content-Type":"text/plain"});res.end(url.searchParams.get("hub.challenge")||"");return;
 }
 if(req.method!=="POST")return responseError(res,405,"Método inválido");
 const body=await rawBody(req);
 if(!validMetaSignature(body,req.headers["x-hub-signature-256"] as string|undefined))return responseError(res,401,"Assinatura inválida");
 const data=JSON.parse(body.toString("utf8")) as {entry?:{changes?:{value?:{metadata?:{phone_number_id?:string};messages?:MetaMessage[]}}[]}[]};
 if(data.entry)for(const entry of data.entry)for(const change of entry.changes||[]){
  const phoneId=change.value?.metadata?.phone_number_id;
  if(!phoneId)continue;
  for(const message of change.value?.messages||[]){
   if(!message.id||!message.from||!/^\d{8,16}$/.test(message.from))continue;
   if(message.type!=="text"&&message.type!=="audio")continue;
   await query("INSERT INTO agent_inbound_events(id,store_phone_id,sender,event) VALUES($1,$2,$3,$4::jsonb) ON CONFLICT (id) DO NOTHING",
    [message.id,phoneId,message.from,JSON.stringify(message)]);
  }
 }
 return respondJson(res,200,{received:true});
}
async function handleInbound(row:{id:string;store_phone_id:string;sender:string;event:MetaMessage}){
 const [store]=await query<Store>("SELECT * FROM agent_stores WHERE whatsapp_phone_id=$1",[row.store_phone_id]);
 if(!store||!store.enabled||!store.whatsapp_token_enc)return;
 const message=row.event;
 let text=message.type==="text"?(message.text?.body||""):message.audio?.id?await transcribeAudio(store,message.audio.id):"";
 text=text.trim().slice(0,3000);if(!text)return;
 const upsert=await query<Conversation>("INSERT INTO agent_conversations(id,store_id,phone) VALUES($1,$2,$3) ON CONFLICT (store_id,phone) DO UPDATE SET updated_at=NOW() RETURNING id,store_id,phone,mode",
  [randomUUID(),store.id,row.sender]);
 const conv=upsert[0];
 await query("INSERT INTO agent_messages(id,conversation_id,role,text,provider_message_id) VALUES($1,$2,'user',$3,$4) ON CONFLICT (provider_message_id) DO NOTHING",
  [randomUUID(),conv.id,text,row.id]);
 if(conv.mode==="human")return;
 if(/\b(atendente|humano|pessoa de verdade|falar com uma pessoa)\b/i.test(text)){
  await query("UPDATE agent_conversations SET mode='human' WHERE id=$1",[conv.id]);
  const reply="Claro! Vou deixar essa conversa com a equipe da loja. Assim que alguém puder, dá continuidade por aqui.";
  await sendText(store,row.sender,reply);
  await query("INSERT INTO agent_messages(id,conversation_id,role,text) VALUES($1,$2,'assistant',$3)",[randomUUID(),conv.id,reply]);
  return;
 }
 const messages=await query<{role:string;text:string}>("SELECT role,text FROM (SELECT role,text,created_at FROM agent_messages WHERE conversation_id=$1 ORDER BY created_at DESC LIMIT 16) t ORDER BY created_at ASC",[conv.id]);
 const reply=await respond(store,messages);
 await sendText(store,row.sender,reply.text);
 await query("INSERT INTO agent_messages(id,conversation_id,role,text) VALUES($1,$2,'assistant',$3)",[randomUUID(),conv.id,reply.text]);
 // Each product gets a separate text message: WhatsApp shows an image-rich
 // clickable link preview card instead of a detached photo attachment.
 for(const link of reply.productLinks.slice(0,3)){
  await sendText(store,row.sender,link);
  await query("INSERT INTO agent_messages(id,conversation_id,role,text) VALUES($1,$2,'assistant',$3)",[randomUUID(),conv.id,link]);
 }
}
let running=false;
async function work(){
 if(running)return;running=true;
 try{
  const client=await pool.connect();
  let event:{id:string;store_phone_id:string;sender:string;event:MetaMessage}|undefined;
  try{
   await client.query("BEGIN");
   const result=await client.query("SELECT id,store_phone_id,sender,event FROM agent_inbound_events WHERE (state='queued' OR (state='processing' AND updated_at<now()-interval '2 minutes')) AND next_attempt<=now() ORDER BY next_attempt ASC LIMIT 1 FOR UPDATE SKIP LOCKED");
   event=result.rows[0];
   if(event)await client.query("UPDATE agent_inbound_events SET state='processing',attempts=attempts+1,updated_at=now() WHERE id=$1",[event.id]);
   await client.query("COMMIT");
  }catch(err){await client.query("ROLLBACK");throw err;}finally{client.release();}
  if(!event)return;
  try{
   await handleInbound(event);
   await query("UPDATE agent_inbound_events SET state='done',updated_at=now(),last_error=NULL WHERE id=$1",[event.id]);
  }catch(err){
   console.error("agent inbound failure",event.id,err instanceof Error?err.message:"unknown");
   await query("UPDATE agent_inbound_events SET state=CASE WHEN attempts>=5 THEN 'failed' ELSE 'queued' END,next_attempt=now()+interval '1 minute' * LEAST(30,attempts*attempts),updated_at=now(),last_error=$2 WHERE id=$1",
    [event.id,err instanceof Error?err.message.slice(0,250):"Unknown"]);
  }
 }catch(e){console.error("worker",e instanceof Error?e.message:"unknown");}finally{running=false;}
}
export async function handleAgentRequest(req: IncomingMessage, res: ServerResponse) {
 const url=new URL(req.url||"/",config.PUBLIC_BASE_URL);
 return handleAgentRoute(req,res,url);
}

async function handleAgentRoute(req:IncomingMessage,res:ServerResponse,url:URL){
 try{
  if(url.pathname==="/health"&&req.method==="GET")return respondJson(res,200,{ok:true});
  if(url.pathname==="/webhook/whatsapp")return await webhook(req,res,url);
  if(url.pathname.startsWith("/admin")){
   if(!authorized(req)){res.writeHead(401,{"WWW-Authenticate":'Basic realm="EComerce Sales Agents"',"Cache-Control":"no-store"});res.end("Autenticação necessária");return;}
   if(url.pathname==="/admin"&&req.method==="GET"){res.writeHead(200,{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","Content-Security-Policy":"default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'","X-Content-Type-Options":"nosniff"});res.end(renderDashboard());return;}
   return await adminApi(req,res,url);
  }
  responseError(res,404,"Não encontrado");
 }catch(e){
  console.error("agent request failed",e instanceof Error?e.message:"unknown");
  const msg=e instanceof Error?e.message:"Erro desconhecido";
  responseError(res,/JSON inválido|inválid|obrigatóri|URL HTTPS|extensas|incorreto/.test(msg)?400:500,
    /duplicate key value/.test(msg)?"Identificador do WhatsApp já cadastrado.":msg.startsWith("Corpo excedeu")?msg:"Não foi possível processar a solicitação.");
 }
}

let workerTimer: ReturnType<typeof setInterval> | undefined;
/** Starts the inbox worker once, within the same Node.js process as the storefront. */
export function startAgentWorker() {
 if(workerTimer) return;
 workerTimer=setInterval(()=>{void work();},2000);
 workerTimer.unref();
}
export async function stopAgentWorker() {
 if(workerTimer) {clearInterval(workerTimer);workerTimer=undefined;}
 await pool.end();
}

