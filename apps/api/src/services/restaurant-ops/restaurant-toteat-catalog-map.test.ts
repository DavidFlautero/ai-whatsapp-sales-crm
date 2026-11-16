import assert from "node:assert/strict";
import {test} from "node:test";
import {reconcileToteatProducts} from "./restaurant-toteat-catalog-map.service.js";
test("only exact name and COP price match, extras excluded",()=>{
  const preview=reconcileToteatProducts([
    {id:"b",name:"Hamburguesa Tradicional",priceCOP:11000},
    {id:"c",name:"Coca Cola Retornable 250",priceCOP:2500}
  ],[
    {name:"Hamburguesa Tradicional",price:11000,localCode:"HB1",isModifier:false},
    {name:"Coca Cola Retornable 250",price:2500,localCode:"C1",isModifier:false},
    {name:"Papas",price:3000,localCode:"P1",isModifier:true}
  ]);
  assert.equal(preview.ready,true);
  assert.deepEqual(preview.matched.map(x=>x.externalCode),["HB1","C1"]);
});
test("wrong price, duplicate code and modifier-only rows block mapping",()=>{
  assert.equal(reconcileToteatProducts([{id:"a",name:"Coca",priceCOP:2000}],
    [{name:"Coca",price:2500,localCode:"X",isModifier:false}]).ready,false);
  assert.equal(reconcileToteatProducts([
    {id:"a",name:"Coca",priceCOP:2000},{id:"b",name:"Fanta",priceCOP:2000}
  ],[
    {name:"Coca",price:2000,localCode:"X",isModifier:false},
    {name:"Fanta",price:2000,localCode:"X",isModifier:false}
  ]).ready,false);
  assert.equal(reconcileToteatProducts([{id:"a",name:"Papas",priceCOP:3000}],
    [{name:"Papas",price:3000,localCode:"X",isModifier:true}]).ready,false);
});
