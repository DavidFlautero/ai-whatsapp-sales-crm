/**
 * Narrow owner-authorized repair of deli-055. No bulk menu update, no POS send.
 * Preview by default. --apply performs a compare-and-swap on document revision.
 * Read-only Toteat GET verifies the exact approved $8,001 COP and DB1132.
 */
import {config} from "dotenv";
config({path:"../../.env",quiet:true});
type Product={id:string;name:string;priceCOP:number;available?:boolean;priceNeedsReview?:boolean};
type MenuDoc={revision:number;payload:{products:Product[]}&Record<string,unknown>};
const EXPECTED={id:"deli-055",name:"Chicharrón Porción",price:8001,code:"DB1132"};
async function main(){
  const apply=process.argv.includes("--apply");
  const [{supabaseRequest},{readCompanySecret},{parseToteatCredentials,toteatReadOnlyUrl}]=
    await Promise.all([
      import("../services/db/supabase-rest.client.js"),
      import("../services/integrations/company-secret.repository.js"),
      import("../services/restaurant-ops/restaurant-toteat-readonly.service.js")
    ]);
  const [docs,secret]=await Promise.all([
    supabaseRequest<MenuDoc[]>({table:"restaurant_menu_documents",
      query:"?company_id=eq.delibocados&select=revision,payload&limit=2"}),
    readCompanySecret({companyId:"delibocados",provider:"toteat",keyVersion:1})
  ]);
  if(docs.length!==1 || !Array.isArray(docs[0].payload?.products) ||
     docs[0].payload.products.length!==133)
    throw new Error("MENU_DOCUMENT_UNEXPECTED");
  const doc=docs[0];
  const matches=doc.payload.products.filter(x=>x.id===EXPECTED.id);
  if(matches.length!==1)throw new Error("MENU_PRODUCT_NOT_UNIQUE");
  const local=matches[0];
  if(local.name!==EXPECTED.name || local.priceCOP!==EXPECTED.price ||
     local.available!==true)throw new Error("LOCAL_PRODUCT_CHANGED");
  const parsed=parseToteatCredentials(secret??"");
  if(!parsed.ok)throw new Error("TOTEAT_CREDENTIALS_NOT_READY");
  let remote:unknown;
  try{
    const response=await fetch(toteatReadOnlyUrl(parsed.value,"products"),{
      method:"GET",redirect:"error",cache:"no-store",
      headers:{Accept:"application/json"},signal:AbortSignal.timeout(12000)
    });
    if(!response.ok)throw new Error("HTTP");
    remote=await response.json();
  }catch{throw new Error("TOTEAT_GET_FAILED");}
  const body=remote as {ok?:unknown;data?:Array<{
    name?:string;price?:number;localCode?:string;isModifier?:boolean;
  }>};
  if(body?.ok!==true||!Array.isArray(body.data))throw new Error("TOTEAT_BAD_PRODUCTS");
  const matchesRemote=body.data.filter(x=>x.name===EXPECTED.name &&
    x.price===EXPECTED.price && x.localCode===EXPECTED.code &&
    x.isModifier===false);
  if(matchesRemote.length!==1)throw new Error("TOTEAT_PRODUCT_NOT_EXACT");
  console.log("DELIBOCADOS PRODUCT VERIFIED",{
    id:EXPECTED.id,name:EXPECTED.name,priceCOP:EXPECTED.price,
    toteatCode:EXPECTED.code,revision:doc.revision,
    priceNeedsReview:local.priceNeedsReview===true
  });
  if(!apply){console.log("PREVIEW_ONLY: no DB changes");return;}
  if(process.env.DELIBOCADOS_APPROVE_055!=="CONFIRM_8001_DB1132")
    throw new Error("EXPLICIT_APPROVAL_REQUIRED");
  if(local.priceNeedsReview===false){
    console.log("ALREADY_APPROVED: no changes");return;
  }
  if(local.priceNeedsReview!==true)
    throw new Error("REVIEW_STATE_UNEXPECTED");
  // Optimistic CAS: if any other admin changed the document, update no rows.
  const newProducts=doc.payload.products.map(x=>x.id===EXPECTED.id
    ? {...x,priceNeedsReview:false}:x);
  const rows=await supabaseRequest<MenuDoc[]>({
    table:"restaurant_menu_documents",method:"PATCH",
    query:"?company_id=eq.delibocados&revision=eq."+doc.revision+
      "&select=revision,payload",
    body:{revision:doc.revision+1,payload:{...doc.payload,products:newProducts}},
    prefer:"return=representation"
  });
  if(rows.length!==1||rows[0].revision!==doc.revision+1 ||
     rows[0].payload?.products?.find(x=>x.id===EXPECTED.id)?.priceNeedsReview!==false)
    throw new Error("CAS_CONFLICT_CHECK_MENU");
  console.log("APPROVED_055: catalog revision",rows[0].revision);
  console.log("NO_ORDERS_SENT_NO_POS_ENABLED");
}
void main().catch(e=>{
  console.error("BLOCKED:",e instanceof Error?e.message:"UNKNOWN");
  process.exitCode=1;
});
