import assert from "node:assert/strict";
import {test} from "node:test";
import {
  validOpeningHours,hoursForAgent,type BusinessProfile
} from "./restaurant-agent-business.service.js";
import {safeQuestion,recurringQuestions} from "./restaurant-agent-learning.service.js";

const profile={
  company_id:"delibocados",business_name:"Delibocados",description:"",
  location_address:"",public_phone:"",city:"Funza",
  timezone:"America/Bogota" as const,
  coverage_summary:"Funza y Mosquera, no Bogotá",
  opening_hours:{},special_hours_note:"",tone:"natural" as const,
  extra_instructions:"",learning_enabled:false,updated_at:""
} satisfies BusinessProfile;

test("unknown opening hours are not invented",()=>{
  assert.match(hoursForAgent(profile),/No confirmados/);
});
test("confirmed per-day hours are rendered in Bogota timezone",()=>{
  const p:BusinessProfile={...profile,opening_hours:{
    mon:{enabled:true,open:"09:00",close:"18:00"},
    sun:{enabled:false,open:"",close:""}
  }};
  assert.equal(validOpeningHours(p.opening_hours),true);
  assert.match(hoursForAgent(p),/Lunes: 09:00–18:00/);
  assert.match(hoursForAgent(p),/Domingo: sin atención confirmada/);
  assert.equal(validOpeningHours({mon:{enabled:true,open:"25:00",close:"20:00"}}),false);
  assert.equal(validOpeningHours({mon:{enabled:true,open:"09:00",close:"09:00"}}),false);
  assert.equal(validOpeningHours({oops:{enabled:true,open:"09:00",close:"18:00"}} as never),false);
});
test("FAQ extraction never retains sensitive payment or personal data",()=>{
  assert.equal(safeQuestion("¿Hacen domicilio a Bogotá?"),"Hacen domicilio a Bogotá?");
  assert.equal(safeQuestion("¿Puedo pagar a la cuenta 123456789?"),null);
  assert.equal(safeQuestion("¿Dónde queda la calle 20 apartamento 7?"),null);
  assert.equal(safeQuestion("¿Pueden enviar a mi celular 34632441787?"),null);
  assert.equal(safeQuestion("Hola amigo te cuento una cosa"),null);
});
test("history suggestions consider only incoming restaurant questions",()=>{
  const rows=[
    {direction:"inbound",body:"¿Hacen domicilio a Bogotá?"},
    {direction:"outbound",body:"¿Hacen domicilio a Bogotá?"},
    {direction:"inbound",body:"¿Hacen domicilio a Bogotá?"},
    {direction:"inbound",body:"¿Cuál es el horario del restaurante?"},
    {direction:"inbound",body:"transferencia a la cuenta 123456789"}
  ];
  const suggestions=recurringQuestions(rows);
  assert.equal(suggestions[0].count,2);
  assert.equal(suggestions[0].question,"Hacen domicilio a Bogotá?");
  assert.ok(suggestions.every(s=>!s.question.includes("123456789")));
});
