/**
 * Public documentation only. Discovers the actual OpenAPI document reference
 * used by developers.toteat.com. No company secrets, DB, orders or HTTP POST.
 *
 * cd apps/api && pnpm exec tsx src/scripts/delibocados-toteat-order-contract-discover.ts
 */
import { config } from "dotenv";
config({path:"../../.env",quiet:true});
const HOST="https://developers.toteat.com/";
const pattern=/(?:https?:\/\/[^\s"'<>\\]+|\/[a-z0-9_./-]+)\.(?:json|ya?ml)(?:\?[a-z0-9_=%&.-]*)?/ig;

function compact(s:string):string {
  return s.replace(/\s+/g," ").slice(0,300);
}
async function main(){
  const response=await fetch(HOST,{method:"GET",redirect:"follow",
    signal:AbortSignal.timeout(15000),headers:{Accept:"text/html"}});
  if(!response.ok)throw new Error("DOCS_HTTP_"+response.status);
  const text=await response.text();
  if(text.length>10_000_000)throw new Error("DOCS_TOO_LARGE");
  console.log("TOTEAT_DOCS_HTTP:",response.status,"BYTES:",text.length);
  const hints=new Set<string>();
  for(const m of text.matchAll(pattern)){
    const candidate=m[0].replace(/&amp;/g,"&");
    const u=new URL(candidate,HOST);
    if(u.protocol==="https:" &&
       (u.hostname==="developers.toteat.com"||
        u.hostname.endsWith(".toteat.com"))){
      hints.add(u.toString());
    }
  }
  for(const m of text.matchAll(/(?:spec-url|specUrl|spec_url|openapi|swagger|download)[^<\n]{0,140}/ig))
    hints.add("HTML_HINT: "+compact(m[0]));
  console.log("DOCUMENT_REFERENCE_CANDIDATES:");
  for(const v of [...hints].slice(0,35))console.log(v);
  if(hints.size===0)
    console.log("NO_VISIBLE_SPEC_REFERENCE: open https://developers.toteat.com/ and click Download OpenAPI specification");
  console.log("READ_ONLY_NO_COMPANY_CREDENTIALS_NO_ORDER");
}
void main().catch(e=>{
  console.error("CONTRACT_DISCOVERY_BLOCKED:",e instanceof Error?e.message:"UNKNOWN");
  process.exitCode=1;
});
