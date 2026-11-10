import assert from "node:assert/strict";
import {test} from "node:test";
import {interpretNaturalPreparation,isFoodSafetyMessage} from "./restaurant-cart-intake.service.js";
const lines=[{productId:"burger",quantity:1}];

test("one burger without onion persists its kitchen note",()=>{
 const result=interpretNaturalPreparation("Quiero una hamburguesa tradicional sin cebolla",lines);
 assert.deepEqual(result,{kind:"safe",lines:[
   {productId:"burger",quantity:1,instructions:"SIN CEBOLLA"}
 ]});
});
test("two burgers one with change are separate kitchen lines",()=>{
 const result=interpretNaturalPreparation("Quiero dos hamburguesas, una de esas sin cebolla",[
  {productId:"burger",quantity:2}
 ]);
 assert.equal(result.kind,"safe");
 if(result.kind!=="safe")return;
 assert.deepEqual(result.lines,[
   {productId:"burger",quantity:1},
   {productId:"burger",quantity:1,instructions:"SIN CEBOLLA"}
 ]);
});
test("do not drop ambiguous changes or invent prices for extras",()=>{
 const ambiguous=interpretNaturalPreparation("Quiero dos hamburguesas sin cebolla",[
  {productId:"burger",quantity:2}
 ]);
 assert.equal(ambiguous.kind,"clarify");
 const extra=interpretNaturalPreparation("Quiero una hamburguesa con queso",lines);
 assert.equal(extra.kind,"clarify");
 const unknown=interpretNaturalPreparation("Quiero una hamburguesa sin pepinillos",lines);
 assert.equal(unknown.kind,"clarify");
});
test("multiple products with food changes require disambiguation",()=>{
 const result=interpretNaturalPreparation(
  "Quiero una hamburguesa y una gaseosa sin cebolla",
  [...lines,{productId:"soda",quantity:1}]
 );
 assert.equal(result.kind,"clarify");
});
test("allergy terms never pass as normal modification",()=>{
 assert.equal(isFoodSafetyMessage("Soy alérgico a la cebolla"),true);
 assert.equal(isFoodSafetyMessage("Soy celíaca"),true);
 assert.equal(interpretNaturalPreparation("Quiero una hamburguesa sin gluten",lines).kind,"human");
});
