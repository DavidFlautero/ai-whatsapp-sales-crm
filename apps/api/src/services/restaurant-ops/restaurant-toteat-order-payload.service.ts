/**
 * Toteat /orders document from an already CONFIRMED, financially eligible CRM order.
 * Uses the same envelope as the on-site accepted technical Chicharrón ticket.
 * No IO, credentials, database updates, or automatic activation.
 */
import type {ToteatPreparation} from "./restaurant-toteat-preparation.service.js";

export type ToteatExportOrder={
  id:string;company_id:string;source:string;status:string;
  customer_name:string;payment_method:string;payment_status:string;
  fulfillment_mode:string;subtotal_cop:number;delivery_fee_cop:number;total_cop:number;
  customer_note?:string|null;address?:string|null;created_at?:string;
};
export type VerifiedSplit={
  transfer_due_cop:number;cash_due_cop:number;
  transfer_verified_cop:number;cash_collected_cop:number;
};
export type VerifiedFeeProduct={productCode:string;productName:string;priceCOP:number};
type Payment={id:0;ref:string;amount:number;amountPaid:number;tip:0;
  paymentType:number;operationDate:string;pending:boolean};
export type ToteatExternalOrder={
  restaurantId:string;localNumber:number;orderId:0;orderReference:string;
  status:"new";type:"pickup"|"delivery";channel:"crm";vendorName:"Delibocados";
  comment:string;
  document:{
    expectedPayment:number;payments:Payment[];
    line:Array<{
      lineNumber:number;quantity:number;productCode:string;productName:string;
      amountAfterTax:number;comment:string;
    }>;
    customer:{name:string};
  };
  operationDate:string;modifiedDate:string;
};
export type PayloadResult=
  |{ready:false;reason:string}
  |{ready:true;value:ToteatExternalOrder};
const validCode=(v:string)=>/^[A-Za-z0-9_.-]{1,150}$/.test(v);
const validCOP=(n:number)=>Number.isSafeInteger(n)&&n>=0&&n<=999999999;
export function makeToteatOrderPayload(input:{
  order:ToteatExportOrder;
  preparation:ToteatPreparation;
  restaurantId:string;localNumber:string;
  split?:VerifiedSplit|null;
  deliveryFeeProduct?:VerifiedFeeProduct|null;
  nowISO:string;
}):PayloadResult{
  const {order,preparation,restaurantId,localNumber,split,deliveryFeeProduct}=input;
  if(!preparation.ready)return {ready:false,reason:preparation.reason};
  if(order.company_id!=="delibocados"||order.source!=="whatsapp"||order.status!=="confirmed")
    return {ready:false,reason:"ORDER_SCOPE_INVALID"};
  if(!["verified","cash_on_delivery"].includes(order.payment_status))
    return {ready:false,reason:"PAYMENT_NOT_VERIFIED"};
  if(!/^[1-9]\d{0,19}$/.test(restaurantId) ||
     !/^[1-9]\d{0,9}$/.test(localNumber) ||
     !Number.isSafeInteger(Number(localNumber)))
    return {ready:false,reason:"PROVIDER_IDS_INVALID"};
  if(!/^delibocados-[0-9a-f-]{36}$/i.test(preparation.orderReference) ||
     preparation.orderReference!=="delibocados-"+order.id)
    return {ready:false,reason:"REFERENCE_MISMATCH"};
  if(Number.isNaN(Date.parse(input.nowISO)))
    return {ready:false,reason:"DATE_INVALID"};
  if(preparation.totalCOP!==Number(order.total_cop)||
     preparation.subtotalCOP!==Number(order.subtotal_cop)||
     preparation.deliveryFeeCOP!==Number(order.delivery_fee_cop)||
     !validCOP(preparation.totalCOP) || !validCOP(preparation.subtotalCOP))
    return {ready:false,reason:"TOTALS_MISMATCH"};
  if(!order.customer_name?.trim() || order.customer_name.length>120)
    return {ready:false,reason:"CUSTOMER_NAME_INVALID"};
  if(order.fulfillment_mode!==preparation.kind)
    return {ready:false,reason:"FULFILLMENT_MISMATCH"};
  const lines=preparation.lines.map((line,i)=>({
    lineNumber:i+1,quantity:line.quantity,productCode:line.productCode,
    productName:"",amountAfterTax:line.quantity*line.priceCOP,
    comment:line.comment.trim().slice(0,500)
  }));
  // Caller must provide actual published product names; the exporter overwrites
  // this placeholder using the DB order_item snapshot keyed by line position.
  if(lines.some(x=>!validCode(x.productCode)||!validCOP(x.amountAfterTax)))
    return {ready:false,reason:"PRODUCT_LINE_INVALID"};
  if(preparation.kind==="delivery" && preparation.deliveryFeeCOP>0){
    // Do not send an unpriced delivery amount invisible to Toteat's kitchen/cash.
    // Fee SKU must have been independently verified in Toteat for this exact price.
    if(!deliveryFeeProduct||!validCode(deliveryFeeProduct.productCode)||
       !deliveryFeeProduct.productName.trim()||
       deliveryFeeProduct.priceCOP!==preparation.deliveryFeeCOP)
      return {ready:false,reason:"DELIVERY_FEE_PRODUCT_NOT_VERIFIED"};
    lines.push({lineNumber:lines.length+1,quantity:1,
      productCode:deliveryFeeProduct.productCode,
      productName:deliveryFeeProduct.productName,
      amountAfterTax:deliveryFeeProduct.priceCOP,
      comment:"DOMICILIO VERIFICADO"});
  }
  const totalLines=lines.reduce((sum,x)=>sum+x.amountAfterTax,0);
  if(totalLines!==preparation.totalCOP)
    return {ready:false,reason:"POS_LINES_TOTAL_MISMATCH"};
  const payments:Payment[]=[];
  const add=(amount:number,paid:number,type:number,pending:boolean)=>{
    payments.push({id:0,ref:preparation.orderReference,amount,amountPaid:paid,
      tip:0,paymentType:type,operationDate:input.nowISO,pending});
  };
  if(order.payment_method==="cash"){
    if(order.payment_status==="cash_on_delivery")add(preparation.totalCOP,0,1000,true);
    else add(preparation.totalCOP,preparation.totalCOP,1000,false);
  }else if(order.payment_method==="transfer"){
    if(order.payment_status!=="verified")
      return {ready:false,reason:"TRANSFER_NOT_SETTLED"};
    add(preparation.totalCOP,preparation.totalCOP,9001,false);
  }else if(order.payment_method==="mixed"){
    if(!split || !validCOP(split.cash_due_cop)||!validCOP(split.transfer_due_cop)||
       split.cash_due_cop<1||split.transfer_due_cop<1||
       split.transfer_due_cop+split.cash_due_cop!==preparation.totalCOP||
       split.transfer_verified_cop!==split.transfer_due_cop||
       ![0,split.cash_due_cop].includes(split.cash_collected_cop))
      return {ready:false,reason:"MIXED_PAYMENT_NOT_RECONCILED"};
    if(order.payment_status==="verified"&&split.cash_collected_cop!==split.cash_due_cop)
      return {ready:false,reason:"CASH_NOT_COLLECTED"};
    add(split.transfer_due_cop,split.transfer_due_cop,9001,false);
    add(split.cash_due_cop,split.cash_collected_cop,1000,
      split.cash_collected_cop===0);
  }else return {ready:false,reason:"PAYMENT_METHOD_UNSUPPORTED"};
  if(payments.reduce((n,x)=>n+x.amount,0)!==preparation.totalCOP)
    return {ready:false,reason:"PAYMENTS_TOTAL_MISMATCH"};
  const address=(order.address??"").replace(/[\r\n]/g," ").trim().slice(0,250);
  const comment=[
    "PEDIDO WHATSAPP DELIBOCADOS",preparation.orderReference,
    preparation.kind==="delivery"?"DOMICILIO: "+address:"RETIRO EN LOCAL",
    order.customer_note?.replace(/[\r\n]/g," ").slice(0,300)??""
  ].filter(Boolean).join(" | ").slice(0,700);
  return {ready:true,value:{
    restaurantId,localNumber:Number(localNumber),orderId:0,
    orderReference:preparation.orderReference,status:"new",
    type:preparation.kind,channel:"crm",vendorName:"Delibocados",
    comment,document:{
      expectedPayment:payments.some(x=>x.pending)?1000:payments[0].paymentType,
      payments,line:lines,customer:{name:order.customer_name.trim()}
    },
    operationDate:input.nowISO,modifiedDate:input.nowISO
  }};
}
/** Only change the EXACT 16+ digit restaurant ID, no lossy Number conversion. */
export function serializeToteatExternalOrder(payload:ToteatExternalOrder):string{
  if(!/^[1-9]\d{0,19}$/.test(payload.restaurantId))
    throw new Error("RESTAURANT_ID_INVALID");
  const marker="__TOTEAT_EXACT_RESTAURANT_ID__";
  const json=JSON.stringify({...payload,restaurantId:marker});
  if(!json.includes('"'+marker+'"'))throw new Error("JSON_MARKER_NOT_FOUND");
  return json.replace('"'+marker+'"',payload.restaurantId);
}
