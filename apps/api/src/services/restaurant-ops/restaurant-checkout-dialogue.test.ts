import assert from "node:assert/strict";
import { test } from "node:test";
import {
  spanishNormalize, wantsCartSummary, isCoverageQuestion, coverageAnswer,
  isMenuRequest, isMoreMenuRequest, isAddRequest, isRemoveRequest,
  isStandaloneMenuSelection, parseNumberedProduct, findMenuMentions, mergeCart, removeFromCart,
  formatDraftCart, isPlausibleCustomerName
} from "./restaurant-checkout-dialogue.service.js";
import {
  parseNaturalItemSelection,shouldStartCheckout
} from "./restaurant-whatsapp-checkout.service.js";

const menu=[
  {id:"arepa",name:"Arepa",priceCOP:1500,available:true},
  {id:"chorizo",name:"Chorizo",priceCOP:7000,available:true},
  {id:"arepa-mixta",name:"Arepa Mixta",priceCOP:12000,available:true},
  {id:"hamburguesa",name:"Hamburguesa Tradicional",priceCOP:11000,available:true},
  ...Array.from({length:122},(_,i)=>({
    id:"item-"+(i+5),name:"Producto "+(i+5),priceCOP:1000+i,available:true
  }))
];

test("questions about delivery to Bogota never create or advance checkout",()=>{
  assert.equal(isCoverageQuestion("haces pedidos a bogota"),true);
  assert.equal(isCoverageQuestion("Hacen domicilios en Funza?"),true);
  assert.match(coverageAnswer("haces pedidos a bogota"),/no realizamos domicilios a Bogot[aá]/i);
  assert.match(coverageAnswer("hacen domicilios en Mosquera"),/zonas habilitadas/i);
});

test("cart status questions are commands even with the test-message typo",()=>{
  assert.equal(wantsCartSummary("decime que tengo en el pedido"),true);
  assert.equal(wantsCartSummary("que tengop en el pedido actural"),true);
  assert.equal(wantsCartSummary("¿Cuánto llevo en el pedido?"),true);
  assert.equal(wantsCartSummary("quiero un chorizo"),false);
  const summary=formatDraftCart([
    {productId:"chorizo",quantity:1},
    {productId:"arepa-mixta",quantity:1}
  ],menu);
  assert.match(summary,/Chorizo/);
  assert.match(summary,/Arepa Mixta/);
  assert.match(summary,/19\.000/);
  assert.doesNotMatch(summary,/registrado con éxito/i);
});

test("one number means one product and supports all 126 menu items",()=>{
  assert.deepEqual(parseNumberedProduct("21",menu),
    [{productId:"item-21",quantity:1}]);
  assert.deepEqual(parseNumberedProduct("11",menu),
    [{productId:"item-11",quantity:1}]);
  assert.deepEqual(parseNumberedProduct("11x44",menu),
    [{productId:"item-44",quantity:11}]);
  assert.equal(parseNumberedProduct("999",menu),null);
  assert.equal(parseNumberedProduct("26x5",menu),null);
});

test("a second numeric selection may add a product, but pickup minutes and zones are stage-specific",()=>{
  assert.equal(isStandaloneMenuSelection("11"),true);
  assert.equal(isStandaloneMenuSelection("11x44"),true);
  assert.equal(isStandaloneMenuSelection("2x7, 1x11"),true);
  assert.equal(isStandaloneMenuSelection("30 minutos"),false);
  assert.equal(isStandaloneMenuSelection("domicilio"),false);
});
test("exact longest product matching avoids picking Arepa instead of Arepa Mixta",()=>{
  const mentions=findMenuMentions("quiero agregar una arepa mixta",menu);
  assert.equal(mentions.length,1);
  assert.equal(mentions[0].product.id,"arepa-mixta");
  assert.deepEqual(parseNaturalItemSelection("quiero un chorizo",menu),
    [{productId:"chorizo",quantity:1}]);
  assert.deepEqual(parseNaturalItemSelection("quiero agregar una arepa mixta",menu),
    [{productId:"arepa-mixta",quantity:1}]);
});

test("additional product keeps existing cart; removal never edits other lines",()=>{
  assert.equal(isAddRequest("quiero agregar una arepa mixta"),true);
  const merged=mergeCart([{productId:"chorizo",quantity:1}],
    [{productId:"arepa-mixta",quantity:1}]);
  assert.deepEqual(merged,[
    {productId:"chorizo",quantity:1},{productId:"arepa-mixta",quantity:1}
  ]);
  assert.equal(isRemoveRequest("quita la arepa mixta"),true);
  assert.deepEqual(removeFromCart(merged!,["arepa-mixta"]),
    [{productId:"chorizo",quantity:1}]);
  assert.equal(mergeCart([{productId:"chorizo",quantity:25}],
    [{productId:"chorizo",quantity:1}]),null);
});

test("menu navigation and safe name capture",()=>{
  assert.equal(isMenuRequest("MENÚ"),true);
  assert.equal(isMoreMenuRequest("VER MÁS"),true);
  assert.equal(isPlausibleCustomerName("David Fernando"),true);
  assert.equal(isPlausibleCustomerName("María del Carmen"),true);
  assert.equal(isPlausibleCustomerName("quiero agregar una arepa mixta"),false);
  assert.equal(isPlausibleCustomerName("decime que tengo en el pedido"),false);
  assert.equal(shouldStartCheckout("quiero un chorizo"),true);
  assert.equal(shouldStartCheckout("haces pedidos a bogota"),false);
  assert.equal(spanishNormalize("¿Qué TENGO?"),"¿que tengo?");
});
