import {test} from "node:test";
import assert from "node:assert/strict";
import {
  parseToteatPostReceipt,matchOpenToteatOrder,parseToteatJsonPreservingIds
} from "./restaurant-toteat-receipt.service.js";
const ref="delibocados-123e4567-e89b-42d3-a456-426614174000";
const id="9450186157992447";
test("POST success with exact 16-digit ID",()=>{
 const s='{"ok":true,"orderExp":{"orderReference":"'+ref+'","orderId":'+id+'}}';
 assert.deepEqual(parseToteatPostReceipt(s,200,ref),
  {outcome:"accepted",externalOrderId:id,evidence:"http_receipt"});
});
test("HTTP 200 without ID remains unknown - previous printed order must not retry",()=>{
 assert.equal(parseToteatPostReceipt('{"ok":true,"msg":"success"}',200,ref).outcome,"unknown");
});
test("explicit rejection and ambiguous 5xx handled separately",()=>{
 assert.equal(parseToteatPostReceipt('{"ok":false}',400,ref).outcome,"rejected");
 assert.equal(parseToteatPostReceipt('{"ok":false}',502,ref).outcome,"unknown");
 assert.equal(parseToteatPostReceipt('{"ok":false}',429,ref).outcome,"unknown");
});
test("mismatched reference or two IDs is not proof of acceptance",()=>{
 assert.equal(parseToteatPostReceipt('{"ok":true,"data":{"orderReference":"other","orderId":'+id+'}}',200,ref).outcome,"unknown");
 assert.equal(parseToteatPostReceipt('{"ok":true,"data":[{"orderId":'+id+'},{"orderId":9450186157992448}]}',200,ref).outcome,"unknown");
});
test("open list matches ONLY exact reference and preserves integer",()=>{
 const body='{"ok":true,"data":[{"orderReference":"'+ref+'","orderId":'+id+'},{"orderReference":"other","orderId":9450186157992448}]}';
 assert.deepEqual(matchOpenToteatOrder(body,ref),
  {outcome:"accepted",externalOrderId:id,evidence:"open_order_listing"});
 assert.equal(matchOpenToteatOrder(body,"missing").outcome,"unknown");
});
test("big numeric tokens are strings without affecting quoted numbers",()=>{
 const result=parseToteatJsonPreservingIds('{"orderId":'+id+',"label":"'+id+'"}') as Record<string,unknown>;
 assert.equal(result.orderId,id);
 assert.equal(result.label,id);
});
