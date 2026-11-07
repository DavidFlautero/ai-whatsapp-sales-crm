import { test } from "node:test";
import assert from "node:assert/strict";
import { choosePaymentOrder,transferInstructions } from "./restaurant-payment-intake.service.js";
import { notificationText } from "./restaurant-notifications.service.js";

const now = new Date().toISOString();
const order = (n:number)=>({
  id:String(n),number:n,customer_phone:"573001234567",
  payment_method:"transfer",payment_status:"pending",
  status:"confirmed",total_cop:19000,created_at:now
});
test("receipt matches exactly one transfer order, no guesses with two orders",()=>{
  assert.equal(choosePaymentOrder([order(10)],"").order?.number,10);
  assert.equal(choosePaymentOrder([order(10),order(11)],"").problem,"MULTIPLE_PENDING_ORDERS");
  assert.equal(choosePaymentOrder([order(10),order(11)],"Pedido #11").order?.number,11);
  assert.equal(choosePaymentOrder([order(10),order(11)],"Pedido #99").order,null);
});
test("an unavailable or old order never accepts a new receipt",()=>{
  const old={...order(1),created_at:"2020-01-01T00:00:00.000Z"};
  assert.equal(choosePaymentOrder([old],"").order,null);
  assert.equal(choosePaymentOrder([{...order(1),payment_status:"verified"}],"").order,null);
});
test("COP transfer instructions reuse tenant configured account, not Argentine banking labels",()=>{
  const result=transferInstructions({
    company_id:"delibocados",currency:"COP",
    active:true,account_type:"bank_account",
    institution_name:"Banco de prueba",holder_name:"Comercio",
    account_number:"123456"
  },200,19000);
  assert.match(result,/19\.000 COP/);
  assert.match(result,/Banco de prueba/);
  assert.match(result,/123456/);
  assert.doesNotMatch(result,/CBU|CVU|CUIT/);
});
test("notification status follows real payment and kitchen progression",()=>{
  const base={id:"1",number:200,source:"whatsapp",status:"confirmed",
    payment_status:"pending",payment_method:"transfer",
    fulfillment_mode:"pickup" as const,customer_phone:"573001234567"};
  assert.equal(notificationText(base,"order_confirmed",{}),null);
  assert.match(notificationText({...base,payment_status:"proof_submitted"},"payment_proof_received",{})??"",/revisi/);
  assert.match(notificationText({...base,payment_status:"verified"},"payment_verified",{})??"",/cocina/);
  assert.match(notificationText({...base,status:"preparing",payment_status:"verified"},
    "order_status_changed",{status:"preparing"})??"",/preparando/);
  assert.equal(notificationText({...base,status:"completed"},"order_status_changed",{status:"preparing"}),null);
});
