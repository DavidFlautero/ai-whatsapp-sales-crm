import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyRestaurantIntent } from "./restaurant-ops-conversation.service.js";

test("pickup phrasing in Colombian Spanish", () => {
  for (const phrase of [
    "Paso a buscarlo al local",
    "voy a recoger",
    "Me lo preparas para llevar?",
    "Lo recojo en media hora",
    "Paso a buscar dos hamburguesas"
  ]) {
    assert.equal(classifyRestaurantIntent(phrase), "pickup", phrase);
  }
});
test("delivery and ambiguity", () => {
  assert.equal(classifyRestaurantIntent("Quiero un domicilio a mi casa"), "delivery");
  assert.equal(classifyRestaurantIntent("¿Me lo envían a domicilio?"), "delivery");
  assert.equal(classifyRestaurantIntent("Paso a buscarlo o me lo mandan a domicilio"), "ambiguous");
});
test("status, issues, payment and regular chat", () => {
  assert.equal(classifyRestaurantIntent("¿Cómo va mi pedido?"), "order_status");
  assert.equal(classifyRestaurantIntent("Mi pedido llegó mal"), "complaint");
  assert.equal(classifyRestaurantIntent("Te pasé el comprobante de Nequi"), "payment");
  assert.equal(classifyRestaurantIntent("Hola, ¿qué tienen hoy?"), "other");
});
