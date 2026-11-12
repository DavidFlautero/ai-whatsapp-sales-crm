/**
 * Auditoria no destructiva. La salida contiene SOLO estructura, etiquetas de
 * mesas y totales. Nunca publica tokens, enlaces QR ni secretos.
 */
import { config } from "dotenv";
config({path:"../../.env",quiet:true});

type Table = {id:string;label:string;editor_table_id:string;enabled:boolean};
type RecordValue = Record<string,unknown>;
const isObject=(x:unknown):x is RecordValue=>
  !!x && typeof x==="object" && !Array.isArray(x);
const s=(x:unknown)=>typeof x==="string"?x.trim():"";
const safeKeys=(x:RecordValue)=>Object.keys(x).slice(0,32).sort();
const suspicious=(x:RecordValue)=>Object.keys(x).some(k=>
  /(^|[_-])(token|secret|codigo|code|hash|key|qr[_-]?url)([_-]|$)/i.test(k)
);
function walk(x:unknown, path="$", depth=0, seen=new Set<unknown>()):
  Array<{path:string;count:number;keys:string[];entries:RecordValue[]}>{
  if(depth>5 || x===null || typeof x!=="object" || seen.has(x))return [];
  seen.add(x);
  let arrays:Array<{path:string;count:number;keys:string[];entries:RecordValue[]}>= [];
  if(Array.isArray(x)){
    const entries=x.filter(isObject);
    arrays.push({path,count:x.length,keys:entries[0]?safeKeys(entries[0]):[],entries});
    if(x.length){
      for(const [i,entry] of x.slice(0,2).entries())
        arrays.push(...walk(entry,path+"["+i+"]",depth+1,seen));
    }
  } else if(isObject(x)){
    for(const key of Object.keys(x).slice(0,30)){
      const v=x[key];
      if(v!==null && typeof v==="object")
        arrays.push(...walk(v,path+"."+key,depth+1,seen));
    }
  }
  return arrays;
}
function ids(row:RecordValue){
  return [
    row.id,row.tableId,row.table_id,row.mesaId,row.mesa_id,
    row.editorId,row.editor_id,row.editorTableId,row.editor_table_id
  ].map(s).filter(Boolean);
}
function label(row:RecordValue){
  return s(row.label||row.nombre||row.name||row.mesa||row.numero||"");
}
async function main(){
  const {supabaseRequest}=await import("../services/db/supabase-rest.client.js");
  const tables=await supabaseRequest<Table[]>({table:"restaurant_ops_qr_tables",
    query:"?company_id=eq.delibocados&select=id,label,editor_table_id,enabled&limit=100"});
  console.log("=== REGISTRO DE CHECKOUT (SIN IDs NI TOKENS) ===");
  console.log("Mesas:",tables.length,"Habilitadas:",tables.filter(t=>t.enabled).length);
  console.log("Mesa 4 en registro:",tables.some(x=>x.label==="Mesa 4"&&x.enabled)?"SI":"NO");
  const response=await fetch("https://delibocados.online/restaurant-qr/tables",{
    headers:{Accept:"application/json"},signal:AbortSignal.timeout(10000)
  });
  const type=(response.headers.get("content-type")||"").split(";")[0];
  console.log("=== EDITOR PUBLICO QR ===");
  console.log("HTTP:",response.status,"Contenido:",type);
  if(!response.ok||!type.includes("json")){
    console.log("No se puede interpretar el editor como JSON. Sin cambios.");
    return;
  }
  const body:unknown=await response.json();
  if(Array.isArray(body))console.log("Raiz: array",body.length);
  else if(isObject(body))console.log("Claves raiz:",safeKeys(body).join(", ")||"(ninguna)");
  else console.log("Raiz:",body===null?"null":typeof body);
  const arrays=walk(body);
  console.log("Arrays encontrados:",arrays.length);
  for(const a of arrays.slice(0,12)){
    console.log("ESTRUCTURA",JSON.stringify({ruta:a.path,
      elementos:a.count,camposDelPrimerRegistro:a.keys}));
  }
  const candidates=arrays.filter(a=>
    a.entries.some(e=>
      ids(e).some(v=>v.startsWith("mesa_")) ||
      /^(Mesa\s*\d+|Barra)/i.test(label(e))
    ));
  const main=candidates.sort((a,b)=>b.entries.length-a.entries.length)[0];
  if(!main){
    console.log("SIN EMPAREJAMIENTO: el JSON no contiene una lista de mesas reconocible.");
    console.log("No se deduce que el editor tenga 0 mesas.");
    return;
  }
  const matches=new Set<string>();
  let exactId=0,byLabel=0,unknown=0,leak=0;
  for(const row of main.entries){
    if(suspicious(row))leak++;
    const byId=tables.find(t=>ids(row).includes(t.editor_table_id));
    const byName=byId?undefined:tables.find(t=>label(row)!=="" &&
      t.label.toLowerCase()===label(row).toLowerCase());
    const match=byId||byName;
    if(match)matches.add(match.id);
    if(byId)exactId++;
    else if(byName)byLabel++;
    else unknown++;
  }
  console.log("=== COMPARACION (SIN CODIGOS QR) ===");
  console.log("Ruta:",main.path);
  console.log("Editor:",main.entries.length,"por editor ID:",exactId,
    "solo por nombre:",byLabel,"sin vinculo:",unknown);
  console.log("Checkout sin mesa del editor:",tables.filter(x=>!matches.has(x.id)).length);
  if(leak)console.log("ALERTA: entradas con campos que parecen codigos/secretos QR:",leak,
    "(no se muestran valores; revisar si el endpoint permite enumerar tokens)");
  console.log("IMPORTANTE: vincular ID/nombre no comprueba el hash secreto del QR.");
  console.log("=== FIN SIN ESCRITURAS ===");
}
void main().catch(e=>{
  console.error("AUDITORIA INCOMPLETA",e instanceof Error?e.name:"ERROR");
  process.exitCode=1;
});
