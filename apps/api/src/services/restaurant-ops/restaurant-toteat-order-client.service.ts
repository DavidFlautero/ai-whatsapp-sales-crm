/**
 * One-only POS send. Ambiguous POST receipt triggers a GET-only search by exact
 * reference in currently OPEN orders; never another POST.
 * No persistence: the durable DB worker controls claims and outcomes.
 */
import {parseToteatPostReceipt,matchOpenToteatOrder,
  type ToteatReceipt} from "./restaurant-toteat-receipt.service.js";
import {toteatReadOnlyUrl,type ToteatCredentials} from "./restaurant-toteat-readonly.service.js";

export type ToteatSendResult=ToteatReceipt & {httpStatus:number|null};
function makeUrl(creds:ToteatCredentials,endpoint:"orders"|"orderstatus"):URL{
  const url=toteatReadOnlyUrl(creds,"shiftstatus");
  url.pathname="/mw/or/1.0/"+endpoint;
  if(endpoint==="orders")url.searchParams.set("orderDetail","true");
  else url.searchParams.set("listing","true");
  return url;
}
async function reconcileOpen(
  creds:ToteatCredentials,reference:string,fetcher:typeof fetch
):Promise<ToteatReceipt>{
  try{
    const response=await fetcher(makeUrl(creds,"orderstatus"),{
      method:"GET",redirect:"error",cache:"no-store",
      headers:{Accept:"application/json"},signal:AbortSignal.timeout(12000)
    });
    if(!response.ok)return {outcome:"unknown",externalOrderId:null,evidence:"inconclusive"};
    const raw=await response.text();
    return matchOpenToteatOrder(raw,reference);
  }catch{return {outcome:"unknown",externalOrderId:null,evidence:"inconclusive"};}
}
export async function submitOneToteatOrder(input:{
  credentials:ToteatCredentials;orderReference:string;serializedBody:string;
  fetcher?:typeof fetch;
}):Promise<ToteatSendResult>{
  const fetcher=input.fetcher??fetch;
  let response:Response;
  try{
    response=await fetcher(makeUrl(input.credentials,"orders"),{
      method:"POST",redirect:"error",cache:"no-store",
      headers:{"Content-Type":"application/json; charset=utf-8",Accept:"application/json"},
      body:input.serializedBody,signal:AbortSignal.timeout(17000)
    });
  }catch{
    const outcome=await reconcileOpen(input.credentials,input.orderReference,fetcher);
    return {...outcome,httpStatus:null};
  }
  let parsed:ToteatReceipt;
  try{
    const raw=await response.text();
    parsed=parseToteatPostReceipt(raw,response.status,input.orderReference);
  }catch{
    parsed={outcome:"unknown",externalOrderId:null,evidence:"inconclusive"};
  }
  if(parsed.outcome==="unknown"){
    const query=await reconcileOpen(input.credentials,input.orderReference,fetcher);
    if(query.outcome==="accepted")return {...query,httpStatus:response.status};
  }
  return {...parsed,httpStatus:response.status};
}
