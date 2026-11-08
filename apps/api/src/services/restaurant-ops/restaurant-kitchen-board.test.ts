import {strict as assert} from "node:assert";
import {test} from "node:test";
import {
  buildKitchenBoard,type KitchenOrder,type KitchenTicket,type KitchenExport
} from "./restaurant-kitchen-board.service.js";

const timestamp="2026-11-08T18:00:00.000Z";
const now=Date.parse("2026-11-08T19:00:00.000Z");
const order=(patch:Partial<KitchenOrder>={}):KitchenOrder=>({
 id:"o1",number:1,source:"whatsapp",fulfillment_mode:"pickup",
 status:"completed",payment_status:"cash_on_delivery",
 created_at:timestamp,...patch
});
const ticket=(patch:Partial<KitchenTicket>={}):KitchenTicket=>({
 id:"t1",order_id:"o1",status:"ready",queued_at:timestamp,
 printed_at:null,...patch
});
test("legacy completed cash remains unconfirmed, without inventing a printed receipt",()=>{
 const board=buildKitchenBoard([order()],[ticket()],[],now);
 assert.equal(board.summary.totalRecent,1);
 assert.equal(board.summary.completedCashUnconfirmed,1);
 assert.equal(board.summary.printTimestampRecorded,0);
 assert.equal(board.entries[0].printEvidence,"not_recorded");
 assert.ok(board.entries[0].alerts.includes("COBRO_NO_CONFIRMADO_EN_SISTEMA"));
});
test("status recorded as verified and printed timestamp only represent DB evidence",()=>{
 const board=buildKitchenBoard([order({payment_status:"verified"})],
   [ticket({printed_at:timestamp})],[],now);
 assert.equal(board.summary.completedCashUnconfirmed,0);
 assert.equal(board.summary.printTimestampRecorded,1);
 assert.equal(board.entries[0].printEvidence,"db_timestamp");
 assert.match(board.evidenceNotice,/NO prueba/);
});
test("no ticket and pending transfer are kept visible and held",()=>{
 const board=buildKitchenBoard([
   order({id:"o2",number:2,status:"confirmed",payment_status:"proof_submitted"})
 ],[],[],now);
 assert.equal(board.summary.active,1);
 assert.equal(board.summary.missingTicket,1);
 assert.equal(board.summary.paymentHeld,1);
 assert.ok(board.entries[0].alerts.includes("TICKET_FALTANTE"));
});
test("working ticket with a delayed order is flagged, without changing it",()=>{
 const board=buildKitchenBoard([
   order({status:"preparing",preparing_at:timestamp,payment_status:"verified"})
 ],[ticket({status:"working"})],[],now);
 assert.equal(board.summary.working,1);
 assert.equal(board.summary.possibleDelays,1);
 assert.equal(board.entries[0].alerts.includes("COCINA_DESINCRONIZADA"),false);
});
test("mismatched statuses and uncertain POS receipts are reported",()=>{
 const exports:KitchenExport[]=[
  {order_id:"o1",provider:"toteat",status:"unknown",attempts:1}
 ];
 const board=buildKitchenBoard([
  order({status:"ready",payment_status:"verified"})
 ],[ticket({status:"working"})],exports,now);
 assert.equal(board.summary.ambiguousPos,1);
 assert.ok(board.entries[0].alerts.includes("POS_ESTADO_INCIERTO"));
 assert.ok(board.entries[0].alerts.includes("COCINA_DESINCRONIZADA"));
});
test("QR dine-in status remains distinct and no false cash alerts when verified",()=>{
 const board=buildKitchenBoard([
   order({id:"qr1",source:"qr",fulfillment_mode:"dine_in",
    status:"confirmed",payment_status:"verified"})
 ],[ticket({order_id:"qr1",status:"queued"})],
 [{order_id:"qr1",provider:"pos360",status:"pending",attempts:0}],now);
 assert.equal(board.summary.queued,1);
 assert.equal(board.entries[0].fulfillment,"dine_in");
 assert.equal(board.entries[0].posProvider,"pos360");
 assert.deepEqual(board.entries[0].alerts,[]);
});
