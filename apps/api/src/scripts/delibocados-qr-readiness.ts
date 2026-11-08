/**
 * Read-only Delibocados QR / POS360 staging preflight.
 * No token values, customer identities, network POST, printer or state change.
 */
import {config} from "dotenv";
config({path:"../../.env",quiet:true});
type Row=Record<string,unknown>;
async function main(){
 const {supabaseRequest}=await import("../services/db/supabase-rest.client.js");
 console.log("=== DELIBOCADOS QR / POS360 READINESS (READ ONLY) ===");
 console.log("API flag QR:",process.env.DELIBOCADOS_QR_CHECKOUT_ENABLED==="1"
   ?"CONFIGURADO EN ESTE PROCESO":"NO ACTIVADO EN ESTE PROCESO");
 try{
  const [tables,general,orders,exports,integrations,maps]=await Promise.all([
   supabaseRequest<Row[]>({table:"restaurant_ops_qr_tables",
     query:"?company_id=eq.delibocados&select=id,enabled&limit=100"}),
   supabaseRequest<Row[]>({table:"restaurant_ops_qr_general",
     query:"?company_id=eq.delibocados&select=enabled&limit=1"}),
   supabaseRequest<Row[]>({table:"restaurant_ops_orders",
     query:"?company_id=eq.delibocados&source=eq.qr"+
       "&select=id,fulfillment_mode,qr_kind&limit=100"}),
   supabaseRequest<Row[]>({table:"restaurant_ops_pos_exports",
     query:"?company_id=eq.delibocados&provider=eq.pos360"+
       "&select=status,attempts&limit=100"}),
   supabaseRequest<Row[]>({table:"company_integrations",
     query:"?company_id=eq.delibocados&provider=eq.pos360"+
       "&select=enabled,status&limit=1"}),
   supabaseRequest<Row[]>({table:"restaurant_ops_pos_product_map",
     query:"?company_id=eq.delibocados&provider=eq.pos360"+
       "&select=active,reviewed_at&limit=2000"})
  ]);
  console.log("Tablas QR registradas:",tables.length);
  console.log("Tablas QR habilitadas:",tables.filter(x=>x.enabled===true).length);
  console.log("QR general activo:",general[0]?.enabled===true?"SI":"NO");
  console.log("Pedidos QR (hasta 100):",orders.length);
  console.log("Pedidos QR dine_in:",orders.filter(x=>x.fulfillment_mode==="dine_in").length);
  console.log("Exportaciones POS360 (hasta 100):",exports.length);
  console.log("Exportaciones POS360 enviadas/aceptadas:",exports.filter(x=>x.status==="accepted").length);
  console.log("Productos POS360 con mapeo revisado:",
    maps.filter(x=>x.active===true&&x.reviewed_at!==null).length);
  console.log("Integración POS360:",integrations.length?
    String(integrations[0].status)+" / "+String(integrations[0].enabled):"NO CONFIGURADA");
  console.log("Puente Windows / Print Server: NO VERIFICADO");
 }catch{
  console.log("QR schema: NO DISPONIBLE (falta instalar migración o revisar permisos)");
  process.exitCode=1;
 }
 console.log("=== FIN: NO SE CREÓ, ENVIÓ NI IMPRIMIÓ NINGÚN PEDIDO ===");
}
void main().catch(()=>{
 console.error("PRECHECK_INCOMPLETO (sin cambios en la base de datos)");
 process.exitCode=1;
});
