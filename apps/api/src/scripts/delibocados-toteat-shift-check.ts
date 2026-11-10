/**
 * Toteat GET /shiftstatus for the configured Delibocados tenant.
 * Never prints secrets, the query URL, HTTP error bodies, or merchant data.
 * Does not create an order or touch the database.
 */
import {config} from "dotenv";
config({path:"../../.env",quiet:true});

type Data=Record<string,unknown>;
function object(input:unknown):Data|null {
  return input && typeof input==="object" && !Array.isArray(input) ? input as Data : null;
}
function statusSummary(input:unknown):{type:string;keys:string[];fields:Data}{
  const record=object(input);
  if(typeof input==="boolean")return {type:"boolean",keys:[],fields:{value:input}};
  if(typeof input==="string" && /^(open|closed|abierto|cerrado|active|inactive)$/i.test(input))
    return {type:"string",keys:[],fields:{value:input}};
  if(Array.isArray(input))return {type:"array",keys:[],fields:{length:input.length}};
  if(!record)return {type:input===null?"null":typeof input,keys:[],fields:{}};
  const allow=/^(?:shift(?:_|)(?:status|open|opened|active|state)|status|state|open|isopen|is_open|opened|active|turno(?:_|)(?:abierto|activo|estado)|isactive|is_active)$/i;
  const fields:Data={};
  for(const [key,value] of Object.entries(record))
    if(allow.test(key) && (typeof value==="boolean"||
         typeof value==="string" && value.length<=60||
         typeof value==="number" && Number.isFinite(value)))fields[key]=value;
  return {type:"object",keys:Object.keys(record).slice(0,30),fields};
}
async function main(){
  const [{readCompanySecret},{parseToteatCredentials,toteatReadOnlyUrl}]=await Promise.all([
    import("../services/integrations/company-secret.repository.js"),
    import("../services/restaurant-ops/restaurant-toteat-readonly.service.js")
  ]);
  const secret=await readCompanySecret({companyId:"delibocados",provider:"toteat",keyVersion:1});
  const parsed=parseToteatCredentials(secret??"");
  if(!parsed.ok)throw new Error("CREDENTIALS_NOT_READY");
  console.log("=== DELIBOCADOS / TURNO TOTEAT / SOLO LECTURA ===");
  console.log("AMBIENTE:",parsed.value.environment);
  let response:Response;
  try{
    response=await fetch(toteatReadOnlyUrl(parsed.value,"shiftstatus"),{
      method:"GET",headers:{Accept:"application/json"},
      redirect:"error",cache:"no-store",signal:AbortSignal.timeout(12000)
    });
  }catch{throw new Error("SHIFT_GET_NETWORK_ERROR");}
  console.log("HTTP:",response.status);
  if(!response.ok)throw new Error("SHIFT_GET_NOT_APPROVED");
  let payload:unknown;
  try{payload=await response.json();}catch{throw new Error("SHIFT_BAD_JSON");}
  const body=object(payload);
  if(!body || body.ok!==true)throw new Error("SHIFT_API_NOT_OK");
  console.log("API_AUTHENTICATED: true");
  const summary=statusSummary(body.data);
  console.log("DATA_TYPE:",summary.type);
  console.log("DATA_KEYS:",JSON.stringify(summary.keys));
  console.log("SAFE_SHIFT_FIELDS:",JSON.stringify(summary.fields));
  // Do not infer open shift from HTTP 200/ok:true.
  console.log("NOTE: HTTP 200/ok:true IS NOT proof of an open shift");
  console.log("NO_POST_NO_ORDER_NO_PRINT");
}
void main().catch(e=>{
  console.error("BLOCKED:",e instanceof Error?e.message:"UNKNOWN");
  process.exitCode=1;
});
