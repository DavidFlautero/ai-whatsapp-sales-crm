import assert from "node:assert/strict";
import {test} from "node:test";
import {mergeCart,formatDraftCart} from "./restaurant-checkout-dialogue.service.js";
import {
  detectIngredientRemoval,applyUnitRemoval,findCatalogCombo,applyComboChoice,
  isComboRequest
} from "./restaurant-line-modification.service.js";
import {detectRestaurantException} from "./restaurant-customer-exception.service.js";
import {buildOrderSummary,type CheckoutDraft}
  from "./restaurant-whatsapp-checkout.service.js";

const base={id:"burger",name:"Hamburguesa Doble Mixta",priceCOP:19000,available:true};
const combo={id:"burger-combo",name:"Combo Hamburguesa Doble Mixta",
  priceCOP:25000,available:true};
const unrelated={id:"another-combo",name:"Combo Hamburguesa Doble Carne",
  priceCOP:24500,available:true};
const menu=[base,combo,unrelated];

test("real transcript: one of two burgers without vegetables affects only one",()=>{
  assert.deepEqual(detectIngredientRemoval("Una de esas sin vegetales PORFAVOR"),
    {instruction:"SIN VEGETALES",quantity:1});
  assert.deepEqual(detectIngredientRemoval("2 hamburguesas, una de esas sin vegetales"),
    {instruction:"SIN VEGETALES",quantity:1});
  const lines=applyUnitRemoval([{productId:"burger",quantity:2}],
    "burger",1,"SIN VEGETALES");
  assert.deepEqual(lines,[
    {productId:"burger",quantity:1},
    {productId:"burger",quantity:1,instructions:"SIN VEGETALES"}
  ]);
  assert.equal(mergeCart(lines!,[{productId:"burger",quantity:1}])?.[0].quantity,2);
  assert.match(formatDraftCart(lines!,menu),/SIN VEGETALES/);
  assert.match(formatDraftCart(lines!,menu),/38\.000/);
});
test("different instructions do not merge; aggregate quantity limit is enforced",()=>{
  const edited=applyUnitRemoval([{productId:"burger",quantity:2}],
    "burger",1,"SIN CEBOLLA");
  assert.equal(edited?.length,2);
  assert.equal(applyUnitRemoval(edited!,"burger",2,"SIN TOMATE"),null);
  assert.equal(mergeCart(edited!,[{productId:"burger",quantity:24}]),null);
  assert.equal(mergeCart([{productId:"burger",quantity:1,instructions:"SIN CEBOLLA"}],
    [{productId:"burger",quantity:1,instructions:"SIN TOMATE"}])?.length,2);
});
test("allergen requests never become ordinary removals",()=>{
  assert.equal(detectIngredientRemoval("Soy alergica al tomate, una sin tomate"),null);
});
test("published and unique combo SKU is the only safe combo conversion",()=>{
  assert.equal(findCatalogCombo(base,menu)?.id,"burger-combo");
  assert.equal(findCatalogCombo(base,[base,unrelated]),null);
  assert.equal(isComboRequest("En combo"),true);
  assert.deepEqual(applyComboChoice([{productId:"burger",quantity:2}],
    "burger","burger-combo",1),[
      {productId:"burger",quantity:1},{productId:"burger-combo",quantity:1}
    ]);
});
test("no custom-modifier information is lost on final order summary",()=>{
  const draft={
    id:"test-1",stage:"confirm",menuRevision:1,createdAt:new Date().toISOString(),
    items:[{productId:"burger",quantity:1},
      {productId:"burger",quantity:1,instructions:"SIN VEGETALES"}],
    mode:"pickup",customerName:"Prueba",payment:"cash"
  } satisfies CheckoutDraft;
  const summary=buildOrderSummary(draft,menu,[]);
  assert.equal(summary.subtotal,38000);
  assert.match(summary.text,/SIN VEGETALES/);
  assert.match(summary.text,/38\.000/);
});
test("safe tool bypasses legacy individual-item human handoff only when it can execute",()=>{
  assert.equal(detectRestaurantException("una de esas sin vegetales",{cartUnits:2}),
    "individual_item_change");
  assert.equal(detectIngredientRemoval("una de esas sin vegetales")?.quantity,1);
});
