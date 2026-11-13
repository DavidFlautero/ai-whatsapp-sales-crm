#!/usr/bin/env python3
"""Safely patch ONLY the menu response in a locally customized QR API file.

Inputs: current local TypeScript path, desired branch TypeScript path,
candidate destination. Does not modify either input.
Fails closed for unexpected layout, never discards unrelated local changes.
"""
from pathlib import Path
import sys

if len(sys.argv) != 4:
    raise SystemExit("Uso: transform.py LOCAL DESEADO CANDIDATO")
local, desired, output = map(Path, sys.argv[1:])
s = local.read_text(encoding="utf-8")
d = desired.read_text(encoding="utf-8")

def between(source: str, start: str, end: str) -> str:
    a = source.find(start)
    if a < 0:
        raise ValueError("Falta ancla "+start)
    b = source.find(end, a + len(start))
    if b < 0 or source.find(start, a + len(start)) >= 0:
        raise ValueError("Seccion no unica: "+start)
    return source[a:b]

# Only replace the original reviewed, minimal menu type. If the source
# is already upgraded, leave it intact; if a developer modified that type
# in unexpected ways, fail instead of overwriting their work.
old_type = """type MenuDoc={revision:number;payload:{products?:Array<{
  id?:string;name?:string;category?:string;available?:boolean;
  priceNeedsReview?:boolean;priceCOP?:number
}>}};
"""
new_type = between(d, "type MenuProduct=", "type Row=")
if "type MenuProduct=" not in s:
    if s.count(old_type) != 1:
        raise ValueError("El tipo MenuDoc local difiere de v1; revisar manualmente")
    s = s.replace(old_type, new_type, 1)
else:
    present = between(s, "type MenuProduct=", "type Row=")
    if present != new_type:
        raise ValueError("El tipo de catalogo local ya tiene cambios diferentes")

old_gate = "if(pilot && inputTablePilotMissing(req.body,pilot))"
new_gate = "if(checkout && pilot && inputTablePilotMissing(req.body,pilot))"
if old_gate in s:
    if s.count(old_gate) != 1:
        raise ValueError("Guardia piloto ambigua")
    s = s.replace(old_gate, new_gate, 1)
elif new_gate not in s:
    raise ValueError("Guardia piloto local distinta")

old_mapping = """      const products=(menu.payload.products??[]).filter(p=>
        typeof p.id==="string"&&typeof p.name==="string"&&
        p.available!==false&&p.priceNeedsReview!==true&&
        Number.isSafeInteger(p.priceCOP)&&Number(p.priceCOP)>=0
      ).slice(0,600).map(p=>({
        id:p.id,name:p.name,category:p.category??"",priceCOP:p.priceCOP
      }));
      res.setHeader("Cache-Control","no-store");
      return res.json({ok:true,table,revision:menu.revision,products,ordersEnabled});
"""
new_mapping = between(
    d,
    "      const media=menu.payload.images??{};",
    "    }\n    const payload=input as z.infer<typeof orderInput>;",
)
if old_mapping in s:
    if s.count(old_mapping) != 1:
        raise ValueError("Mapeo de productos no unico")
    s = s.replace(old_mapping, new_mapping, 1)
elif new_mapping not in s:
    raise ValueError("Mapeo de productos local distinto")

for marker in (
    "function publicImage(",
    "const categories=(menu.payload.categories??[])",
    "if(checkout && pilot && inputTablePilotMissing(req.body,pilot))",
    "ordersEnabled:ordersEnabled&&(!pilot||table.id.toLowerCase()===pilot.toLowerCase())",
):
    if marker not in s:
        raise ValueError("El parche no incorpora: "+marker)
if s.count("function publicImage(") != 1:
    raise ValueError("Funcion de imagenes duplicada")
if s.count("restaurantQrPublicRoutes.post(\"/order\"") != 1:
    raise ValueError("Ruta de pedido alterada/duplicada")
if s.count('const order=await supabaseRpc<Row>("restaurant_ops_create_qr_order"') != 1:
    raise ValueError("RPC de pedido alterada/duplicada")
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(s, encoding="utf-8")
print("PATCH_QR_API_OK: se conservaron los cambios fuera del catalogo y guardia piloto")
