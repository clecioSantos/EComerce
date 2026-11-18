import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

// Configure inert test credentials before importing modules that parse environment variables.
Object.assign(process.env, {
 DATABASE_URL:"postgresql://test:test@localhost:5432/agent_test",
 MASTER_ENCRYPTION_KEY:"a".repeat(64),
 ADMIN_PASSWORD:"test-password-longer-than-16",
 META_APP_SECRET:"test-meta-secret",
 META_VERIFY_TOKEN:"test-verify-token",
 META_GRAPH_VERSION:"v24.0",
 GEMINI_API_KEY:"test-api-key",
 GEMINI_MODEL:"test-model",
 PUBLIC_BASE_URL:"https://agents.example.com",
 ALLOWED_COMMERCE_HOSTS:"store-a.example.com,store-b.example.com",
 NODE_ENV:"production",
});
const { encrypt, decrypt, safeEqual, validMetaSignature } = await import("./security.js");
const { validateCommerceUrl } = await import("./commerce-security.js");
const { searchProducts, getProduct, generateCheckout } = await import("./commerce.js");

test("AES-GCM round-trip for UTF-8 credentials and randomized ciphertext", () => {
 const secret="token-ç-🔐-".repeat(20);
 const a=encrypt(secret), b=encrypt(secret);
 assert.notEqual(a,b);
 assert.equal(decrypt(a),secret);
 assert.equal(decrypt(b),secret);
});
test("AES-GCM rejects ciphertext, nonce and tag tampering", () => {
 const encrypted=encrypt("sensitive token");
 const chunks=encrypted.split(".");
 for (let index=0;index<3;index++) {
  const copy=[...chunks];
  copy[index]=(copy[index][0]==="a"?"b":"a")+copy[index].slice(1);
  assert.throws(()=>decrypt(copy.join(".")));
 }
 for (const invalid of ["","abc","a.b.c",".".repeat(4)]) assert.throws(()=>decrypt(invalid));
});
test("timing-safe comparison returns correct outcome for unequal lengths and Unicode", () => {
 assert.equal(safeEqual("abc","abc"),true);
 assert.equal(safeEqual("abc","abd"),false);
 assert.equal(safeEqual("abc","abcd"),false);
 assert.equal(safeEqual("á","a"),false);
});
test("Meta webhook requires exact HMAC SHA-256 of raw body", () => {
 const raw=Buffer.from('{"entry":[{"id":"123"}]}');
 const signature="sha256="+createHmac("sha256",process.env.META_APP_SECRET!).update(raw).digest("hex");
 assert.equal(validMetaSignature(raw,signature),true);
 assert.equal(validMetaSignature(Buffer.from(raw.toString().replace("123","124")),signature),false);
 for(const invalid of [undefined,"","sha1="+signature.slice(7),signature.toUpperCase(),signature.slice(0,-2)+"aa"])
  assert.equal(validMetaSignature(raw,invalid),false);
});
test("commerce URL permits only explicitly allowed HTTPS roots", () => {
 for(const host of ["store-a.example.com","store-b.example.com"])
  assert.equal(validateCommerceUrl("https://"+host+"/").hostname,host);
 const bad=[
 "http://store-a.example.com", "https://evil.example.com", "https://store-a.example.com.evil.example",
 "https://127.0.0.1", "https://localhost", "https://[::1]",
 "https://user:pass@store-a.example.com", "https://store-a.example.com/path",
 "https://store-a.example.com/?token=1", "https://store-a.example.com/#frag",
 "https://store-a.example.com@evil.example", "file:///etc/passwd",
 "https://169.254.169.254", "https://store-a.example.com:443/path",
 ];
 for(const url of bad) assert.throws(()=>validateCommerceUrl(url),url);
});
test("agent sends only authenticated requests to the selected store with encoded parameters", async () => {
 const original=globalThis.fetch;
 const calls:{url:string;authorization:string;method:string;body?:string}[]=[];
 globalThis.fetch=async (input, init) => {
  const headers=new Headers(init?.headers);
  calls.push({url:String(input),authorization:headers.get("authorization")||"",method:init?.method||"GET",body:init?.body?.toString()});
  return new Response(JSON.stringify({ok:true}),{status:200,headers:{"content-type":"application/json"}});
 };
 try {
  const store={
   id:"store-a",name:"A",store_url:"https://store-a.example.com",
   commerce_api_key_enc:encrypt("key-A"),whatsapp_phone_id:"12345678",
   whatsapp_number:"5511999999999",whatsapp_token_enc:"",enabled:true,preferences:{},
  };
  await searchProducts(store,"tênis & black?x=1");
  await getProduct(store,"id/with?special");
  await generateCheckout(store,[{variantId:"variant-A",quantity:2}]);
  assert.equal(calls.length,3);
  assert.ok(calls.every(c=>c.url.startsWith("https://store-a.example.com/api/agent/v1/")));
  assert.ok(calls.every(c=>c.authorization==="Bearer key-A"));
  assert.match(calls[0].url,/t%C3%AAnis/);
  assert.ok(!calls[0].url.includes("black?x=1"));
  assert.equal(calls[2].method,"POST");
  assert.deepEqual(JSON.parse(calls[2].body!),{items:[{variantId:"variant-A",quantity:2}]});
 } finally {globalThis.fetch=original;}
});
test("rejects untrusted shop origin before any network call or token leakage",async()=>{
 const original=globalThis.fetch;
 let calls=0;
 globalThis.fetch=async()=>{calls++;throw Error("unexpected network");};
 try {
  const store={
   id:"store-a",name:"A",store_url:"https://attacker.example.net",
   commerce_api_key_enc:encrypt("secret"),whatsapp_phone_id:"123",
   whatsapp_number:"5511999999999",whatsapp_token_enc:"",enabled:true,preferences:{},
  };
  await assert.rejects(searchProducts(store,"item"));
  assert.equal(calls,0);
 }finally{globalThis.fetch=original;}
});
