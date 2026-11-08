/**
 * Strict, read-only diagnostics for Toteat credentials belonging to Delibocados.
 * The official API requires xir/xil/xiu/xapitoken as query parameters.
 *
 * THIS MODULE NEVER POSTS ORDERS or enables a POS integration. All URLs
 * containing credentials are kept private. Do not log request objects or
 * original errors: some runtimes include the URL in the exception message.
 */
export type ToteatEnvironment = "development" | "production";
export type ToteatReadOnlyEndpoint = "shiftstatus" | "products";
export type ToteatCredentials = {
  environment:ToteatEnvironment;
  restaurantId:string;
  localNumber:string;
  userId:string;
  token:string;
};
export type ToteatCredentialParse =
  | {ok:true; value:ToteatCredentials}
  | {ok:false; reason:"NOT_STRUCTURED"|"MISSING_FIELD"|"INVALID_ID"|"INVALID_ENVIRONMENT"};
export type ToteatProbeResult = {
  connected:boolean; status:"approved"|"denied"|"http_error"|"bad_response"|"network_error";
  httpStatus?:number; productCount?:number;
};

function field(obj:Record<string,unknown>,keys:string[]):string {
  for(const key of keys){
    const value=obj[key];
    if(typeof value==="string" && value.trim())return value.trim();
    if(typeof value==="number" && Number.isSafeInteger(value) && value>0)
      return String(value);
  }
  return "";
}
export function parseToteatCredentials(secret:string):ToteatCredentialParse {
  let parsed:unknown;
  try {parsed=JSON.parse(secret);} catch {
    return {ok:false,reason:"NOT_STRUCTURED"};
  }
  if(!parsed || typeof parsed!=="object" || Array.isArray(parsed))
    return {ok:false,reason:"NOT_STRUCTURED"};
  const obj=parsed as Record<string,unknown>;
  const environment=field(obj,["environment","ambiente","env"]);
  if(environment!=="development" && environment!=="production")
    return {ok:false,reason:"INVALID_ENVIRONMENT"};
  const restaurantId=field(obj,["restaurantId","xir"]);
  const localNumber=field(obj,["localNumber","localId","xil"]);
  const userId=field(obj,["userId","xiu"]);
  const token=field(obj,["apiToken","xapitoken","token"]);
  if(!restaurantId||!localNumber||!userId||!token)
    return {ok:false,reason:"MISSING_FIELD"};
  if([restaurantId,localNumber,userId].some(x=>!/^[1-9][0-9]{0,19}$/.test(x)))
    return {ok:false,reason:"INVALID_ID"};
  if(token.length>512 || /[\x00-\x1f]/.test(token))
    return {ok:false,reason:"MISSING_FIELD"};
  return {ok:true,value:{
    environment,restaurantId,localNumber,userId,token
  }};
}
export function toteatReadOnlyUrl(
  credentials:ToteatCredentials,endpoint:ToteatReadOnlyEndpoint
):URL {
  const host=credentials.environment==="development"
    ?"apidev.toteat.com":"api.toteat.com";
  const url=new URL(`https://${host}/mw/or/1.0/${endpoint}`);
  url.searchParams.set("xir",credentials.restaurantId);
  url.searchParams.set("xil",credentials.localNumber);
  url.searchParams.set("xiu",credentials.userId);
  url.searchParams.set("xapitoken",credentials.token);
  if(endpoint==="products")url.searchParams.set("activeProducts","true");
  return url;
}
export async function probeToteatReadOnly(
  credentials:ToteatCredentials,endpoint:ToteatReadOnlyEndpoint,
  fetcher:typeof fetch=fetch
):Promise<ToteatProbeResult> {
  try{
    const url=toteatReadOnlyUrl(credentials,endpoint);
    const response=await fetcher(url,{
      method:"GET",redirect:"error",cache:"no-store",
      signal:AbortSignal.timeout(12000),
      headers:{"Accept":"application/json"}
    });
    if(response.status===401 || response.status===403)
      return {connected:false,status:"denied",httpStatus:response.status};
    if(!response.ok)
      return {connected:false,status:"http_error",httpStatus:response.status};
    let data:unknown;
    try {data=await response.json();}catch{
      return {connected:false,status:"bad_response",httpStatus:response.status};
    }
    if(!data || typeof data!=="object" || Array.isArray(data))
      return {connected:false,status:"bad_response",httpStatus:response.status};
    const obj=data as Record<string,unknown>;
    if(obj.ok!==true)
      return {connected:false,status:"denied",httpStatus:response.status};
    if(endpoint==="products"){
      if(!Array.isArray(obj.data))
        return {connected:false,status:"bad_response",httpStatus:response.status};
      return {connected:true,status:"approved",httpStatus:response.status,productCount:obj.data.length};
    }
    return {connected:true,status:"approved",httpStatus:response.status};
  }catch{
    return {connected:false,status:"network_error"};
  }
}
