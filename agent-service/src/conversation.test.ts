import test from "node:test";
import assert from "node:assert/strict";
import type { Store } from "./db.js";
import type { GeminiContent, GeminiPart } from "./gemini.js";

Object.assign(process.env, {
  DATABASE_URL: "postgresql://test:test@localhost:5432/agent_test",
  MASTER_ENCRYPTION_KEY: "a".repeat(64),
  ADMIN_PASSWORD: "test-password-longer-than-16",
  META_APP_SECRET: "test-meta-secret",
  META_VERIFY_TOKEN: "test-verify-token",
  GEMINI_API_KEY: "test-key",
  PUBLIC_BASE_URL: "https://agents.example.com",
  ALLOWED_COMMERCE_HOSTS: "store-a.example.com",
});
const { respond } = await import("./ai.js");
const { encrypt } = await import("./security.js");
const store: Store = {
  id: "a",
  name: "Loja",
  store_url: "https://store-a.example.com",
  commerce_api_key_enc: encrypt("test-token"),
  whatsapp_phone_id: "12345678",
  whatsapp_number: "5511999999999",
  whatsapp_token_enc: "",
  enabled: true,
  preferences: { upsell: false },
};
type ModelRequest = {
  contents: GeminiContent[];
  systemInstruction: { parts: { text: string }[] };
  toolConfig?: { functionCallingConfig: { mode: string } };
};
const model = (parts: GeminiPart[]) =>
  Response.json({ candidates: [{ content: { role: "model", parts } }] });
const call = (
  name: string,
  args: Record<string, unknown>,
  id?: string,
  thoughtSignature?: string,
): GeminiPart => ({
  functionCall: { name, args, ...(id ? { id } : {}) },
  ...(thoughtSignature ? { thoughtSignature } : {}),
});
const product = {
  id: "pants",
  name: "Calça Alfaiataria Areia",
  slug: "calca-areia",
  shortDescription: "Calça de alfaiataria em tom areia",
  basePrice: 199.9,
  currency: "BRL",
  inStock: true,
  productTypeSlug: "roupas",
  status: "ACTIVE",
  image: null,
};
const snapshot = () => Response.json({ products: [product] });
const legacy = "Já conferi algumas opções. Quer que eu te ajude a escolher uma delas?";

test("four tool rounds end with concrete advice, retaining shirt context and verified links", async () => {
  const original = globalThis.fetch;
  const requests: ModelRequest[] = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.includes("generativelanguage.googleapis.com")) {
      const request = JSON.parse(String(init?.body)) as ModelRequest;
      requests.push(request);
      switch (requests.length) {
        case 1:
          return model([
            call(
              "buscar_produtos",
              { termo: "camisa azul" },
              "search-shirt",
              "signature-1",
            ),
          ]);
        case 2:
          return model([call("detalhes_produto", { produto_id: "shirt" })]);
        case 3:
          return model([call("buscar_produtos", { termo: "calça alfaiataria" })]);
        case 4:
          return model([
            call("compartilhar_produtos", { produto_ids: ["pants"] }, "share-pants"),
          ]);
        default:
          return model([
            {
              text: "Para a Camisa Azul, sugiro a Calça Alfaiataria Areia: o tom areia combina com o azul para um visual clássico. Ela está por R$ 199,90. Veja a peça no link a seguir.",
            },
          ]);
      }
    }
    if (url.endsWith("/products/shirt"))
      return Response.json({
        product: {
          id: "shirt",
          name: "Camisa Azul",
          status: "ACTIVE",
          assignments: [{ attributeName: "Cor", value: "Azul" }],
        },
      });
    if (url.endsWith("/products/pants")) return Response.json({ product });
    if (url.includes("q=camisa"))
      return Response.json({ products: [{ id: "shirt", name: "Camisa Azul" }] });
    if (url.includes("/api/agent/v1/products?")) return snapshot();
    throw Error("Unexpected network");
  };
  try {
    const history = [
      { role: "assistant", text: "Você escolheu a Camisa Azul." },
      { role: "assistant", text: "https://store-a.example.com/produtos/camisa-azul" },
      { role: "user", text: "Tem algo que combine com essa camisa?" },
    ];
    const reply = await respond(store, history);
    assert.match(reply.text, /Calça Alfaiataria Areia/);
    assert.match(reply.text, /R\$ 199,90/);
    assert.doesNotMatch(reply.text, /Quer que eu/);
    assert.deepEqual(reply.productLinks, [
      "https://store-a.example.com/produtos/calca-areia",
    ]);
    assert.equal(requests.length, 5);
    assert.equal(requests[4].toolConfig?.functionCallingConfig.mode, "NONE");
    assert.ok(JSON.stringify(requests[4].contents).includes("Camisa Azul"));
    assert.match(
      requests[0].systemInstruction.parts[0].text,
      /pedido explícito.*preferência de sugestões espontâneas/,
    );
    const signature = requests[4].contents
      .flatMap((content) => content.parts)
      .find((part) => part.functionCall?.id === "search-shirt");
    assert.equal(signature?.thoughtSignature, "signature-1");
    const response = requests[4].contents
      .flatMap((content) => content.parts)
      .find((part) => part.functionResponse?.id === "share-pants");
    assert.deepEqual(response?.functionResponse?.response.products, [
      { id: "pants", name: product.name },
    ]);
  } finally {
    globalThis.fetch = original;
  }
});

test("identical tool calls are cached and end the loop instead of exhausting all rounds", async () => {
  const original = globalThis.fetch;
  let modelCalls = 0,
    searchCalls = 0;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.includes("generativelanguage.googleapis.com")) {
      modelCalls++;
      const request = JSON.parse(String(init?.body)) as ModelRequest;
      if (request.toolConfig?.functionCallingConfig.mode === "NONE")
        return model([
          { text: "Uma opção consultada é a Calça Alfaiataria Areia, por R$ 199,90." },
        ]);
      return model([call("buscar_produtos", { termo: "calça" }, "lookup-" + modelCalls)]);
    }
    if (url.includes("q=")) searchCalls++;
    return snapshot();
  };
  try {
    const reply = await respond(store, [
      { role: "user", text: "Tem algo que combine com essa camisa?" },
    ]);
    assert.match(reply.text, /Calça Alfaiataria/);
    assert.equal(searchCalls, 1);
    assert.equal(modelCalls, 3);
  } finally {
    globalThis.fetch = original;
  }
});

test("short confirmation retains the earlier request and rejects the old repeated reply", async () => {
  const original = globalThis.fetch;
  const requests: ModelRequest[] = [];
  globalThis.fetch = async (input, init) => {
    if (String(input).includes("generativelanguage.googleapis.com")) {
      requests.push(JSON.parse(String(init?.body)) as ModelRequest);
      if (requests.length === 1) return model([{ text: legacy }]);
      return model([
        {
          text: "Para combinar com a Camisa Azul, uma opção do catálogo é a Calça Alfaiataria Areia. Você prefere um visual casual ou social?",
        },
      ]);
    }
    return snapshot();
  };
  try {
    const history = [
      { role: "assistant", text: "Você escolheu a Camisa Azul." },
      { role: "user", text: "Tem algo que combine com essa camisa?" },
      { role: "assistant", text: legacy },
      { role: "user", text: "Sin por isso perguntei" },
    ];
    const reply = await respond(store, history);
    assert.match(reply.text, /Calça Alfaiataria/);
    assert.notEqual(reply.text, legacy);
    assert.equal(requests.length, 2);
    const contents = JSON.stringify(requests[1].contents);
    assert.ok(contents.includes("Tem algo que combine com essa camisa?"));
    assert.ok(contents.includes("Sin por isso perguntei"));
    assert.equal(requests[1].toolConfig?.functionCallingConfig.mode, "NONE");
  } finally {
    globalThis.fetch = original;
  }
});

test("a repeated natural-language answer is regenerated instead of sent again", async () => {
  const original = globalThis.fetch;
  let count = 0;
  globalThis.fetch = async (input) => {
    if (String(input).includes("generativelanguage.googleapis.com"))
      return model([
        {
          text:
            ++count === 1
              ? "Quer ver algumas opções?"
              : "Uma opção do catálogo é a Calça Alfaiataria Areia, por R$ 199,90.",
        },
      ]);
    return snapshot();
  };
  try {
    const reply = await respond(store, [
      { role: "assistant", text: "Quer ver algumas opções?" },
      { role: "user", text: "Sim, por isso perguntei" },
    ]);
    assert.match(reply.text, /Calça Alfaiataria/);
    assert.equal(count, 2);
  } finally {
    globalThis.fetch = original;
  }
});

test("synthesis failure still names verified products without inventing attributes or prices", async () => {
  const original = globalThis.fetch;
  let count = 0;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes("generativelanguage.googleapis.com")) {
      if (++count === 1)
        return model([call("compartilhar_produtos", { produto_ids: ["pants"] })]);
      return new Response(null, { status: 503 });
    }
    if (url.endsWith("/products/pants")) return Response.json({ product });
    return snapshot();
  };
  try {
    const reply = await respond(store, [{ role: "user", text: "Me mostre uma calça" }]);
    assert.match(reply.text, /Calça Alfaiataria Areia/);
    assert.doesNotMatch(reply.text, /Quer que|R\$/);
    assert.equal(reply.productLinks.length, 1);
  } finally {
    globalThis.fetch = original;
  }
});

test("unavailable products and empty synthesis never become invented recommendations", async () => {
  const original = globalThis.fetch;
  let count = 0;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes("generativelanguage.googleapis.com")) {
      if (++count === 1)
        return model([call("compartilhar_produtos", { produto_ids: ["pants"] })]);
      return model([{ text: "" }]);
    }
    if (url.endsWith("/products/pants"))
      return Response.json({ product: { ...product, status: "DRAFT" } });
    return Response.json({ products: [] });
  };
  try {
    const reply = await respond(store, [{ role: "user", text: "Quero opções" }]);
    assert.deepEqual(reply.productLinks, []);
    assert.doesNotMatch(reply.text, /Calça Alfaiataria|Já conferi|Quer que/);
    assert.match(reply.text, /Não consegui confirmar/);
  } finally {
    globalThis.fetch = original;
  }
});

test("missing reference prompts a specific question rather than pretending to know the shirt", async () => {
  const original = globalThis.fetch;
  let prompt = "";
  globalThis.fetch = async (input, init) => {
    if (String(input).includes("generativelanguage.googleapis.com")) {
      prompt = (JSON.parse(String(init?.body)) as ModelRequest).systemInstruction.parts[0]
        .text;
      return model([
        { text: "Qual é o nome ou o link da camisa que você quer combinar?" },
      ]);
    }
    return snapshot();
  };
  try {
    const reply = await respond(store, [
      { role: "user", text: "Tem algo que combine com essa camisa?" },
    ]);
    assert.match(reply.text, /nome ou o link da camisa/);
    assert.match(prompt, /Nunca invente a cor, o estilo ou a peça/);
    assert.deepEqual(reply.productLinks, []);
  } finally {
    globalThis.fetch = original;
  }
});

test("repeated checkout tool calls do not create duplicate links and cache resets next interaction", async () => {
  const original = globalThis.fetch;
  let checkouts = 0;
  let requests = 0;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.includes("generativelanguage.googleapis.com")) {
      const request = JSON.parse(String(init?.body)) as ModelRequest;
      if (request.toolConfig?.functionCallingConfig.mode === "NONE")
        return model([
          { text: "O link de checkout está pronto para você concluir a compra na loja." },
        ]);
      return model([
        call("criar_checkout", {
          itens: [
            ++requests % 2
              ? { variante_id: "v1", quantidade: 1 }
              : { quantidade: 1, variante_id: "v1" },
          ],
        }),
      ]);
    }
    if (url.endsWith("/checkout-links")) {
      checkouts++;
      return Response.json({ url: "https://store-a.example.com/agent-checkout/test" });
    }
    return snapshot();
  };
  try {
    await respond(store, [
      {
        role: "user",
        text: "Confirmo a variante v1, uma unidade. Pode gerar o checkout.",
      },
    ]);
    assert.equal(checkouts, 1);
    await respond(store, [
      { role: "user", text: "Quero outro checkout da variante v1, uma unidade." },
    ]);
    assert.equal(checkouts, 2);
  } finally {
    globalThis.fetch = original;
  }
});

test("unexpected tool calls in the final text-only turn are never executed", async () => {
  const original = globalThis.fetch;
  let modelCalls = 0,
    checkoutCalls = 0;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes("generativelanguage.googleapis.com")) {
      if (++modelCalls === 1)
        return model([call("compartilhar_produtos", { produto_ids: ["pants"] })]);
      return model([
        call("criar_checkout", { itens: [{ variante_id: "v1", quantidade: 1 }] }),
      ]);
    }
    if (url.endsWith("/products/pants")) return Response.json({ product });
    if (url.endsWith("/checkout-links")) checkoutCalls++;
    return snapshot();
  };
  try {
    const reply = await respond(store, [{ role: "user", text: "Mostre uma calça" }]);
    assert.match(reply.text, /Calça Alfaiataria Areia/);
    assert.equal(reply.productLinks.length, 1);
    assert.equal(checkoutCalls, 0);
  } finally {
    globalThis.fetch = original;
  }
});
