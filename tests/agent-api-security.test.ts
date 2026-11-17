import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks=vi.hoisted(()=>({
  auth:vi.fn(),findProducts:vi.fn(),findVariants:vi.fn(),
  transaction:vi.fn(),createCart:vi.fn(),createCheckout:vi.fn(),
}));
vi.mock("@/lib/agent-api/auth",()=>({
 authenticateAgent:mocks.auth,
 agentError:()=>Response.json({error:"Não autorizado."},{status:401}),
}));
vi.mock("@/lib/db/prisma",()=>({
 prisma:{
  product:{findMany:mocks.findProducts},
  productVariant:{findMany:mocks.findVariants},
  $transaction:mocks.transaction,
 },
}));
vi.mock("@/modules/products/product.service",()=>({
 mapProductSummary:(p:unknown)=>p,
 productSummaryInclude:{},
}));

import { GET as listProducts } from "@/app/api/agent/v1/products/route";
import { POST as createLink } from "@/app/api/agent/v1/checkout-links/route";

const request=(path:string)=>new Request("https://store.example.com"+path);
const post=(items:unknown)=>new Request("https://store.example.com/api/agent/v1/checkout-links",{
 method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({items}),
});
beforeEach(()=>{
 vi.resetAllMocks();
 mocks.auth.mockResolvedValue({storeId:"store-A",credentialId:"credential-A"});
 mocks.findProducts.mockResolvedValue([]);
 mocks.findVariants.mockResolvedValue([]);
 mocks.transaction.mockImplementation(async(fn:(tx:unknown)=>Promise<unknown>)=>fn({
  cart:{create:mocks.createCart},
  agentCheckoutSession:{create:mocks.createCheckout},
 }));
 mocks.createCart.mockResolvedValue({id:"cart-A"});
 mocks.createCheckout.mockResolvedValue({});
});

describe("agent API tenant isolation",()=>{
 it("filters catalog by authenticated tenant, not a user-supplied storeId",async()=>{
  const res=await listProducts(request("/api/agent/v1/products?storeId=store-B&q=camisa&limit=8"));
  expect(res.status).toBe(200);
  expect(mocks.findProducts).toHaveBeenCalledWith(expect.objectContaining({
   where:expect.objectContaining({storeId:"store-A",status:"ACTIVE"}),take:8,
  }));
 });
 it("rejects invalid catalog limits before database access",async()=>{
  const res=await listProducts(request("/api/agent/v1/products?limit=999999"));
  expect(res.status).toBe(400);
  expect(mocks.findProducts).not.toHaveBeenCalled();
 });
 it("denies agent checkout for additional stores until tenant-safe storefront exists",async()=>{
  const res=await createLink(post([{variantId:"variant-A",quantity:1}]));
  expect(res.status).toBe(409);
  expect(mocks.findVariants).not.toHaveBeenCalled();
  expect(mocks.transaction).not.toHaveBeenCalled();
 });
 it("rejects variants not belonging to the authorized legacy store",async()=>{
  mocks.auth.mockResolvedValue({storeId:"legacy-store"});
  const res=await createLink(post([{variantId:"other-store-variant",quantity:1}]));
  expect(mocks.findVariants).toHaveBeenCalledWith(expect.objectContaining({
   where:expect.objectContaining({product:{storeId:"legacy-store",status:"ACTIVE"}}),
  }));
  expect(res.status).toBe(400);
  expect(mocks.transaction).not.toHaveBeenCalled();
 });
 it("rejects malformed checkout quantities and overlong baskets",async()=>{
  mocks.auth.mockResolvedValue({storeId:"legacy-store"});
  for(const items of [[{variantId:"variant-A",quantity:-1}],[{variantId:"variant-A",quantity:1.5}],Array(31).fill({variantId:"variant-A",quantity:1})]){
   const res=await createLink(post(items));
   expect(res.status).toBe(400);
  }
  expect(mocks.findVariants).not.toHaveBeenCalled();
 });
 it("rejects duplicated variants whose combined quantity exceeds allowed maximum",async()=>{
  mocks.auth.mockResolvedValue({storeId:"legacy-store"});
  const res=await createLink(post([{variantId:"variant-A",quantity:30},{variantId:"variant-A",quantity:30}]));
  expect(res.status).toBe(400);
  expect(mocks.findVariants).not.toHaveBeenCalled();
 });
 it("rejects insufficient inventory without creating a checkout",async()=>{
  mocks.auth.mockResolvedValue({storeId:"legacy-store"});
  mocks.findVariants.mockResolvedValue([{
   id:"variant-A",productId:"product-A",inventory:{allowBackorder:false,quantityOnHand:2,quantityReserved:2},
  }]);
  const res=await createLink(post([{variantId:"variant-A",quantity:1}]));
  expect(res.status).toBe(409);
  expect(mocks.transaction).not.toHaveBeenCalled();
 });
 it("creates checkout and session in one transaction for verified stock",async()=>{
  mocks.auth.mockResolvedValue({storeId:"legacy-store"});
  mocks.findVariants.mockResolvedValue([{
   id:"variant-A",productId:"product-A",inventory:{allowBackorder:false,quantityOnHand:10,quantityReserved:0},
  }]);
  const res=await createLink(post([{variantId:"variant-A",quantity:2}]));
  expect(res.status).toBe(201);
  expect(mocks.transaction).toHaveBeenCalledTimes(1);
  expect(mocks.createCart).toHaveBeenCalledWith(expect.objectContaining({
   data:expect.objectContaining({storeId:"legacy-store"}),
  }));
  expect(mocks.createCheckout).toHaveBeenCalledWith(expect.objectContaining({
   data:expect.objectContaining({storeId:"legacy-store",cartId:"cart-A"}),
  }));
  expect((await res.json()).checkoutUrl).toMatch(/\/agent-checkout\/[a-f0-9]{64}$/);
 });
});
