/**
 * Delibocados QR token verifier — read-only, no secrets printed.
 * Paste the QR URL via stdin (a shell "read -rs"), never as a CLI argument.
 * Checks whether an existing printed QR can authenticate against the secure
 * checkout registry without sending the token to Nginx or any GET endpoint.
 */
import { config } from "dotenv";
import { createHash, timingSafeEqual } from "node:crypto";
config({path:"../../.env",quiet:true});
type Row = { id:string;label:string;editor_table_id:string;
  enabled:boolean;qr_token_sha256:string };
function tokenFrom(value:string) {
  const trimmed=value.trim();
  let token="", tableId="";
  try{
    const url=new URL(trimmed);
    const hash=new URLSearchParams(url.hash.replace(/^#/,""));
    token=hash.get("token") || url.searchParams.get("mesa") ||
      url.searchParams.get("codigo") || url.searchParams.get("token") || "";
    tableId=hash.get("tableId") || "";
  }catch{
    if(/^[A-Za-z0-9_-]{10,200}$/.test(trimmed)) token=trimmed;
  }
  return {token,tableId};
}
async function main(){
  if(process.stdin.isTTY){
    console.error("Entrada por stdin requerida. Pega el QR en un read -rs de la terminal.");
    process.exitCode=2;return;
  }
  let source="";
  for await(const chunk of process.stdin){
    source+=String(chunk);
    if(source.length>12000)throw new Error("QR_URL_DEMASIADO_LARGA");
  }
  const {token,tableId}=tokenFrom(source);
  source="";
  console.log("=== VERIFICACION LOCAL DE QR — SIN MOSTRAR SECRETOS ===");
  if(!/^[A-Za-z0-9_-]{32,200}$/.test(token)){
    console.log("QR NO APTO: falta token opaco de 32+ caracteres en el enlace.");
    console.log("No se realizo ninguna escritura ni se creo pedido.");
    return;
  }
  const {supabaseRequest}=await import("../services/db/supabase-rest.client.js");
  const rows=await supabaseRequest<Row[]>({
    table:"restaurant_ops_qr_tables",
    query:"?company_id=eq.delibocados&select=id,label,editor_table_id,enabled,qr_token_sha256&limit=100"
  });
  const digest=createHash("sha256").update(token).digest();
  const matches=rows.filter(r=>{
    if(!r.enabled||!/^[a-f0-9]{64}$/.test(r.qr_token_sha256))return false;
    return timingSafeEqual(digest,Buffer.from(r.qr_token_sha256,"hex"));
  });
  if(matches.length===1){
    const m=matches[0];
    console.log("TOKEN COINCIDE CON REGISTRO SEGURO: SI");
    console.log("Mesa:",m.label);
    console.log("Mesa indicada en URL coincide:",
      tableId? (tableId===m.id?"SI":"NO"):"No venia UUID en el QR");
    console.log("Puede reutilizarse el secreto en un enlace seguro; NO se imprime aqui.");
  }else{
    console.log("TOKEN COINCIDE CON REGISTRO SEGURO: NO");
    console.log("Los QR antiguos no estan demostrados como compatibles.");
    console.log("Antes de habilitar pedidos: revisar el origen del QR o emitir un nuevo QR seguro.");
  }
  console.log("FIN: SOLO LECTURA; sin pedidos, envios POS, impresion ni cambios.");
}
void main().catch(e=>{
  console.error("COMPROBACION INCOMPLETA:",e instanceof Error?e.name:"ERROR");
  process.exitCode=1;
});
