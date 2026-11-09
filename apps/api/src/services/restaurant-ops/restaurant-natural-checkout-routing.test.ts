import assert from "node:assert/strict";
import {test} from "node:test";
import {
  explicitFulfillment,explicitPurchaseStatement,shouldDeterministicallyCheckout
} from "./restaurant-natural-checkout-routing.service.js";

test("real purchase and pickup quote go to deterministic cart even with a price question",()=>{
  const message="Hola, quiero una hamburguesa tradicional y una Coca Cola Retornable 250 para retirar en el local. ¿Cuánto me sale todo?";
  assert.equal(explicitPurchaseStatement(message),true);
  assert.equal(explicitFulfillment(message),"pickup");
  assert.equal(shouldDeterministicallyCheckout(message,undefined),true);
});
test("distinguishes delivery from pickup and declines contradictory mode",()=>{
  assert.equal(explicitFulfillment("Dos hamburguesas para domicilio"),"delivery");
  assert.equal(explicitFulfillment("Paso a buscarlo al local"),"pickup");
  assert.equal(explicitFulfillment("Retiro o domicilio?"),"ambiguous");
});
test("informational and recommendation questions do not write carts",()=>{
  for(const message of [
    "Quiero saber cuánto sale una hamburguesa",
    "¿Cuánto cuesta una hamburguesa?",
    "Quiero una recomendación de hamburguesa",
    "Tienen chicharrón?"
  ])assert.equal(explicitPurchaseStatement(message),false,message);
});
test("transactional replies bypass LLM for known safe slots",()=>{
  assert.equal(shouldDeterministicallyCheckout("Prueba Tecnica","name"),true);
  assert.equal(shouldDeterministicallyCheckout("30","pickup_time"),true);
  assert.equal(shouldDeterministicallyCheckout("EFECTIVO","payment"),true);
  assert.equal(shouldDeterministicallyCheckout("CONFIRMAR PEDIDO","confirm"),true);
  assert.equal(shouldDeterministicallyCheckout("¿Cuánto es el domicilio?","payment"),false);
});
