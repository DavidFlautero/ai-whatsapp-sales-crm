import assert from "node:assert/strict";
import { test } from "node:test";
import { prepareToteatLines, type RegisteredOrder } from "./restaurant-toteat-preparation.service.js";

const order:RegisteredOrder={
  id:"0a916861-f222-4523-8f52-3d71be7d27a7",company_id:"delibocados",
  source:"whatsapp",status:"confirmed",payment_status:"cash_on_delivery",
  fulfillment_mode:"pickup",subtotal_cop:36000,delivery_fee_cop:0,total_cop:36000
};
const items=[{product_id:"burger",product_name:"Hamburguesa",
  quantity:2,unit_price_cop:18000,instructions:"SIN CEBOLLA"}];
const mappings=[{product_id:"burger",external_product_code:"T-012",active:true,
  reviewed_at:"2026-11-08T18:00:00Z"}];

test("prepares mapped lines with exact COP and stable order reference",()=>{
  assert.deepEqual(prepareToteatLines(order,items,mappings),{
    ready:true,kind:"pickup",orderReference:"delibocados-"+order.id,
    lines:[{productCode:"T-012",quantity:2,priceCOP:18000,comment:"SIN CEBOLLA"}],
    subtotalCOP:36000,deliveryFeeCOP:0,totalCOP:36000
  });
});
test("never guesses a mapping or accepts an inactive mapping",()=>{
  assert.deepEqual(prepareToteatLines(order,items,[]),
    {ready:false,reason:"PRODUCT_MAPPING_MISSING"});
  assert.deepEqual(prepareToteatLines(order,items,[{...mappings[0],active:false}]),
    {ready:false,reason:"PRODUCT_MAPPING_MISSING"});
  assert.deepEqual(prepareToteatLines(order,items,[{...mappings[0],reviewed_at:null}]),
    {ready:false,reason:"PRODUCT_MAPPING_MISSING"});
});
test("never exports other tenants, QR orders, unpaid transfers or unconfirmed orders",()=>{
  for(const patch of [
    {company_id:"other"},{source:"qr"},{payment_status:"proof_submitted"},
    {status:"cancelled"},{fulfillment_mode:"dine_in"}
  ]) {
    assert.equal(prepareToteatLines({...order,...patch},items,mappings).ready,false);
  }
});
test("rejects tampered totals and fake pickup fees",()=>{
  assert.deepEqual(prepareToteatLines({...order,total_cop:40000},items,mappings),
    {ready:false,reason:"TOTAL_MISMATCH"});
  assert.deepEqual(prepareToteatLines({...order,delivery_fee_cop:2000,total_cop:38000},items,mappings),
    {ready:false,reason:"PICKUP_DELIVERY_FEE_NOT_ZERO"});
});
test("delivery can be prepared when an already verified order has correct fee",()=>{
  const value=prepareToteatLines({...order,fulfillment_mode:"delivery",
    delivery_fee_cop:3000,total_cop:39000},items,mappings);
  assert.equal(value.ready,true);
  if(value.ready)assert.equal(value.kind,"delivery");
});
