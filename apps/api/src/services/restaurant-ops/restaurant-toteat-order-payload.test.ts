import {test} from "node:test";
import assert from "node:assert/strict";
import {makeToteatOrderPayload,serializeToteatExternalOrder,type ToteatExportOrder}
 from "./restaurant-toteat-order-payload.service.js";
import type {ToteatPreparation} from "./restaurant-toteat-preparation.service.js";
const id="123e4567-e89b-42d3-a456-426614174000";
const order:ToteatExportOrder={
  id,company_id:"delibocados",source:"whatsapp",status:"confirmed",
  customer_name:"Cliente Prueba",payment_method:"cash",payment_status:"cash_on_delivery",
  fulfillment_mode:"pickup",subtotal_cop:8001,delivery_fee_cop:0,total_cop:8001
};
const preparation:ToteatPreparation={ready:true,orderReference:"delibocados-"+id,
  kind:"pickup",lines:[{productCode:"DB1132",quantity:1,priceCOP:8001,comment:"SIN CEBOLLA"}],
  subtotalCOP:8001,deliveryFeeCOP:0,totalCOP:8001};
function build(o=order,p=preparation,extra:Record<string,unknown>={}){
 return makeToteatOrderPayload({order:o,preparation:p,
   restaurantId:"9450186157992447",localNumber:"1",
   lineProductNames:["Chicharrón Porción"],nowISO:"2026-11-10T20:10:00.000Z",...extra});
}
test("pending cash pickup uses exact existing successful Toteat document structure",()=>{
 const r=build();
 assert.equal(r.ready,true);
 if(!r.ready)return;
 assert.equal(r.value.type,"pickup");
 assert.equal(r.value.document.line[0].productCode,"DB1132");
 assert.equal(r.value.document.line[0].productName,"Chicharrón Porción");
 assert.equal(r.value.document.payments[0].pending,true);
 assert.equal(r.value.document.payments[0].amountPaid,0);
 assert.equal(r.value.document.payments[0].amount,8001);
 const raw=serializeToteatExternalOrder(r.value);
 assert.match(raw,/"restaurantId":9450186157992447/);
 assert.match(raw,/"orderReference":"delibocados-/);
});
test("transfer with screenshot pending and cross-tenant are blocked",()=>{
 assert.deepEqual(build({...order,payment_method:"transfer",payment_status:"proof_submitted"}),
   {ready:false,reason:"PAYMENT_NOT_VERIFIED"});
 assert.equal(build({...order,company_id:"other"}).ready,false);
 assert.equal(build({...order,source:"qr"}).ready,false);
});
test("verified transfer receives correct payment type",()=>{
 const r=build({...order,payment_method:"transfer",payment_status:"verified"});
 assert.equal(r.ready,true);
 if(r.ready){
   assert.equal(r.value.document.payments[0].paymentType,9001);
   assert.equal(r.value.document.payments[0].amountPaid,8001);
   assert.equal(r.value.document.payments[0].pending,false);
 }
});
test("delivery requires actual verified fee code and matching exact total",()=>{
 const o={...order,fulfillment_mode:"delivery",address:"Carrera 1 #12, Funza",
   total_cop:10001,delivery_fee_cop:2000};
 const p:ToteatPreparation={...preparation,kind:"delivery",deliveryFeeCOP:2000,totalCOP:10001};
 assert.deepEqual(build(o,p),{ready:false,reason:"DELIVERY_FEE_PRODUCT_NOT_VERIFIED"});
 const result=build(o,p,{deliveryFeeProduct:{
   productCode:"FEE01",productName:"Domicilio verificado",priceCOP:2000
 }});
 assert.equal(result.ready,true);
 if(result.ready){
  assert.equal(result.value.document.line.length,2);
  assert.equal(result.value.document.line[1].amountAfterTax,2000);
  assert.equal(result.value.document.payments[0].amount,10001);
 }
});
test("mixed payment requires bank-verified split, never trusts proof alone",()=>{
 const o={...order,payment_method:"mixed"};
 assert.equal(build(o).ready,false);
 const r=build(o,preparation,{split:{
   transfer_due_cop:5001,cash_due_cop:3000,
   transfer_verified_cop:5001,cash_collected_cop:0
 }});
 assert.equal(r.ready,true);
 if(r.ready){
  assert.equal(r.value.document.payments.length,2);
  assert.equal(r.value.document.payments[0].paymentType,9001);
  assert.equal(r.value.document.payments[1].pending,true);
 }
});
