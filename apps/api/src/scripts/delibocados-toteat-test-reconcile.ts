/**
 * Verify whether the ALREADY SENT single print test exists in Toteat.
 * GET-only. Does not change orders, retry the POST, read credentials aloud,
 * display other customers, mark paid or alter local test journal.
 *
 * cd /root/delibocados-toteat-review-20261109/apps/api
 * pnpm exec tsx src/scripts/delibocados-toteat-test-reconcile.ts
 */
import {config} from "dotenv";
import {readFileSync} from "node:fs";
config({path:"../../.env",quiet:true});

type RecordValue=Record<string,unknown>;
const JOURNAL="/root/delibocados-single-toteat-print-test/single-test.json";
const MAX_BODY=3_000_000;
const refPattern=/^delibocados-prueba-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function obj(value:unknown):RecordValue|null {
  return value && typeof value==="object" && !Array.isArray(value)
    ? value as RecordValue : null;
}
/* Convert 16+ digit JSON *number tokens* into strings before parsing;
   protects precise 16-digit Toteat IDs, without changing numbers in strings. */
function parsePreservingBigIntegers(raw:string):unknown{
  let converted="",inString=false,escaped=false;
  for(let i=0;i<raw.length;){
    const c=raw[i];
    if(inString){
      converted+=c;
      if(escaped)escaped=false;
      else if(c==="\\")escaped=true;
      else if(c==='"')inString=false;
      i++;continue;
    }
    if(c==='"'){inString=true;converted+=c;i++;continue;}
    if((c>="0"&&c<="9")||c==="-"){
      const m=raw.slice(i).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);
      if(m){
        const token=m[0];
        if(/^-?\d{16,20}$/.test(token)&&
          (BigInt(token)>BigInt(Number.MAX_SAFE_INTEGER)||
            BigInt(token)<-BigInt(Number.MAX_SAFE_INTEGER))){
          converted+=JSON.stringify(token);
        }else converted+=token;
        i+=token.length;continue;
      }
    }
    converted+=c;i++;
  }
  return JSON.parse(converted) as unknown;
}
function findMatchingReference(data:unknown,reference:string):RecordValue[]{
  const matches:RecordValue[]=[];
  const stack:Array<{v:unknown;depth:number}>=[{v:data,depth:0}];
  const seen=new Set<object>();
  let walked=0;
  while(stack.length && walked<20000 && matches.length<5){
    const {v,depth}=stack.pop()!;
    if(!v || typeof v!=="object" || seen.has(v))continue;
    seen.add(v);walked++;
    if(Array.isArray(v)){
      if(depth<9)for(const item of v)stack.push({v:item,depth:depth+1});
      continue;
    }
    const item=v as RecordValue;
    if(item.orderReference===reference){
      matches.push(item);
      continue;
    }
    if(depth<9)for(const child of Object.values(item))
      if(child&&typeof child==="object")stack.push({v:child,depth:depth+1});
  }
  return matches;
}
async function main(){
  const journal=JSON.parse(readFileSync(JOURNAL,"utf8")) as {
    uuid?:unknown;attemptedAt?:unknown;result?:unknown;
  };
  if(typeof journal.uuid!=="string")throw new Error("JOURNAL_UUID_MISSING");
  const reference="delibocados-prueba-"+journal.uuid;
  if(!refPattern.test(reference))throw new Error("JOURNAL_REFERENCE_INVALID");
  if(typeof journal.attemptedAt!=="string")
    throw new Error("NO_PREVIOUS_POST_ATTEMPT");
  const [{readCompanySecret},{parseToteatCredentials,toteatReadOnlyUrl}]=
    await Promise.all([
      import("../services/integrations/company-secret.repository.js"),
      import("../services/restaurant-ops/restaurant-toteat-readonly.service.js")
    ]);
  const secret=await readCompanySecret({companyId:"delibocados",provider:"toteat",keyVersion:1});
  const parsed=parseToteatCredentials(secret??"");
  if(!parsed.ok)throw new Error("TOTEAT_CREDENTIALS_INVALID");
  const url=toteatReadOnlyUrl(parsed.value,"shiftstatus");
  url.pathname="/mw/or/1.0/orderstatus";
  url.searchParams.set("listing","true");
  console.log("=== RECONCILIACION TOTEAT / SOLO GET ===");
  console.log("REFERENCE:",reference);
  console.log("AMBIENTE:",parsed.value.environment);
  console.log("CONSULTA: GET /orderstatus?listing=true (listado de ordenes abiertas)");
  let response:Response;
  try{
    response=await fetch(url,{method:"GET",redirect:"error",cache:"no-store",
      headers:{Accept:"application/json"},signal:AbortSignal.timeout(15000)});
  }catch{
    console.log("RESULT: GET_NETWORK_FAILED");
    console.log("NO_POST_NO_RETRY_NO_PRINT");
    process.exitCode=2;return;
  }
  console.log("HTTP:",response.status);
  if(!response.ok){
    console.log("RESULT: GET_NOT_OK; MUST_INSPECT_TOTEAT_UI");
    console.log("NO_POST_NO_RETRY_NO_PRINT");
    process.exitCode=2;return;
  }
  const len=Number(response.headers.get("content-length")??"0");
  if(len>MAX_BODY)throw new Error("LISTING_TOO_LARGE");
  const body=await response.text();
  if(body.length>MAX_BODY)throw new Error("LISTING_TOO_LARGE");
  let payload:unknown;
  try{payload=parsePreservingBigIntegers(body);}catch{
    throw new Error("INVALID_JSON_FROM_PROVIDER");
  }
  const envelope=obj(payload);
  if(!envelope || envelope.ok!==true){
    console.log("RESULT: LISTING_NOT_APPROVED");
    console.log("NO_POST_NO_RETRY_NO_PRINT");
    process.exitCode=2;return;
  }
  const data=envelope.data;
  console.log("DATA_TYPE:",Array.isArray(data)?"array":typeof data);
  if(Array.isArray(data))console.log("OPEN_ORDERS_COUNT:",data.length);
  const matches=findMatchingReference(data,reference);
  console.log("EXACT_REFERENCE_MATCHES:",matches.length);
  if(matches.length===1){
    const match=matches[0];
    const result={
      orderReference:reference,
      orderId:typeof match.orderId==="string"||typeof match.orderId==="number"?
        String(match.orderId):"NOT_INCLUDED",
      orderStatus:typeof match.orderStatus==="string"?match.orderStatus:
        typeof match.status==="string"?match.status:"NOT_INCLUDED",
      deliveryStatusId:typeof match.deliveryStatusId==="number"?
        match.deliveryStatusId:"NOT_INCLUDED",
    };
    console.log("FOUND_ORDER:",JSON.stringify(result));
    console.log("TOTEAT_ORDER_EXISTS: CONFIRMED");
    console.log("PRINTED_ON_PHYSICAL_PRINTER: NOT_VERIFIED");
    console.log("MANUAL_ACTION: VOID THIS TEST ORDER IN TOTEAT AND CHECK STOCK");
  }else if(matches.length>1){
    console.log("RESULT: DUPLICATE_REFERENCE_FOUND; MANUAL_CHECK_REQUIRED");
    process.exitCode=2;
  }else{
    console.log("RESULT: NOT_FOUND_IN_OPEN_LISTING");
    console.log("CAUTION: This does NOT prove rejection; could be closed or hidden");
    console.log("MANUAL_ACTION: SEARCH THIS REFERENCE IN TOTEAT BEFORE ANY OTHER POST");
  }
  console.log("NO_POST_NO_RETRY_NO_PRINT");
}
void main().catch(e=>{
  console.error("RECONCILIATION_BLOCKED:",e instanceof Error?e.message:"UNKNOWN");
  process.exitCode=1;
});
