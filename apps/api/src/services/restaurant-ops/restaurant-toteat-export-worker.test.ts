import {test} from "node:test";
import assert from "node:assert/strict";
import {toteatExportControls,checkToteatCatalogSnapshot}
 from "./restaurant-toteat-export-worker.service.js";
const base={product_id:"deli-055",external_product_code:"DB1132",
 active:true,reviewed_at:"2026-11-10T12:00:00Z"};
const item={product_id:"deli-055",product_name:"Chicharrón Porción",
 quantity:1,unit_price_cop:8001,instructions:""};
const remote=[{name:"Chicharrón Porción",price:8001,localCode:"DB1132",isModifier:false}];
test("hard off by default even with mapped products",()=>{
 const names=["DELIBOCADOS_TOTEAT_ORDER_EXPORT","DELIBOCADOS_TOTEAT_EXPORT_ACK",
  "DELIBOCADOS_TOTEAT_EXPORT_ONLY_ORDER_ID","DELIBOCADOS_TOTEAT_EXPORT_PUBLIC",
  "DELIBOCADOS_TOTEAT_EXPORT_CUTOVER"];
 const backup=names.map(x=>[x,process.env[x]] as const);
 try{
   names.forEach(x=>delete process.env[x]);
   assert.deepEqual(toteatExportControls(),
     {enabled:false,reason:"EXPORT_FLAG_OFF",cutover:null,onlyOrderId:null});
   process.env.DELIBOCADOS_TOTEAT_ORDER_EXPORT="1";
   assert.equal(toteatExportControls().enabled,false);
   process.env.DELIBOCADOS_TOTEAT_EXPORT_ACK="OWNER_AUTHORIZED_REAL_ORDERS";
   assert.equal(toteatExportControls().reason,"PILOT_UUID_OR_PUBLIC_RELEASE_REQUIRED");
   process.env.DELIBOCADOS_TOTEAT_EXPORT_ONLY_ORDER_ID="bad";
   assert.equal(toteatExportControls().reason,"PILOT_ORDER_UUID_INVALID");
 }finally{
   for(const [k,v] of backup)if(v===undefined)delete process.env[k];else process.env[k]=v;
 }
});
test("SKU price/code must match live Toteat GET exactly",()=>{
 assert.equal(checkToteatCatalogSnapshot([item],[base],remote).ok,true);
 assert.equal(checkToteatCatalogSnapshot([item],[base],
   [{...remote[0],price:8002}]).ok,false);
 assert.equal(checkToteatCatalogSnapshot([item],[base],
   [{...remote[0],isModifier:true}]).ok,false);
 assert.equal(checkToteatCatalogSnapshot([item],[{...base,active:false}],remote).ok,false);
});
test("delivery fee SKU must be exact and never guessed",()=>{
 const fee={name:"Servicio domicilio",price:2500,localCode:"D-01",isModifier:false};
 assert.equal(checkToteatCatalogSnapshot([item],[base],[...remote,fee],"D-01",2500).ok,true);
 assert.equal(checkToteatCatalogSnapshot([item],[base],[...remote,fee],"D-01",2000).ok,false);
});
