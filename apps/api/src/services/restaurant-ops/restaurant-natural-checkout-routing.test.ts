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

test("Spanish checkout message matches two verified catalog lines without pretending to confirm",async()=>{
  const {parseNaturalItemSelection,buildOrderSummary}=
    await import("./restaurant-whatsapp-checkout.service.js");
  const {formatDraftCart}=await import("./restaurant-checkout-dialogue.service.js");
  const menu=[
    {id:"deli-burger",name:"Hamburguesa Tradicional",priceCOP:11000,
      available:true,priceNeedsReview:false},
    {id:"deli-drink",name:"Coca Cola Retornable 250",priceCOP:2500,
      available:true,priceNeedsReview:false}
  ];
  const message="Hola, quiero una hamburguesa tradicional y una Coca Cola Retornable 250 para retirar en el local. ¿Cuánto me sale todo?";
  const lines=parseNaturalItemSelection(message,menu);
  assert.deepEqual(lines,[
    {productId:"deli-burger",quantity:1},
    {productId:"deli-drink",quantity:1}
  ]);
  const cart=formatDraftCart(lines!,menu);
  assert.match(cart,/13[.]500/);
  assert.match(cart,/No se ha registrado/);
  const summary=buildOrderSummary({
    id:"unconfirmed-draft",stage:"confirm",menuRevision:3,
    items:lines!,customerName:"Cliente Prueba",mode:explicitFulfillment(message)==="pickup"
      ?"pickup":"delivery",
    payment:"cash",createdAt:new Date().toISOString()
  },menu,[]);
  assert.equal(summary.total,13500);
  assert.match(summary.text,/CONFIRMAR PEDIDO/);
  assert.match(summary.text,/Retiro en local/);
});
test("products awaiting price verification are never offered in initial cart",async()=>{
  const {parseNaturalItemSelection}=await import("./restaurant-whatsapp-checkout.service.js");
  const {explicitPurchaseStatement}=await import("./restaurant-natural-checkout-routing.service.js");
  const message="Quiero una porción de chicharrón";
  assert.equal(explicitPurchaseStatement(message),true);
  const available=[{id:"deli-055",name:"Chicharrón Porción",priceCOP:8001,
    available:true,priceNeedsReview:true}].filter(x=>!x.priceNeedsReview);
  assert.equal(parseNaturalItemSelection(message,available),null);
});

test("natural name variants are normalized without inserting the greeting into customer record",async()=>{
  const {extractCustomerName}=await import("./restaurant-natural-checkout-routing.service.js");
  assert.equal(extractCustomerName("Soy Carolina"),"Carolina");
  assert.equal(extractCustomerName("Me llamo Juan Pérez"),"Juan Pérez");
  assert.equal(extractCustomerName("A nombre de Prueba Tecnica"),"Prueba Tecnica");
  assert.equal(extractCustomerName("Hola"),null);
  assert.equal(extractCustomerName("Cuánto cuesta"),null);
  assert.equal(shouldDeterministicallyCheckout("Soy Carolina","name"),true);
});
