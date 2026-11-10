/**
 * SINGLE, OPERATOR-AUTHORIZED production print test, NOT order exporter.
 *
 * PREPARE (does NOT contact Toteat or send orders):
 *   pnpm exec tsx src/scripts/delibocados-toteat-single-print-test.ts --prepare
 *
 * SEND ONCE, explicit production authorization:
 *   DELIBOCADOS_TOTEAT_TEST_SEND=ONE_TEST_ORDER_I_AUTHORIZE \
 *   pnpm exec tsx src/scripts/delibocados-toteat-single-print-test.ts --send
 *
 * This WILL CREATE a real external order in Toteat and may print a ticket.
 * Manual cancellation/void after verification required. NEVER retry a timeout.
 * Does not write CRM, maps, courier, or send WhatsApp.
 */
import {config} from "dotenv";
import {randomUUID} from "node:crypto";
import {mkdirSync,readFileSync,writeFileSync,chmodSync} from "node:fs";
import {join} from "node:path";
import {
  buildSingleTestOrder,serializeExactToteatTestOrder,parseToteatTestReceipt
} from "../services/restaurant-ops/restaurant-toteat-test-order.service.js";
config({path:"../../.env",quiet:true});
const DIR="/root/delibocados-single-toteat-print-test";
const FILE=join(DIR,"single-test.json");
type Journal={
  version:1;uuid:string;createdAt:string;attemptedAt:string|null;
  result:null|{outcome:"accepted"|"rejected"|"unknown";
    httpStatus:number|null;externalOrderId:string|null};
};
function journal(value:Journal,flag:"wx"|"w"="w"){
  writeFileSync(FILE,JSON.stringify(value,null,2)+"\n",
    {encoding:"utf8",mode:0o600,flag});
  chmodSync(FILE,0o600);
}
function readJournal():Journal{
  const data=JSON.parse(readFileSync(FILE,"utf8")) as Journal;
  if(data?.version!==1 ||
     !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.uuid) ||
     Number.isNaN(Date.parse(data.createdAt)) ||
     typeof data.attemptedAt==="undefined" ||
     typeof data.result==="undefined")
    throw new Error("LOCAL_TEST_JOURNAL_INVALID");
  return data;
}
function ensureDir(){
  mkdirSync(DIR,{recursive:true,mode:0o700});
  chmodSync(DIR,0o700);
}
async function readPublicToteatJson(url:URL):Promise<Record<string,unknown>>{
  let response:Response;
  try{
    response=await fetch(url,{method:"GET",redirect:"error",cache:"no-store",
      signal:AbortSignal.timeout(12000),headers:{Accept:"application/json"}});
  }catch{throw new Error("TOTEAT_GET_NETWORK_FAILED");}
  if(!response.ok)throw new Error("TOTEAT_GET_HTTP_"+response.status);
  let data:unknown;
  try{data=await response.json();}catch{throw new Error("TOTEAT_GET_JSON_INVALID");}
  if(!data||typeof data!=="object"||Array.isArray(data)||
     (data as {ok?:unknown}).ok!==true)
    throw new Error("TOTEAT_GET_NOT_APPROVED");
  return data as Record<string,unknown>;
}
async function main(){
  const arg=process.argv[2];
  if(arg!=="--prepare"&&arg!=="--send")
    throw new Error("USE_PREPARE_OR_SEND_EXPLICITLY");
  ensureDir();
  if(arg==="--prepare"){
    const draft:Journal={version:1,uuid:randomUUID(),
      createdAt:new Date().toISOString(),attemptedAt:null,result:null};
    journal(draft,"wx"); // refuses a second test if one already exists
    console.log("=== PRUEBA TOTEAT / PREPARADA / NINGUN ENVIO ===");
    console.log("REFERENCE: delibocados-prueba-"+draft.uuid);
    console.log("PRODUCTO: 1 x Chicharrón Porción, DB1132, COP 8001");
    console.log("TIPO: pickup | CANAL: crm | PAGO: efectivo PENDIENTE, pagado=0");
    console.log("NOTA: no cobrar/no preparar; anular en Toteat tras observar impresión");
    console.log("CONSERVAR ESTE ARCHIVO: "+FILE);
    console.log("SIN_POST_SIN_IMPRESION");
    return;
  }
  if(process.env.DELIBOCADOS_TOTEAT_TEST_SEND!=="ONE_TEST_ORDER_I_AUTHORIZE")
    throw new Error("EXPLICIT_PRODUCTION_TEST_AUTHORIZATION_REQUIRED");
  const state=readJournal();
  const age=Date.now()-Date.parse(state.createdAt);
  if(age<0||age>30*60*1000)throw new Error("PREPARED_TEST_EXPIRED_NO_POST");
  if(state.attemptedAt || state.result)throw new Error("ALREADY_ATTEMPTED_NO_RETRY");
  const [{readCompanySecret},{parseToteatCredentials,toteatReadOnlyUrl}]=
    await Promise.all([
      import("../services/integrations/company-secret.repository.js"),
      import("../services/restaurant-ops/restaurant-toteat-readonly.service.js")
    ]);
  const secret=await readCompanySecret({companyId:"delibocados",
    provider:"toteat",keyVersion:1});
  const parsed=parseToteatCredentials(secret??"");
  if(!parsed.ok)throw new Error("TOTEAT_CREDENTIALS_INVALID");
  const creds=parsed.value;
  if(creds.environment!=="production")throw new Error("NOT_PRODUCTION_AS_EXPECTED");
  const shift=await readPublicToteatJson(toteatReadOnlyUrl(creds,"shiftstatus"));
  const status=(shift.data && typeof shift.data==="object" &&
    !Array.isArray(shift.data) ? (shift.data as {status?:unknown}).status:null);
  if(String(status).toLowerCase()!=="open")throw new Error("TOTEAT_SHIFT_NOT_OPEN");
  // A single fresh GET /products confirms no catalog drift since the owner
  // approved the product. Never send if code, name, price or modifier changed.
  const products=await readPublicToteatJson(toteatReadOnlyUrl(creds,"products"));
  if(!Array.isArray(products.data))throw new Error("TOTEAT_PRODUCT_LIST_MISSING");
  const matching=(products.data as Array<Record<string,unknown>>).filter(x=>
    x.localCode==="DB1132" && x.name==="Chicharrón Porción" &&
    x.price===8001 && x.isModifier===false);
  if(matching.length!==1)throw new Error("TEST_PRODUCT_NOT_EXACTLY_VERIFIED");
  const payload=buildSingleTestOrder({
    restaurantId:creds.restaurantId,localNumber:creds.localNumber
  },state.uuid,new Date().toISOString());
  const body=serializeExactToteatTestOrder(payload);
  const url=toteatReadOnlyUrl(creds,"shiftstatus");
  url.pathname="/mw/or/1.0/orders";
  url.searchParams.set("orderDetail","true");
  console.log("=== ENVIO UNICO TOTEAT ===");
  console.log("REFERENCE:",payload.orderReference);
  console.log("SHIFT: open | SKU: DB1132 verified | 8001 COP");
  console.log("REGISTRANDO INTENTO DURABLE ANTES DEL POST");
  state.attemptedAt=new Date().toISOString();
  state.result={outcome:"unknown",httpStatus:null,externalOrderId:null};
  journal(state);
  // No retry, even when the POST times out after reaching Toteat.
  let response:Response;
  try{
    response=await fetch(url,{method:"POST",redirect:"error",cache:"no-store",
      headers:{"Content-Type":"application/json; charset=utf-8",
        Accept:"application/json"},body,
      signal:AbortSignal.timeout(17000)});
  }catch{
    console.log("RESULT: UNKNOWN_NETWORK_DO_NOT_REPEAT_POST");
    process.exitCode=2;
    return;
  }
  let raw="";
  try{raw=await response.text();}
  catch{
    console.log("RESULT: UNKNOWN_READ_ERROR_DO_NOT_REPEAT_POST");
    process.exitCode=2;return;
  }
  const result=parseToteatTestReceipt(raw,response.status);
  state.result={...result,httpStatus:response.status};
  journal(state);
  console.log("HTTP:",response.status);
  console.log("RESULT:",result.outcome.toUpperCase());
  console.log("TOTEAT_ID:",result.externalOrderId??"NOT_RETURNED");
  if(result.outcome==="accepted")
    console.log("VERIFICAR EN TOTEAT Y SI SALIO PAPEL DE COCINA; DESPUES ANULAR LA ORDEN DE PRUEBA");
  else{
    console.log("NO HACER SEGUNDO POST; REVISAR EN TOTEAT SI LA REFERENCIA EXISTE");
    process.exitCode=2;
  }
  console.log("TEST_JOURNAL:",FILE);
}
void main().catch(e=>{
  console.error("TEST_BLOCKED:",e instanceof Error?e.message:"UNKNOWN");
  process.exitCode=1;
});
