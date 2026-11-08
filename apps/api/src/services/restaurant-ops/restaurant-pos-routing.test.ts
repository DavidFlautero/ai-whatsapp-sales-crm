import assert from "node:assert/strict";
import { test } from "node:test";
import {
  decideDelibocadosPosRoute, type RouteInput
} from "./restaurant-pos-routing.service.js";

const whatsapp = (): RouteInput => ({
  companyId: "delibocados",
  source: "whatsapp",
  fulfillmentMode: "pickup",
  orderStatus: "confirmed",
  customerConfirmed: true,
  paymentStatus: "cash_on_delivery"
});
const tableQr = (): RouteInput => ({
  ...whatsapp(),
  source: "qr",
  qrKind: "table",
  fulfillmentMode: "dine_in",
  paymentStatus: "pending",
  verifiedTable: { id: "verified-table-id-1", validatedServerSide: true }
});

test("WhatsApp pickup and delivery orders route only to Toteat", () => {
  assert.deepEqual(decideDelibocadosPosRoute(whatsapp()),
    { ready:true,provider:"toteat",reason:"READY" });
  assert.deepEqual(decideDelibocadosPosRoute({
    ...whatsapp(), fulfillmentMode:"delivery", paymentStatus:"verified"
  }),{ ready:true,provider:"toteat",reason:"READY" });
});

test("unverified transfers never export to Toteat", () => {
  for (const paymentStatus of ["pending","proof_submitted","refunded"] as const) {
    assert.deepEqual(decideDelibocadosPosRoute({
      ...whatsapp(),paymentStatus
    }),{ ready:false,provider:"toteat",reason:"PAYMENT_REVIEW_REQUIRED" });
  }
});

test("QR per mesa routes to POS360 after server verification, not Toteat", () => {
  assert.deepEqual(decideDelibocadosPosRoute(tableQr()),{
    ready:true,provider:"pos360",reason:"READY",tableId:"verified-table-id-1"
  });
});

test("general QR also routes to POS360 only after choosing a verified table", () => {
  assert.deepEqual(decideDelibocadosPosRoute({...tableQr(),qrKind:"general"}),{
    ready:true,provider:"pos360",reason:"READY",tableId:"verified-table-id-1"
  });
  assert.deepEqual(decideDelibocadosPosRoute({
    ...tableQr(),qrKind:"general",verifiedTable:undefined
  }),{ready:false,provider:"pos360",reason:"QR_TABLE_VERIFICATION_REQUIRED"});
});

test("QR URL alone, a browser-provided table string, or takeaway cannot bypass the guard", () => {
  assert.deepEqual(decideDelibocadosPosRoute({
    ...tableQr(),verifiedTable: {id:"Mesa 1",validatedServerSide:false as true}
  }),{ready:false,provider:"pos360",reason:"QR_TABLE_VERIFICATION_REQUIRED"});
  assert.deepEqual(decideDelibocadosPosRoute({
    ...tableQr(),fulfillmentMode:"pickup"
  }),{ready:false,provider:"pos360",reason:"QR_DINE_IN_REQUIRED"});
});

test("no duplicate destination guesses for website, panel, cancelled or foreign-tenant orders", () => {
  assert.deepEqual(decideDelibocadosPosRoute({
    ...whatsapp(),source:"web"
  }),{ready:false,provider:null,reason:"MANUAL_SOURCE_ROUTING_REQUIRED"});
  assert.deepEqual(decideDelibocadosPosRoute({
    ...whatsapp(),source:"panel"
  }),{ready:false,provider:null,reason:"MANUAL_SOURCE_ROUTING_REQUIRED"});
  assert.deepEqual(decideDelibocadosPosRoute({
    ...whatsapp(),orderStatus:"ready"
  }),{ready:false,provider:null,reason:"ORDER_NOT_CONFIRMABLE"});
  assert.deepEqual(decideDelibocadosPosRoute({
    ...whatsapp(),customerConfirmed:false
  }),{ready:false,provider:null,reason:"CUSTOMER_CONFIRMATION_REQUIRED"});
  assert.deepEqual(decideDelibocadosPosRoute({
    ...whatsapp(),companyId:"events"
  }),{ready:false,provider:null,reason:"WRONG_COMPANY"});
});
