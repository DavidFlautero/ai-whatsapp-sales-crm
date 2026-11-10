/**
 * One explicit, operator-authorized Toteat pickup test ticket.
 * This is NOT the production order exporter.
 */
export type ToteatTestCredentials={restaurantId:string;localNumber:string};
export type ToteatTestOrder={
  restaurantId:number|string;localNumber:number;orderId:0;orderReference:string;
  status:"new";type:"pickup";channel:"crm";vendorName:"Delibocados";
  comment:string;document:{
    expectedPayment:1000;
    payments:Array<{id:0;ref:string;amount:8001;amountPaid:0;tip:0;
      paymentType:1000;operationDate:string;pending:true}>;
    line:Array<{lineNumber:1;quantity:1;productCode:"DB1132";
      productName:"Chicharrón Porción";amountAfterTax:8001;comment:string}>;
    customer:{name:"PRUEBA DELIBOCADOS"};
  };
  operationDate:string;modifiedDate:string;
};
export function buildSingleTestOrder(
  creds:ToteatTestCredentials,uuid:string,iso:string
):ToteatTestOrder{
  if(!/^[1-9]\d{0,19}$/.test(creds.restaurantId)||
    !/^[1-9]\d{0,9}$/.test(creds.localNumber)||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid)||
    Number.isNaN(Date.parse(iso)))throw new Error("TEST_ORDER_INPUT_INVALID");
  // Toteat's restaurantId is modeled as an integer and may exceed JS safe
  // integer precision; the transport substitutes this string as a raw JSON
  // integer token, never converting it to Number.
  const reference="delibocados-prueba-"+uuid;
  const comment="PRUEBA TECNICA DELIBOCADOS - NO COBRAR / NO ENTREGAR / ANULAR TRAS COMPROBAR IMPRESION";
  return {
    restaurantId:creds.restaurantId,localNumber:Number(creds.localNumber),
    orderId:0,orderReference:reference,
    status:"new",type:"pickup",channel:"crm",vendorName:"Delibocados",
    comment,
    document:{
      expectedPayment:1000,
      payments:[{id:0,ref:reference,amount:8001,amountPaid:0,tip:0,
        paymentType:1000,operationDate:iso,pending:true}],
      line:[{lineNumber:1,quantity:1,productCode:"DB1132",
        productName:"Chicharrón Porción",amountAfterTax:8001,
        comment:"PRUEBA DE IMPRESION - NO PREPARAR"}],
      customer:{name:"PRUEBA DELIBOCADOS"}
    },
    operationDate:iso,modifiedDate:iso
  };
}
export function serializeExactToteatTestOrder(order:ToteatTestOrder):string{
  const integer=String(order.restaurantId);
  if(!/^[1-9]\d{0,19}$/.test(integer))throw new Error("RESTAURANT_ID_NOT_SAFE");
  const marker="__EXACT_TOTEAT_RESTAURANT_ID__";
  const json=JSON.stringify({...order,restaurantId:marker});
  if(!json.includes('"'+marker+'"'))throw new Error("ORDER_SERIALIZE_FAILED");
  return json.replace('"'+marker+'"',integer);
}
/** Parse a receipt without rounding a 16+ digit Toteat ID through JSON.parse.
 * A 200/ok:true without one provable orderId MUST stay unknown.
 * Only explicit 4xx/ok:false (not 429) is a confirmed rejection.
 */
export function parseToteatTestReceipt(raw:string,httpStatus:number):{
  outcome:"accepted"|"unknown"|"rejected";externalOrderId:string|null;
}{
  if(raw.length>250_000) return {outcome:"unknown",externalOrderId:null};
  let p:unknown;
  try{p=JSON.parse(raw);}catch{return {outcome:"unknown",externalOrderId:null};}
  const obj=p&&typeof p==="object"&&!Array.isArray(p)?
    p as Record<string,unknown>:null;
  if(httpStatus>=200&&httpStatus<300&&obj?.ok===true){
    // Check ALL orderId tokens; never trust a rounded IEEE-754 number.
    const ids=[...raw.matchAll(/"(?:orderId|order_id)"\s*:\s*(?:"([1-9][0-9]{5,19})"|([1-9][0-9]{5,19}))/g)]
      .map(x=>x[1]??x[2]);
    const unique=[...new Set(ids)];
    return unique.length===1
      ?{outcome:"accepted",externalOrderId:unique[0]}
      :{outcome:"unknown",externalOrderId:null};
  }
  if(obj?.ok===false&&httpStatus>=400&&httpStatus<500&&httpStatus!==429)
    return {outcome:"rejected",externalOrderId:null};
  return {outcome:"unknown",externalOrderId:null};
}
