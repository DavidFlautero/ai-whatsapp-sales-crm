/**
 * Delibocados read-only audit: compare live QR editor (3500) to the secure
 * checkout table registry (Supabase). Never print QR tokens or token hashes.
 */
import { config } from "dotenv";
config({path:"../../.env",quiet:true});

type DbRow={id:string;label:string;editor_table_id:string;enabled:boolean};
type AnyRow=Record<string,unknown>;
function list(value:unknown):AnyRow[] {
  if(Array.isArray(value))return value.filter((x):x is AnyRow=>!!x&&typeof x==="object");
  if(value&&typeof value==="object"){
    const obj=value as Record<string,unknown>;
    for(const k of ["tables","mesas","data","items","results"]){
      if(obj[k]!==undefined){
        const found=list(obj[k]);
        if(found.length)return found;
      }
    }
  }
  return [];
}
function str(v:unknown){return typeof v==="string" ? v.trim() : "";}
function labelOf(x:AnyRow){return str(x.label||x.nombre||x.name||x.numero||x.number);}
async function main(){
  const { supabaseRequest }=await import("../services/db/supabase-rest.client.js");
  const rows=await supabaseRequest<DbRow[]>({table:"restaurant_ops_qr_tables",
    query:"?company_id=eq.delibocados&select=id,label,editor_table_id,enabled&order=label.asc&limit=100"});
  console.log("=== QR REGISTRY (SOLO LECTURA, SIN TOKENS) ===");
  console.log("Total checkout:",rows.length,"Activas:",rows.filter(x=>x.enabled).length);
  for(const row of rows)console.log("DB",JSON.stringify({
    mesa:row.label,editorId:row.editor_table_id,checkoutUuidSuffix:row.id.slice(-8),
    activa:row.enabled
  }));
  console.log("=== QR EDITOR (NO SE IMPRIMEN TOKENS NI URLS) ===");
  try{
    const r=await fetch("https://delibocados.online/restaurant-qr/tables",{
      headers:{"Accept":"application/json"},signal:AbortSignal.timeout(10000)
    });
    console.log("HTTP:",r.status);
    if(!r.ok) return;
    const ct=r.headers.get("content-type")||"";
    if(!ct.includes("json")){console.log("Editor: no devuelve JSON");return;}
    const response=await r.json() as unknown;
    const editor=list(response);
    console.log("Mesas publicadas por editor:",editor.length);
    if(!editor.length){
      console.log("No se pudo interpretar el formato del editor; no se hace comparacion.");
      return;
    }
    for(const entry of editor){
      const id=str(entry.id||entry.tableId||entry.table_id||entry.mesaId||entry.mesa_id);
      const label=labelOf(entry);
      const match=rows.find(row=>row.editor_table_id===id)
        ?? rows.find(row=>row.label.toLowerCase()===label.toLowerCase()&&!!label);
      console.log("EDITOR",JSON.stringify({
        mesa:label||"(sin etiqueta)",
        enCheckout:!!match, via:match?(match.editor_table_id===id?"editor_id":"etiqueta"):"-"
      }));
    }
  }catch(_){
    console.log("Editor sin respuesta valida; pendiente comparar IDs, no activar checkout.");
  }
  console.log("Nota: coincidencia por etiqueta NO verifica tokens ni hashes.");
  console.log("=== FIN: no se crearon pedidos ni cambiaron registros ===");
}
void main().catch(()=>{console.error("AUDITORIA QR INCOMPLETA, SIN CAMBIOS");process.exitCode=1;});
