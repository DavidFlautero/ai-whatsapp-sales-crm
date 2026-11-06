import assert from "node:assert/strict";
import { test } from "node:test";
import {
 parseItemSelection, parseNaturalItemSelection, buildOrderSummary, shouldStartCheckout, type CheckoutDraft
} from "./restaurant-whatsapp-checkout.service.js";

const menu = [
 { id: "burger", name: "Hamburguesa", priceCOP: 18000, available: true },
 { id: "soda", name: "Gaseosa", priceCOP: 5000, available: true },
 { id: "hidden", name: "Agotado", priceCOP: 2000, available: false }
];
const draft = ():CheckoutDraft => ({
 id:"draft-test", stage:"confirm", menuRevision:1, createdAt:new Date().toISOString(),
 items:[{productId:"burger", quantity:2},{productId:"soda",quantity:1}],
 customerName:"Cliente Prueba", mode:"pickup", payment:"cash"
});
test("messages start checkout for menu, pickup and delivery", () => {
 assert.equal(shouldStartCheckout("Hola, me pasás el menú?"), true);
 assert.equal(shouldStartCheckout("Paso a buscarlo al local"), true);
 assert.equal(shouldStartCheckout("Quiero un domicilio"), true);
 assert.equal(shouldStartCheckout("¿Cómo está mi pedido?"), false);
});
test("menu numbering and quantity parser are deterministic", () => {
 assert.deepEqual(parseItemSelection("2x1, 1x2",menu),
   [{productId:"burger",quantity:2},{productId:"soda",quantity:1}]);
 assert.equal(parseItemSelection("2 hamburguesas",menu),null);
 assert.equal(parseItemSelection("1x4",menu),null);
 assert.equal(parseItemSelection("50x1",menu),null);
 assert.equal(parseItemSelection("1x1, nada",menu),null);
});
test("clear natural-language products map only to verified menu IDs", () => {
 assert.deepEqual(
   parseNaturalItemSelection("Quiero dos hamburguesas y una gaseosa",menu),
   [{productId:"burger",quantity:2},{productId:"soda",quantity:1}]
 );
 assert.deepEqual(
   parseNaturalItemSelection("quiero 2 hamburguesas",menu),
   [{productId:"burger",quantity:2}]
 );
 assert.equal(parseNaturalItemSelection("Quiero una pizza",menu),null);
 assert.equal(parseNaturalItemSelection("Quiero hamburguesas",menu),null);
 assert.equal(shouldStartCheckout("hola"),true);
 assert.equal(shouldStartCheckout("Quiero 2 hamburguesas"),true);
 assert.equal(shouldStartCheckout("Quiero saber dónde está mi pedido"),false);
});
test("pickup has exactly zero delivery fee and a confirmed total",() => {
 const total=buildOrderSummary(draft(),menu,[]);
 assert.equal(total.subtotal,41000);
 assert.equal(total.fee,0);
 assert.equal(total.total,41000);
 assert.match(total.text,/Retiro en local/);
 assert.match(total.text,/CONFIRMAR PEDIDO/);
});
test("delivery requires active verified zone and an address",() => {
 const d={...draft(),mode:"delivery" as const,zoneId:"zone-1",address:"Calle 15 # 8-20"};
 assert.throws(()=>buildOrderSummary(d,menu,[]),/DELIVERY_NOT_READY/);
 const z=[{id:"zone-1",name:"Centro",fee_cop:3000,eta_minutes:30,active:true}];
 const q=buildOrderSummary(d,menu,z);
 assert.equal(q.fee,3000);
 assert.equal(q.total,44000);
 assert.match(q.text,/Calle 15 # 8-20/);
});
test("never offer unverified or unavailable product as a priced order",() => {
 const untrusted={...draft(),items:[{productId:"hidden",quantity:1}]};
 assert.throws(()=>buildOrderSummary(untrusted,menu,[]),/PRODUCT_UNAVAILABLE/);
});
