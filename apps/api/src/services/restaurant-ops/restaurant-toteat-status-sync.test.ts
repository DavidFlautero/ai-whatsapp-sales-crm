import assert from "node:assert/strict";
import {test} from "node:test";
import {
  parseToteatOrderWebhook,toteatSafeTransition,toteatStateLabel
} from "./restaurant-toteat-status-sync.service.js";

const reference = "delibocados-01234567-89ab-4cde-8abc-0123456789ab";
function event(code:number) {
  return {reference,externalOrderId:"123456",deliveryStatusId:code,
    orderStatus:"OPEN",modificationDate:null};
}
test("webhook requires matching restaurant/local and Delibocados reference",()=>{
  const body={ok:true,restaurantId:123,localNumber:4,data:[
    {orderReference:reference,orderId:123456,orderStatus:"OPEN",deliveryStatusId:100}
  ]};
  const [status]=parseToteatOrderWebhook(body,"123","4");
  assert.equal(status.deliveryStatusId,100);
  assert.equal(status.reference,reference);
  assert.throws(()=>parseToteatOrderWebhook(body,"124","4"),/ENVELOPE/);
  assert.throws(()=>parseToteatOrderWebhook({...body,data:[
    {...body.data[0],orderReference:"other-tenant-1"}
  ]},"123","4"),/REFERENCE/);
});
test("only single-step verified transitions are permitted",()=>{
  assert.equal(toteatSafeTransition("confirmed","pickup",false,event(90)),null);
  assert.deepEqual(toteatSafeTransition("confirmed","pickup",false,event(100)),
    {nextStatus:"preparing",reason:"TOTEAT_PREPARING"});
  assert.equal(toteatSafeTransition("confirmed","pickup",false,event(110)),null);
  assert.deepEqual(toteatSafeTransition("preparing","pickup",false,event(110)),
    {nextStatus:"ready",reason:"TOTEAT_READY"});
  assert.equal(toteatSafeTransition("ready","delivery",false,event(120)),null);
  assert.deepEqual(toteatSafeTransition("ready","delivery",true,event(120)),
    {nextStatus:"out_for_delivery",reason:"TOTEAT_OUT_FOR_DELIVERY"});
  assert.deepEqual(toteatSafeTransition("ready","pickup",false,event(180)),
    {nextStatus:"completed",reason:"TOTEAT_DELIVERED"});
  assert.equal(toteatSafeTransition("preparing","pickup",false,event(180)),null);
  assert.equal(toteatSafeTransition("ready","delivery",true,event(180)),null);
  assert.equal(toteatSafeTransition("preparing","pickup",false,event(172)),null);
});
test("printed state is only a provider report, not printer proof",()=>{
  assert.match(toteatStateLabel(90),/reporta impresión/);
  assert.equal(toteatSafeTransition("confirmed","pickup",false,event(90)),null);
});
