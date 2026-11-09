import {test} from "node:test";
import assert from "node:assert/strict";
import {buildSingleTestOrder,serializeExactToteatTestOrder,parseToteatTestReceipt}
  from "./restaurant-toteat-test-order.service.js";
const uuid="123e4567-e89b-42d3-a456-426614174000";
test("unique pickup test order with one exact published SKU and pending cash",()=>{
  const order=buildSingleTestOrder({restaurantId:"9450186157992447",localNumber:"1"},
    uuid,"2026-11-10T00:15:00.000Z");
  assert.equal(order.orderReference,"delibocados-prueba-"+uuid);
  assert.equal(order.type,"pickup");
  assert.equal(order.document.line.length,1);
  assert.equal(order.document.line[0].productCode,"DB1132");
  assert.equal(order.document.line[0].amountAfterTax,8001);
  assert.equal(order.document.payments[0].pending,true);
  assert.equal(order.document.payments[0].amountPaid,0);
  const raw=serializeExactToteatTestOrder(order);
  assert.match(raw,/"restaurantId":9450186157992447[,}]/);
  assert.equal(JSON.parse(raw).orderReference,order.orderReference);
});
test("preserves unsafe numeric Toteat order ID exactly",()=>{
 const r=parseToteatTestReceipt(
  '{"ok":true,"orderExp":{"orderId":9450186157992447}}',200);
 assert.equal(r.outcome,"accepted");
 assert.equal(r.externalOrderId,"9450186157992447");
});
test("ambiguous provider responses never become a safe retry",()=>{
 assert.equal(parseToteatTestReceipt("<html>error</html>",502).outcome,"unknown");
 assert.equal(parseToteatTestReceipt('{"ok":false}',400).outcome,"rejected");
 assert.equal(parseToteatTestReceipt('{"ok":true}',200).externalOrderId,null);
 assert.equal(parseToteatTestReceipt('{"ok":false}',200).outcome,"unknown");
 assert.equal(parseToteatTestReceipt('{"ok":false}',429).outcome,"unknown");
});
