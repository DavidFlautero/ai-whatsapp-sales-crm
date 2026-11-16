/**
 * Live Toteat GET /products -> Delibocados menu reconciliation.
 * Safe by default: --preview makes no writes. --stage writes inactive proposals.
 * --approve requires prior staging and explicit sign-off; never enables export.
 *
 * Execute from apps/api. Respect Toteat /products rate limit (3/min).
 */
import {config} from "dotenv";
config({path:"../../.env",quiet:true});

type LocalDoc={revision:number;payload:{products:Array<{
  id:string;name:string;priceCOP:number;available?:boolean;priceNeedsReview?:boolean;
}>}};
type Mapping={product_id:string;external_product_code:string;active:boolean;reviewed_at:string|null};
const COMPANY="delibocados";
const action=process.argv.includes("--approve")?"approve":
  process.argv.includes("--stage")?"stage":"preview";

async function main(){
  if(process.argv.includes("--approve")&&process.argv.includes("--stage"))
    throw new Error("CONFLICTING_ACTIONS");
  const [{supabaseRequest},{readCompanySecret},
    {parseToteatCredentials,toteatReadOnlyUrl},
    {reconcileToteatProducts}]=await Promise.all([
      import("../services/db/supabase-rest.client.js"),
      import("../services/integrations/company-secret.repository.js"),
      import("../services/restaurant-ops/restaurant-toteat-readonly.service.js"),
      import("../services/restaurant-ops/restaurant-toteat-catalog-map.service.js")
    ]);
  console.log("=== DELIBOCADOS / TOTEAT MAPPING ===");
  console.log("ACCION:",action);
  console.log("ORDENES Y COMANDAS: NINGUN ENVIO");
  const [docs,maps,secret]=await Promise.all([
    supabaseRequest<LocalDoc[]>({
      table:"restaurant_menu_documents",
      query:"?company_id=eq.delibocados&select=revision,payload&limit=1"
    }),
    supabaseRequest<Mapping[]>({
      table:"restaurant_ops_pos_product_map",
      query:"?company_id=eq.delibocados&provider=eq.toteat"+
        "&select=product_id,external_product_code,active,reviewed_at&limit=1500"
    }),
    readCompanySecret({companyId:COMPANY,provider:"toteat",keyVersion:1})
  ]);
  const creds=parseToteatCredentials(secret??"");
  if(!creds.ok || !docs[0]?.payload?.products?.length)
    throw new Error("READONLY_PREREQUISITES_MISSING");
  const menu=docs[0].payload.products;
  // Only one GET; do not print credential-bearing URL or raw HTTP errors.
  let remote:unknown;
  try{
    const response=await fetch(toteatReadOnlyUrl(creds.value,"products"),{
      method:"GET",redirect:"error",cache:"no-store",
      signal:AbortSignal.timeout(15000),headers:{Accept:"application/json"}
    });
    if(!response.ok)throw new Error("API_NOT_APPROVED");
    remote=await response.json();
  }catch{
    throw new Error("TOTEAT_PRODUCTS_READ_FAILED");
  }
  const body=remote as {ok?:unknown;data?:unknown};
  if(body?.ok!==true || !Array.isArray(body.data))
    throw new Error("TOTEAT_PRODUCTS_RESPONSE_INVALID");
  const preview=reconcileToteatProducts(menu,body.data);
  const expected=menu.length;
  console.log("MENU LOCAL:",expected,"| REVISION:",docs[0].revision);
  console.log("PRODUCTOS TOTEAT:",body.data.length);
  console.log("COINCIDENCIAS EXACTAS:",preview.matched.length);
  console.log("PROBLEMAS:",preview.issues.length);
  for(const issue of preview.issues.slice(0,30))console.log("REVISAR:",issue);
  if(expected!==133 || !preview.ready)
    throw new Error("MAPPING_NOT_READY__REVIEW_CATALOG");
  const current=new Map(maps.map(m=>[m.product_id,m]));
  for(const item of preview.matched){
    const prev=current.get(item.productId);
    if(prev && prev.external_product_code!==item.externalCode)
      throw new Error("EXISTING_MAPPING_CODE_CHANGED__"+item.productId);
  }
  if(action==="preview"){
    console.log("SIN ESCRITURA: EJECUTAR --stage PARA PREPARAR 133 PROPUESTAS");
    return;
  }
  if(action==="stage"){
    const missing=preview.matched.filter(x=>!current.has(x.productId));
    if(missing.length){
      await supabaseRequest<unknown[]>({
        table:"restaurant_ops_pos_product_map",method:"POST",
        query:"?on_conflict=company_id,provider,product_id",
        prefer:"resolution=merge-duplicates,return=minimal",
        body:missing.map(x=>({
          company_id:COMPANY,provider:"toteat",product_id:x.productId,
          external_product_code:x.externalCode,active:false,reviewed_at:null
        }))
      });
    }
    console.log("PROPUESTAS NUEVAS INACTIVAS:",missing.length);
    console.log("ANTES DE APROBAR: REVISAR LOS CODIGOS Y PRECIOS EN TOTEAT");
    console.log("ENVIO A TOTEAT: BLOQUEADO");
    return;
  }
  if(process.env.DELIBOCADOS_TOTEAT_MAPPING_APPROVE!=="REVIEWED_133")
    throw new Error("OWNER_APPROVAL_REQUIRED__REVIEWED_133");
  if(maps.length!==133 ||
     preview.matched.some(x=>!current.has(x.productId)))
    throw new Error("MAPPING_MUST_BE_STAGED_FIRST");
  const now=new Date().toISOString();
  await supabaseRequest<unknown[]>({
    table:"restaurant_ops_pos_product_map",method:"POST",
    query:"?on_conflict=company_id,provider,product_id",
    prefer:"resolution=merge-duplicates,return=minimal",
    body:preview.matched.map(x=>({
      company_id:COMPANY,provider:"toteat",product_id:x.productId,
      external_product_code:x.externalCode,active:true,reviewed_at:now
    }))
  });
  console.log("APROBADOS:",preview.matched.length);
  console.log("EXPORTACION: NO SE HA ACTIVADO EL CONECTOR");
}
void main().catch(error=>{
  // Only controlled errors above: never print token, URL, or raw provider response.
  const message=error instanceof Error?error.message:"UNKNOWN";
  console.error("BLOQUEADO:",message);
  process.exitCode=1;
});
