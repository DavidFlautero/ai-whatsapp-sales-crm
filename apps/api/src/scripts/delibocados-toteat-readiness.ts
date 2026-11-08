/**
 * READ-ONLY diagnostic. Does not send orders, call Toteat, print keys, mutate
 * tables or enable live mode. Run only after applying the POS export migration:
 * pnpm --filter @ventas/api exec tsx src/scripts/delibocados-toteat-readiness.ts
 */
import {config} from "dotenv";
config({path:"../../.env",quiet:true});

type Row=Record<string,unknown>;
function label(name:string,ok:boolean,detail:string){
  console.log((ok?"OK      ":"PENDIENTE")+" | "+name+" | "+detail);
}
async function main(){
  const companyId="delibocados";
  console.log("=== DELIBOCADOS / TOTEAT / SOLO LECTURA ===");
  const [{supabaseRequest},{getCompanyIntegration},{readCompanySecret}]=await Promise.all([
    import("../services/db/supabase-rest.client.js"),
    import("../services/integrations/company-integration.repository.js"),
    import("../services/integrations/company-secret.repository.js")
  ]);
  const configured=await getCompanyIntegration(companyId,"toteat");
  label("Registro de integración",Boolean(configured),
    configured?"Existe en company_integrations":"No existe para este tenant");
  label("Habilitada en el panel",configured?.status==="connected"&&configured?.enabled===true,
    configured?(configured.status+", enabled="+String(configured.enabled)):"Pendiente");
  let secretPresent=false;
  try{
    const secret=await readCompanySecret({companyId,provider:"toteat",keyVersion:1});
    secretPresent=Boolean(secret?.trim());
    let fields:Record<string,unknown>={};
    if(secretPresent){
      try {
        const parsed=JSON.parse(secret!) as unknown;
        if(parsed && typeof parsed==="object" && !Array.isArray(parsed))
          fields=parsed as Record<string,unknown>;
      } catch { /* A token string alone does not verify restaurant/local IDs. */ }
    }
    label("Secreto cifrado",secretPresent,
      secretPresent?"Se pudo descifrar; contenido oculto":"No se encontró una credencial descifrable");
    const has=(...aliases:string[])=>aliases.some(a=>
      typeof fields[a]==="string" && Boolean((fields[a] as string).trim()) ||
      typeof fields[a]==="number" && Number.isFinite(fields[a]));
    label("Token en secreto estructurado",has("token","apiToken","xapitoken"),"Valores ocultos");
    label("ID restaurante",has("restaurantId","xir"),"Valores ocultos");
    label("ID local",has("localNumber","localId","xil"),"Valores ocultos");
    label("ID usuario",has("userId","xiu"),"Valores ocultos");
  }catch{
    label("Secreto cifrado",false,"No se pudo leer con la clave maestra de este proceso");
  }
  try {
    const [exports,orders,maps]=await Promise.all([
      supabaseRequest<Row[]>({table:"restaurant_ops_pos_exports",
        query:"?company_id=eq.delibocados&provider=eq.toteat"+
          "&select=order_id,status,attempts,reason,external_order_id,created_at"+
          "&order=created_at.desc&limit=100"}),
      supabaseRequest<Row[]>({table:"restaurant_ops_orders",
        query:"?company_id=eq.delibocados&source=eq.whatsapp"+
          "&select=id,number,status,payment_status,created_at"+
          "&order=created_at.desc&limit=10"}),
      supabaseRequest<Row[]>({table:"restaurant_ops_pos_product_map",
        query:"?company_id=eq.delibocados&provider=eq.toteat"+
          "&select=product_id,active,reviewed_at&limit=1500"})
    ]);
    const mapped=new Set(maps.filter(x=>x.active===true&&Boolean(x.reviewed_at))
      .map(x=>String(x.product_id)));
    const ids=orders.map(x=>String(x.id));
    const items=ids.length?await supabaseRequest<Row[]>({
      table:"restaurant_ops_order_items",
      query:"?company_id=eq.delibocados&order_id=in.("+
        ids.map(encodeURIComponent).join(",")+")&select=order_id,product_id"
    }):[];
    const stateCount=new Map<string,number>();
    for(const x of exports){
      const name=String(x.status);
      stateCount.set(name,(stateCount.get(name)??0)+1);
    }
    console.log("Exportaciones registradas (máx. 100):",
      JSON.stringify(Object.fromEntries(stateCount)));
    console.log("Mapeos de productos revisados:",mapped.size);
    for(const order of orders){
      const id=String(order.id);
      const exportRow=exports.find(x=>x.order_id===id);
      const lines=items.filter(x=>x.order_id===id);
      const missing=lines.filter(x=>!mapped.has(String(x.product_id))).length;
      console.log("Pedido #"+String(order.number)+":",
        "estado="+String(order.status),
        "pago="+String(order.payment_status),
        "POS="+String(exportRow?.status??"NO_REGISTRADO_ANTES_DE_MIGRACION"),
        "líneas="+lines.length,
        "sin_mapeo="+missing);
    }
    label("Envíos reales",false,
      "NO implementados ni activados; no hay transporte POST/Print Server");
  }catch{
    label("Esquema POS",false,
      "No se pudo leer el outbox/mapeos. Verificar migración 20261108190000.");
  }
  console.log("=== FIN: no hubo POST, impresiones ni mutaciones ===");
}
void main().catch(()=>{
  console.error("PRECHECK_INCOMPLETO (no se envió nada)");
  process.exitCode=1;
});
