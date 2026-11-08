import assert from "node:assert/strict";
import {test} from "node:test";
import {
  detectRestaurantException,restaurantExceptionResponse,
  RESTAURANT_CONVERSATION_GUIDANCE
} from "./restaurant-customer-exception.service.js";

test("split transfer and cash from real Delibocados dialogue requires a cashier",()=>{
  const result=detectRestaurantException(
    "Te envio 40 por Bre-B y aqui el resto porfavor",{cartUnits:2});
  assert.equal(result,"mixed_payment");
  assert.match(restaurantExceptionResponse(result!),/verificarla/);
  assert.equal(detectRestaurantException("Pago por transferencia",{cartUnits:1}),null);
  assert.equal(detectRestaurantException("¿Tienen Nequi?",{cartUnits:0}),null);
});
test("conflicting balances never use conversational arithmetic",()=>{
  assert.equal(detectRestaurantException("Le debian plata del pedido",{cartUnits:0}),
    "payment_dispute");
  assert.equal(detectRestaurantException("Me dijeron que eran 184 y ahora 185",{cartUnits:0}),
    "payment_dispute");
  assert.equal(detectRestaurantException("¿Cuánto cuesta una arepa?",{cartUnits:0}),null);
});
test("an individual customization of two products is not applied to both",()=>{
  assert.equal(detectRestaurantException("Una de esas sin vegetales PORFAVOR",
    {cartUnits:2}),"individual_item_change");
  assert.equal(detectRestaurantException("Una de esas sin vegetales PORFAVOR",
    {cartUnits:1}),null);
  assert.equal(detectRestaurantException("En combo",{cartUnits:2}),null);
});
test("only explicit changes to a dispatched order require a handoff",()=>{
  assert.equal(detectRestaurantException("Quiero agregar un perro caliente",
    {cartUnits:0,recentOrderStatus:"completed"}),null);
  assert.equal(detectRestaurantException("Otra bebida",
    {cartUnits:0,recentOrderStatus:"completed"}),null);
  assert.equal(detectRestaurantException("De litro",
    {cartUnits:0,recentOrderStatus:"out_for_delivery"}),null);
  assert.equal(detectRestaurantException("Agrega un perro caliente al pedido #1",
    {cartUnits:0,recentOrderStatus:"completed"}),"post_dispatch_change");
  assert.equal(detectRestaurantException("Quiero cambiar el pedido anterior",
    {cartUnits:0,recentOrderStatus:"out_for_delivery"}),"post_dispatch_change");
  assert.equal(detectRestaurantException("De litro",
    {cartUnits:0,recentOrderStatus:"confirmed"}),null);
});
test("genuine conversational order utterances do not trigger false handoffs",()=>{
  for(const message of [
    "Me regalas una mazorcada",
    "Y un jugo en agua",
    "Mora",
    "Así no más",
    "Se demora, veci?",
    "Por fa llamar cuando estén acá porque no se escucha",
    "11 empanadas de 1.000",
    "Me regalas buena salsa de ajo",
  ]) {
    assert.equal(detectRestaurantException(message,{cartUnits:1}),null,message);
  }
});
test("training guidance is anonymized and has no bank or customer account literals",()=>{
  const text=RESTAURANT_CONVERSATION_GUIDANCE.join(" ");
  assert.match(text,/«Me regalas una mazorcada»/);
  assert.match(text,/pedido, dirección, bebida|Pedido, dirección, bebida/);
  assert.doesNotMatch(text,/\b(?:57\d{10}|\d{9,12})\b/);
  assert.doesNotMatch(text,/@delibocados2/i);
});
