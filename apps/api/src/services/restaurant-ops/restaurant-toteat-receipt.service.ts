/**
 * Safe interpretation of Toteat order receipts and OPEN orderstatus listing.
 * All provider order IDs stay text; JSON numbers exceeding MAX_SAFE_INTEGER
 * are stringified while parsing. Never calls POST or prints provider payloads.
 */
export type ToteatReceipt={
  outcome:"accepted"|"unknown"|"rejected";
  externalOrderId:string|null;
  evidence:"http_receipt"|"open_order_listing"|"explicit_rejection"|"inconclusive";
};
const INTEGER=/^[1-9][0-9]{5,19}$/;
type AnyRecord=Record<string,unknown>;
function rec(v:unknown):AnyRecord|null{
  return v!==null && typeof v==="object" && !Array.isArray(v)?v as AnyRecord:null;
}
export function parseToteatJsonPreservingIds(raw:string):unknown{
  if(raw.length>3_000_000)throw new Error("TOTEAT_BODY_TOO_LARGE");
  let output="",inString=false,escaped=false;
  for(let i=0;i<raw.length;){
    const ch=raw[i];
    if(inString){
      output+=ch;i++;
      if(escaped)escaped=false;
      else if(ch==="\\")escaped=true;
      else if(ch==='"')inString=false;
      continue;
    }
    if(ch==='"'){inString=true;output+=ch;i++;continue;}
    if(ch==="-" || ch>="0"&&ch<="9"){
      const match=raw.slice(i).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);
      if(match){
        const v=match[0];
        output+=/^-?\d{16,20}$/.test(v) &&
          (BigInt(v)>BigInt(Number.MAX_SAFE_INTEGER)||
           BigInt(v)<-BigInt(Number.MAX_SAFE_INTEGER))
          ?JSON.stringify(v):v;
        i+=v.length;continue;
      }
    }
    output+=ch;i++;
  }
  return JSON.parse(output) as unknown;
}
function exactOrderId(v:unknown):string|null{
  if(typeof v==="string"&&INTEGER.test(v))return v;
  if(typeof v==="number"&&Number.isSafeInteger(v)&&v>0&&INTEGER.test(String(v)))
    return String(v);
  return null;
}
type Found={orderReference?:unknown;orderId?:unknown;order_id?:unknown;id?:unknown};
function discover(root:unknown):Found[]{
  const found:Found[]=[];
  const stack:Array<{value:unknown;level:number}>=[{value:root,level:0}];
  let seen=0;
  while(stack.length&&seen++<20000){
    const {value,level}=stack.pop()!;
    if(level>8 || !value || typeof value!=="object")continue;
    if(Array.isArray(value)){
      for(const item of value)stack.push({value:item,level:level+1});
      continue;
    }
    const r=rec(value)!;
    if("orderId" in r||"order_id" in r)found.push(r);
    for(const x of Object.values(r))if(x&&typeof x==="object")
      stack.push({value:x,level:level+1});
  }
  return found;
}
export function parseToteatPostReceipt(
  raw:string,httpStatus:number,expectedReference:string
):ToteatReceipt{
  let data:unknown;
  try{data=parseToteatJsonPreservingIds(raw);}catch{
    return {outcome:"unknown",externalOrderId:null,evidence:"inconclusive"};
  }
  const body=rec(data);
  if(body?.ok===false && httpStatus>=400 && httpStatus<500 && httpStatus!==429)
    return {outcome:"rejected",externalOrderId:null,evidence:"explicit_rejection"};
  if(httpStatus<200||httpStatus>=300||body?.ok!==true)
    return {outcome:"unknown",externalOrderId:null,evidence:"inconclusive"};
  const matches=discover(data).filter(v=>v.orderReference===undefined ||
    v.orderReference===expectedReference);
  // A reference explicitly present anywhere in provider success must match.
  const refs=discover(data).map(v=>v.orderReference).filter(x=>typeof x==="string");
  if(refs.length&&refs.some(x=>x!==expectedReference))
    return {outcome:"unknown",externalOrderId:null,evidence:"inconclusive"};
  const ids=[...new Set(matches.map(v=>exactOrderId(v.orderId??v.order_id))
    .filter((v):v is string=>Boolean(v)))];
  return ids.length===1
    ?{outcome:"accepted",externalOrderId:ids[0],evidence:"http_receipt"}
    :{outcome:"unknown",externalOrderId:null,evidence:"inconclusive"};
}
export function matchOpenToteatOrder(
  raw:string,expectedReference:string
):ToteatReceipt{
  let data:unknown;
  try{data=parseToteatJsonPreservingIds(raw);}catch{
    return {outcome:"unknown",externalOrderId:null,evidence:"inconclusive"};
  }
  const envelope=rec(data);
  if(envelope?.ok!==true || !Array.isArray(envelope.data))
    return {outcome:"unknown",externalOrderId:null,evidence:"inconclusive"};
  const matches=(envelope.data as unknown[]).flatMap(x=>discover(x))
    .filter(x=>x.orderReference===expectedReference);
  if(matches.length!==1)
    return {outcome:"unknown",externalOrderId:null,evidence:"inconclusive"};
  const id=exactOrderId(matches[0].orderId??matches[0].order_id);
  return id
    ?{outcome:"accepted",externalOrderId:id,evidence:"open_order_listing"}
    :{outcome:"unknown",externalOrderId:null,evidence:"inconclusive"};
}
