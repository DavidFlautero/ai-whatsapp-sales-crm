import {test} from "node:test";
import assert from "node:assert/strict";
import {
  isSplitPaymentRequest,parseExactTransferCOP,splitPaymentQuote,splitQuoteMessage
} from "./restaurant-split-payment.service.js";
import {buildOrderSummary,type CheckoutDraft}
  from "./restaurant-whatsapp-checkout.service.js";
import {choosePaymentOrder} from "./restaurant-payment-intake.service.js";
import {notificationText} from "./restaurant-notifications.service.js";

test("mixed transfer with cash balance understood, but '40' remains ambiguous",()=>{
  assert.equal(isSplitPaymentRequest("te envio 40 por Bre-B y aqui el resto porfavor"),true);
  assert.equal(isSplitPaymentRequest("mixto"),true);
  assert.equal(isSplitPaymentRequest("pago dividido"),true);
  assert.equal(isSplitPaymentRequest("pago en efectivo"),false);
  assert.equal(parseExactTransferCOP("te envio 40 por Bre-B y aqui el resto"),null);
  assert.equal(parseExactTransferCOP("40000 COP"),40000);
  assert.equal(parseExactTransferCOP("40.000 COP"),40000);
  assert.equal(parseExactTransferCOP("40 mil COP"),40000);
  assert.equal(parseExactTransferCOP("40k"),40000);
});
test("transfer amount must be positive and leave positive cash remainder",()=>{
  assert.deepEqual(splitPaymentQuote(47500,40000),{transferCOP:40000,cashCOP:7500});
  assert.equal(splitPaymentQuote(47500,47500),null);
  assert.equal(splitPaymentQuote(47500,50000),null);
  assert.equal(splitPaymentQuote(47500,0),null);
  assert.equal(splitPaymentQuote(47500,NaN),null);
  assert.match(splitQuoteMessage(47500,40000),/7\.500/);
  assert.match(splitQuoteMessage(47500,40000),/CONFIRMAR DIVISIÓN/);
});
test("confirmed WhatsApp quote itemizes exact payment split",()=>{
  const draft:CheckoutDraft={
    id:"split-test",createdAt:new Date().toISOString(),
    stage:"confirm",menuRevision:1,items:[{productId:"burger",quantity:1}],
    customerName:"Prueba",mode:"pickup",payment:"mixed",splitTransferCOP:10000
  };
  const q=buildOrderSummary(draft,[{
    id:"burger",name:"Hamburguesa",priceCOP:18000,available:true
  }],[]);
  assert.equal(q.total,18000);
  assert.match(q.text,/Mixto: \$10\.000/);
  assert.match(q.text,/8\.000 en efectivo/);
});
test("receipt associates partial transfer with only one pending owned order",()=>{
  const order={
    id:"1",number:1,customer_phone:"573001234567",
    payment_method:"mixed",payment_status:"pending",
    status:"confirmed",total_cop:47500,created_at:new Date().toISOString()
  };
  assert.equal(choosePaymentOrder([order],"Pedido #1").order?.id,"1");
  assert.equal(choosePaymentOrder([order,{...order,id:"2",number:2}],"").order,null);
});
test("customer notification never calls a partial transfer fully paid",()=>{
  const order={
    id:"1",number:1,source:"whatsapp",status:"confirmed",
    payment_status:"cash_on_delivery",payment_method:"mixed",
    fulfillment_mode:"delivery" as const,customer_phone:"573001234567"
  };
  const text=notificationText(order,"payment_verified",{
    stage:"partial_transfer_approved",cash_due_cop:7500
  })!;
  assert.match(text,/7\.500/);
  assert.match(text,/efectivo/);
  assert.doesNotMatch(text,/pago completo|sin saldo pendiente/i);
  assert.equal(notificationText({...order,payment_status:"pending"},
    "payment_verified",{stage:"partial_transfer_approved",cash_due_cop:7500}),null);
});
