import { randomBytes } from "node:crypto";
import { config } from "./config.js";
import { encrypt } from "./security.js";
import { pool, query, type Store } from "./db.js";

type SignupState = { id: string; store_id: string; expires_at: Date };
type Phone = { id: string; display_phone_number?: string; verified_name?: string };
const graph = () => "https://graph.facebook.com/" + config.META_GRAPH_VERSION;

async function graphJson(url: string, bearer?: string, init?: RequestInit): Promise<any> {
 const res = await fetch(url, { ...init, headers: {...(bearer ? { Authorization: "Bearer " + bearer } : {}), ...(init?.headers || {})}, redirect:"error", signal:AbortSignal.timeout(15000) });
 const body = await res.json().catch(() => ({}));
 if (!res.ok) throw new Error("Meta Graph API rejected operation ("+res.status+"): "+String(body?.error?.message || "unknown").slice(0,180));
 return body;
}
export async function prepareSignup(storeId: string) {
 if (!config.META_APP_ID || !config.META_CONFIG_ID || !config.META_APP_SECRET) throw new Error("Meta Embedded Signup is not configured on the server");
 const [store] = await query<Store>("SELECT * FROM agent_stores WHERE id=$1",[storeId]);
 if(!store) throw new Error("Store not found");
 const state=randomBytes(32).toString("hex");
 await query("INSERT INTO agent_signup_states(id,store_id,expires_at) VALUES($1,$2,now()+interval '10 minutes')",[state,storeId]);
 return { state, appId:config.META_APP_ID, configId:config.META_CONFIG_ID, graphVersion:config.META_GRAPH_VERSION };
}
export async function completeSignup(expectedStoreId:string,input:{state:string;code:string;wabaId:string;phoneId:string;pin?:string;coexistence?:boolean}) {
 if(!/^[a-f0-9]{64}$/.test(input.state)||!/^[A-Za-z0-9_\-]{4,2048}$/.test(input.code)||!/^[0-9]{6,25}$/.test(input.wabaId)||!/^[0-9]{6,25}$/.test(input.phoneId)) throw new Error("Invalid signup payload");
 const client=await pool.connect(); let state:SignupState;
 try {
  await client.query("BEGIN");
  const lock=await client.query<SignupState>("SELECT id,store_id,expires_at FROM agent_signup_states WHERE id=$1 FOR UPDATE",[input.state]);
  if(!lock.rows[0]||lock.rows[0].expires_at<=new Date()) { await client.query("ROLLBACK"); throw new Error("Expired or invalid signup state"); }
  if(lock.rows[0].store_id!==expectedStoreId){await client.query("ROLLBACK");throw new Error("Signup state does not belong to this store");}
  state=lock.rows[0];
  await client.query("DELETE FROM agent_signup_states WHERE id=$1",[input.state]);
  await client.query("COMMIT");
 } catch(err){await client.query("ROLLBACK").catch(()=>{});throw err;} finally{client.release();}
 // The authorization code is exchanged only server-side. Never trust WABA or phone IDs from the browser alone.
 const url=new URL(graph()+"/oauth/access_token");
 url.searchParams.set("client_id",config.META_APP_ID!);
 url.searchParams.set("client_secret",config.META_APP_SECRET);
 url.searchParams.set("code",input.code);
 const exchange=await graphJson(url.toString());
 const accessToken=String(exchange.access_token||"");
 if(!accessToken)throw new Error("Meta did not issue a business access token");
 const waba=await graphJson(graph()+"/"+input.wabaId+"?fields=id,name",accessToken);
 if(String(waba.id)!==input.wabaId)throw new Error("The WABA was not authorized");
 const phones=await graphJson(graph()+"/"+input.wabaId+"/phone_numbers?fields=id,display_phone_number,verified_name&limit=100",accessToken);
 const phone=(phones.data as Phone[]|undefined)?.find(p=>p.id===input.phoneId);
 if(!phone)throw new Error("The selected phone number does not belong to the authorized WABA");
 const existing=await query<{id:string}>("SELECT id FROM agent_stores WHERE whatsapp_phone_id=$1 AND id<>$2",[phone.id,state.store_id]);
 if(existing.length)throw new Error("This number is already connected to another store");
 // Subscribe this specific WABA to our app. Do not activate the bot if this fails.
 await graphJson(graph()+"/"+input.wabaId+"/subscribed_apps",accessToken,{method:"POST"});
 // Cloud API numbers normally require PIN registration. Coexistence numbers are registered by Meta's flow.
 if(!input.coexistence) {
  if(!input.pin||!/^[0-9]{6}$/.test(input.pin))throw new Error("A six-digit WhatsApp registration PIN is required");
  await graphJson(graph()+"/"+phone.id+"/register",accessToken,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messaging_product:"whatsapp",pin:input.pin})});
 }
 const normalized=(phone.display_phone_number||"").replace(/\D/g,"");
 if(!/^\d{8,16}$/.test(normalized))throw new Error("Invalid phone number returned by Meta");
 const updated=await pool.query("UPDATE agent_stores SET whatsapp_phone_id=$2,whatsapp_number=$3,whatsapp_token_enc=$4,waba_id=$5,enabled=true,updated_at=now() WHERE id=$1 RETURNING id",[state.store_id,phone.id,normalized,encrypt(accessToken),input.wabaId]);
 if(!updated.rowCount)throw new Error("Store not found");
 return {storeId:state.store_id,phoneNumber:normalized,wabaId:input.wabaId,phoneId:phone.id,connected:true};
}
export async function disconnectSignup(storeId:string) {
 const [store]=await query<Store & {waba_id:string|null}>("SELECT * FROM agent_stores WHERE id=$1",[storeId]);
 if(!store)throw new Error("Store not found");
 await query("UPDATE agent_stores SET enabled=false,updated_at=now() WHERE id=$1",[storeId]);
 return {storeId,enabled:false};
}
