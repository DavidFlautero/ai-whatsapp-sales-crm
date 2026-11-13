/**
 * Resolve a single QR pilot table by trusted DB label (read-only).
 * Prints only one nonsecret UUID, never a token, hash or customer data.
 */
import { config } from "dotenv";
config({ path: "../../.env", quiet: true });

async function main(){
  const {supabaseRequest}=await import("../services/db/supabase-rest.client.js");
  const rows=await supabaseRequest<Array<{id:string;label:string;enabled:boolean}>>({
    table:"restaurant_ops_qr_tables",
    query:"?company_id=eq.delibocados&label=eq.Mesa%206&enabled=eq.true&select=id,label,enabled&limit=2"
  });
  if(rows.length!==1 || !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(rows[0].id)){
    console.error("BLOQUEADO: Mesa 6 no tiene exactamente un UUID seguro habilitado.");
    process.exitCode=2;return;
  }
  console.log("DELIBOCADOS_PILOT_TABLE="+rows[0].id);
}
void main().catch(()=>{
  console.error("BLOQUEADO: no se pudo leer Mesa 6 del registro seguro.");
  process.exitCode=1;
});
