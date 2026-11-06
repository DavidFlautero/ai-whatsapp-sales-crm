import assert from "node:assert/strict";
import { test } from "node:test";
import { sameFinancialFacts } from "./restaurant-natural-agent.service.js";

test("a natural rewrite cannot change or omit a COP price",()=>{
  const original="Tu pedido: 1 × Chorizo — $7.000. Subtotal: $7.000.";
  assert.equal(sameFinancialFacts(original,
    "Te anoté 1 × Chorizo — $7.000. Subtotal: $7.000."),true);
  assert.equal(sameFinancialFacts(original,
    "Te anoté 1 × Chorizo — $9.000. Subtotal: $9.000."),false);
  assert.equal(sameFinancialFacts(original,"Anotado, quedó listo."),false);
});

test("cannot omit final confirmation words or change order number",()=>{
  const text="Pedido #212. *Total $19.000*. Respondé CONFIRMAR PEDIDO.";
  assert.equal(sameFinancialFacts(text,
    "Pedido #212, total $19.000. Confirmá: CONFIRMAR PEDIDO."),true);
  assert.equal(sameFinancialFacts(text,
    "Pedido #213, total $19.000. Confirmá: CONFIRMAR PEDIDO."),false);
  assert.equal(sameFinancialFacts(text,"Pedido #212, total $19.000."),false);
});

test("cannot omit pending payment wording or a menu URL",()=>{
  const text="https://delibocados.online/menu — Transferencia pendiente de verificar.";
  assert.equal(sameFinancialFacts(text,
    "Consultá https://delibocados.online/menu — transferencia pendiente de verificar."),true);
  assert.equal(sameFinancialFacts(text,
    "Consulta el menú; pagado."),false);
});
