import test from "node:test";
import assert from "node:assert/strict";

Object.assign(process.env, {
 DATABASE_URL:"postgresql://test:test@localhost:5432/agent_test",
 MASTER_ENCRYPTION_KEY:"a".repeat(64),
 ADMIN_PASSWORD:"test-password-longer-than-16",
 META_APP_SECRET:"test-meta-secret",
 META_VERIFY_TOKEN:"test-verify-token",
 META_GRAPH_VERSION:"v24.0",
 GEMINI_API_KEY:"gemini-test-api-key",
 GEMINI_MODEL:"gemini-2.5-flash",
 PUBLIC_BASE_URL:"https://agents.example.com",
 ALLOWED_COMMERCE_HOSTS:"store-a.example.com",
});
const { generateGemini, outputText } = await import("./gemini.js");
const { respond } = await import("./ai.js");
const { encrypt } = await import("./security.js");
const { transcribeAudio } = await import("./whatsapp.js");

test("Gemini requests use x-goog-api-key and generateContent, never OpenAI", async () => {
 const original=globalThis.fetch;
 let endpoint="", key="", payload:any;
 globalThis.fetch=async(input,init)=>{
  endpoint=String(input);key=new Headers(init?.headers).get("x-goog-api-key")??"";
  payload=JSON.parse(String(init?.body));
  return Response.json({candidates:[{content:{role:"model",parts:[{text:"Olá, posso ajudar!"}]}}]});
 };
 try {
  const answer=await generateGemini([{role:"user",parts:[{text:"Olá"}]}],{systemInstruction:"Seja cordial"});
  assert.match(endpoint,/generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-2\.5-flash:generateContent$/);
  assert.equal(key,"gemini-test-api-key");
  assert.equal(payload.systemInstruction.parts[0].text,"Seja cordial");
  assert.equal(outputText(answer),"Olá, posso ajudar!");
 }finally{globalThis.fetch=original;}
});

test("sales agent completes Gemini function call and returns grounded response", async () => {
 const original=globalThis.fetch;
 let phase=0, lastRequest:any;
 globalThis.fetch=async(input,init)=>{
  const address=String(input);
  if(address.includes("generativelanguage.googleapis.com")){
   phase++;
   lastRequest=JSON.parse(String(init?.body));
   if(phase===1)return Response.json({candidates:[{content:{role:"model",parts:[
    {functionCall:{name:"buscar_produtos",args:{termo:"vestido"}}}
   ]}}]});
   return Response.json({candidates:[{content:{role:"model",parts:[{text:"Encontrei um vestido para você."}]}}]});
  }
  if(address.includes("store-a.example.com/api/agent/v1/"))return Response.json({items:[{name:"Vestido elegante"}]});
  throw Error("Unexpected network URL: "+address);
 };
 const store={id:"a",name:"Boutique",store_url:"https://store-a.example.com",
  commerce_api_key_enc:encrypt("internal-test-token"),whatsapp_phone_id:"12345678",
  whatsapp_number:"5511999999999",whatsapp_token_enc:"",enabled:true,preferences:{}};
 try {
  const answer=await respond(store,[{role:"user",text:"Quero um vestido"}]);
  assert.equal(answer,"Encontrei um vestido para você.");
  assert.equal(phase,2);
  assert.equal(lastRequest.contents[1].role,"model");
  assert.equal(lastRequest.contents[1].parts[0].functionCall.name,"buscar_produtos");
  assert.equal(lastRequest.contents[2].parts[0].functionResponse.name,"buscar_produtos");
 }finally{globalThis.fetch=original;}
});

test("WhatsApp OGG is sent as inline audio to Gemini for transcription",async()=>{
 const original=globalThis.fetch;
 let audioRequest:any, called=0;
 globalThis.fetch=async(input,init)=>{
  const address=String(input);called++;
  if(address.includes("graph.facebook.com"))return Response.json({url:"https://lookaside.fbsbx.com/test-audio",mime_type:"audio/ogg; codecs=opus"});
  if(address.includes("lookaside.fbsbx.com"))return new Response(Buffer.from("mock-ogg-audio"),{status:200});
  if(address.includes("generativelanguage.googleapis.com")){
   audioRequest=JSON.parse(String(init?.body));
   return Response.json({candidates:[{content:{role:"model",parts:[{text:"Gostaria de uma camisa."}]}}]});
  }
  throw Error("Unexpected network");
 };
 const store={id:"a",name:"Boutique",store_url:"https://store-a.example.com",
  commerce_api_key_enc:encrypt("internal-test-token"),whatsapp_phone_id:"12345678",
  whatsapp_number:"5511999999999",whatsapp_token_enc:encrypt("whatsapp-test-token"),enabled:true,preferences:{}};
 try {
  const answer=await transcribeAudio(store,"media-123");
  assert.equal(answer,"Gostaria de uma camisa.");
  assert.equal(audioRequest.contents[0].parts[1].inlineData.mimeType,"audio/ogg");
  assert.equal(Buffer.from(audioRequest.contents[0].parts[1].inlineData.data,"base64").toString(),"mock-ogg-audio");
  assert.equal(called,3);
 }finally{globalThis.fetch=original;}
});
