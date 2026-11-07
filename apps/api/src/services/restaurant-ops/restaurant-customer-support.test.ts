import {test} from "node:test";
import assert from "node:assert/strict";
import {
  complaintIntent,orderHistoryIntent,extractOrderNumber,complaintType,
  customerOrderSummary
} from "./restaurant-customer-support.service.js";
import {ambiguousDoubleBurger,pickVariant} from "./restaurant-product-followup.service.js";
import {addressLooksVerifiable} from "./restaurant-delivery-routing.service.js";

test("WhatsApp complaints and history requests never mean a new order",()=>{
  assert.equal(complaintIntent("HOLA TENGO UN PROBLEMA CON EL PEDIDO QUE HICE"),true);
  assert.equal(complaintIntent("me dieron un salchipapas que no pedi"),true);
  assert.equal(orderHistoryIntent("revisa el historial"),true);
  assert.equal(orderHistoryIntent("¿Qué pedí ayer?"),true);
  assert.equal(complaintType("me dieron un salchipapas que no pedi"),"wrong_item");
  assert.equal(extractOrderNumber("pedido #18"),18);
  assert.equal(extractOrderNumber("18"),18);
  assert.equal(extractOrderNumber("hola"),null);
});
test("historic order lines are explicitly displayed rather than guessed",()=>{
  const order={
    id:"order-1",number:1,customer_phone:"34632441787",customer_name:"Cliente",
    status:"completed",payment_status:"cash_on_delivery",payment_method:"cash",
    fulfillment_mode:"pickup" as const,address:null,zone_id:null,courier_id:null,
    created_at:"2026-11-07T00:00:00Z",total_cop:38000
  };
  const summary=customerOrderSummary({
    profile:null,orders:[order],
    lines:[{order_id:"order-1",product_id:"burger",product_name:"Hamburguesa Doble Mixta",
      quantity:2,unit_price_cop:19000}],incidents:[]
  });
  assert.match(summary,/Pedido #1/);
  assert.match(summary,/2 × Hamburguesa Doble Mixta/);
  assert.match(summary,/38\.000/);
  assert.doesNotMatch(summary,/salchipapas/i);
});
test("two double burgers retain their quantity through variant clarification",()=>{
  assert.equal(ambiguousDoubleBurger("te puedo pedir nuevamente 2 hamburguesas doble"),2);
  assert.equal(ambiguousDoubleBurger("quiero una hamburguesa doble"),1);
  assert.equal(ambiguousDoubleBurger("quiero dos hamburguesas doble mixta"),null);
  const products=[
    {id:"burger-double-meat",name:"Hamburguesa Doble Carne",priceCOP:19000},
    {id:"burger-double-mix",name:"Hamburguesa Doble Mixta",priceCOP:19000}
  ];
  assert.equal(pickVariant("doble mixta",products)?.id,"burger-double-mix");
  assert.equal(pickVariant("carne",products)?.id,"burger-double-meat");
  assert.equal(pickVariant("sí",products),null);
});
test("road-distance quote requires an identifiable Colombian city and address",()=>{
  assert.equal(addressLooksVerifiable("Calle 10 # 3-24, Funza"),true);
  assert.equal(addressLooksVerifiable("Carrera 8 # 15-23, Mosquera"),true);
  assert.equal(addressLooksVerifiable("Bogotá"),false);
  assert.equal(addressLooksVerifiable("calle 10 #3-24"),false);
});
