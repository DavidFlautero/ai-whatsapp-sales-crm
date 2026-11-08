/**
 * Safely prepares the POS-side line items from a registered Delibocados order.
 * This is NOT an HTTP client. The Toteat document envelope must be validated
 * against the active store's OpenAPI and configured API rights before POST.
 */
export type RegisteredLine = {
  product_id:string; product_name:string; quantity:number;
  unit_price_cop:number; instructions?:string;
};
export type ReviewedMapping = {
  product_id:string;external_product_code:string;active:boolean;reviewed_at:string|null;
};
export type RegisteredOrder = {
  id:string;company_id:string;source:string;status:string;payment_status:string;
  fulfillment_mode:string;subtotal_cop:number;delivery_fee_cop:number;total_cop:number;
};
export type ToteatDraftLine = {
  productCode:string; quantity:number; priceCOP:number; comment:string;
};
export type ToteatPreparation =
  | { ready:false; reason:string }
  | { ready:true; orderReference:string; kind:"pickup"|"delivery";
      lines:ToteatDraftLine[];subtotalCOP:number;deliveryFeeCOP:number;totalCOP:number };

export function prepareToteatLines(
  order:RegisteredOrder,items:RegisteredLine[],mappings:ReviewedMapping[]
):ToteatPreparation {
  if(order.company_id!=="delibocados" || order.source!=="whatsapp")
    return {ready:false,reason:"TENANT_OR_SOURCE_INVALID"};
  if(order.status!=="confirmed" ||
    !["verified","cash_on_delivery"].includes(order.payment_status))
    return {ready:false,reason:"ORDER_OR_PAYMENT_NOT_READY"};
  if(order.fulfillment_mode!=="pickup" && order.fulfillment_mode!=="delivery")
    return {ready:false,reason:"FULFILLMENT_UNSUPPORTED"};
  if(items.length<1 || items.length>60)
    return {ready:false,reason:"LINES_INVALID"};
  const active=new Map(mappings.filter(x=>x.active && x.reviewed_at)
    .map(x=>[x.product_id,x.external_product_code]));
  const lines:ToteatDraftLine[]=[];
  let subtotal=0;
  for(const item of items){
    const code=active.get(item.product_id)?.trim();
    if(!code || code.length>150)
      return {ready:false,reason:"PRODUCT_MAPPING_MISSING"};
    if(!Number.isSafeInteger(item.quantity) || item.quantity<1 || item.quantity>25 ||
       !Number.isSafeInteger(item.unit_price_cop) || item.unit_price_cop<0 ||
       (item.instructions??"").length>500)
      return {ready:false,reason:"LINE_VALIDATION_FAILED"};
    subtotal+=item.quantity*item.unit_price_cop;
    lines.push({productCode:code,quantity:item.quantity,
      priceCOP:item.unit_price_cop,comment:item.instructions??""});
  }
  const fee=Number(order.delivery_fee_cop),total=Number(order.total_cop);
  if(!Number.isSafeInteger(subtotal) || !Number.isSafeInteger(fee) ||
    !Number.isSafeInteger(total) || fee<0 ||
    subtotal!==Number(order.subtotal_cop) || subtotal+fee!==total)
    return {ready:false,reason:"TOTAL_MISMATCH"};
  if(order.fulfillment_mode==="pickup" && fee!==0)
    return {ready:false,reason:"PICKUP_DELIVERY_FEE_NOT_ZERO"};
  if(!/^[0-9a-f-]{36}$/i.test(order.id))
    return {ready:false,reason:"ORDER_ID_INVALID"};
  return {ready:true,orderReference:"delibocados-"+order.id,
    kind:order.fulfillment_mode,lines,subtotalCOP:subtotal,deliveryFeeCOP:fee,totalCOP:total};
}
