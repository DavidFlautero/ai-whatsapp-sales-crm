/** Deterministic product matching. No fuzzy prices, IDs or extras. */
type LocalProduct={id:string;name:string;priceCOP:number;available?:boolean;priceNeedsReview?:boolean};
type ToteatProduct={name?:unknown;price?:unknown;localCode?:unknown;isModifier?:unknown};
export type ToteatMapLine={
  productId:string;productName:string;priceCOP:number;externalCode:string;
};
export type ToteatMapPreview={
  ready:boolean;matched:ToteatMapLine[];issues:string[];
};
export function normalizeToteatName(s:string):string{
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .toLocaleLowerCase("es-CO").replace(/\s+/g," ").trim();
}
export function reconcileToteatProducts(
  local:LocalProduct[],remote:ToteatProduct[]
):ToteatMapPreview{
  const issues:string[]=[];
  const matched:ToteatMapLine[]=[];
  const remoteByName=new Map<string,ToteatProduct[]>();
  for(const product of remote){
    if(product.isModifier!==false || typeof product.name!=="string")continue;
    const name=normalizeToteatName(product.name);
    remoteByName.set(name,[...(remoteByName.get(name)??[]),product]);
  }
  const seenLocal=new Set<string>(),usedCodes=new Set<string>();
  for(const product of local){
    const id=String(product.id??""),name=normalizeToteatName(String(product.name??""));
    if(!id || !name || seenLocal.has(id)){
      issues.push("LOCAL_ID_INVALID_OR_DUPLICATE");continue;
    }
    seenLocal.add(id);
    if(product.available===false || product.priceNeedsReview===true ||
       !Number.isSafeInteger(Number(product.priceCOP)) || Number(product.priceCOP)<0){
      issues.push("LOCAL_PRODUCT_NOT_VERIFIED:"+id);continue;
    }
    const options=remoteByName.get(name)??[];
    const exact=options.filter(p=>
      Number.isSafeInteger(Number(p.price)) &&
      Number(p.price)===Number(product.priceCOP)
    );
    if(exact.length!==1){
      issues.push((exact.length?"AMBIGUOUS":"MISSING_OR_PRICE_DIFFERENT")+":"+id);
      continue;
    }
    const candidate=exact[0];
    const code=typeof candidate.localCode==="number" &&
      Number.isSafeInteger(candidate.localCode) && candidate.localCode>0
      ?String(candidate.localCode):
      typeof candidate.localCode==="string"?candidate.localCode.trim():"";
    if(!code || code.length>150 || usedCodes.has(code)){
      issues.push("INVALID_OR_DUPLICATE_TOTEAT_CODE:"+id);continue;
    }
    usedCodes.add(code);
    matched.push({productId:id,productName:product.name,
      priceCOP:Number(product.priceCOP),externalCode:code});
  }
  return {ready:issues.length===0&&matched.length===local.length,
    matched,issues};
}
