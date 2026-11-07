import {getConversationByPhone,updateConversationMetadata} from "../conversations/conversation.repository.js";
import {
  quoteVerifiedDeliveryPoint,type Point,type DeliveryQuote
} from "./restaurant-delivery-routing.service.js";

const COMPANY="delibocados";
export const PIN_TTL_MS=30*60*1000;
export type VerifiedDeliveryPin={
  lat:number;lng:number;zoneId:string;createdAt:string;
  quotedFeeCOP:number;routeMeters:number;routeMinutes:number;
};
type ReceivedLocation={phone:string;point:Point;live:boolean;sourceMessageId:string};
type Reply={handled:true;text:string;humanHandoff?:boolean};

export function freshVerifiedPin(value:unknown,now=Date.now()):VerifiedDeliveryPin|null {
  if(!value||typeof value!=="object")return null;
  const p=value as Partial<VerifiedDeliveryPin>;
  if(!p.zoneId||!p.createdAt||
    typeof p.lat!=="number"||typeof p.lng!=="number"||
    !Number.isFinite(p.lat)||!Number.isFinite(p.lng)||
    p.lat < -90||p.lat > 90||p.lng < -180||p.lng > 180||
    !Number.isFinite(Date.parse(p.createdAt))||
    Date.parse(p.createdAt)>now+60000||now-Date.parse(p.createdAt)>PIN_TTL_MS)
    return null;
  if(!Number.isInteger(p.quotedFeeCOP)||p.quotedFeeCOP<0 ||
     !Number.isInteger(p.routeMeters)||p.routeMeters<0 ||
     !Number.isInteger(p.routeMinutes)||p.routeMinutes<0)return null;
  return p as VerifiedDeliveryPin;
}
export function deliveryPinSummary(quote:DeliveryQuote):string{
  if(!quote.covered||!quote.zone)return "No fue posible verificar cobertura para esa ubicación.";
  return "Ese punto está dentro de nuestra zona *"+quote.zone.name+"*."+
    " La distancia por carretera desde Delibocados es de *"+
    ((quote.drivingDistanceMeters??0)/1000).toFixed(2)+" km*."+
    " Google Maps estima "+quote.drivingDurationMinutes+
    " min en automóvil (no es la hora prometida de entrega)."+
    " El domicilio a esa zona cuesta *$"+
    quote.zone.feeCOP.toLocaleString("es-CO")+" COP*.";
}
/** Does not charge or register an order. Checkout requires a written address detail. */
export async function handleRestaurantWhatsAppPin(input:ReceivedLocation):Promise<Reply>{
  if(!/^[0-9]{8,15}$/.test(input.phone)) {
    return {handled:true,text:"No pude asociar la ubicación con un número válido."};
  }
  if(input.live){
    return {handled:true,text:"Veo que compartiste tu ubicación en tiempo real. "+
      "Para entregar en un punto fijo, enviame una *ubicación fija* desde WhatsApp. "+
      "Así puedo consultar la ruta real desde el restaurante."};
  }
  let quote:DeliveryQuote;
  try {quote=await quoteVerifiedDeliveryPoint(input.point);}
  catch(error){
    console.error("[DELI DELIVERY PIN ROUTING]",{
      reason:error instanceof Error?error.name:"UNKNOWN"
    });
    return {handled:true,text:"Recibí tu ubicación, pero no pude comprobar la ruta. "+
      "Un encargado debe confirmar cobertura y tarifa antes de aceptar el pedido."};
  }
  if(!quote.covered||!quote.zone) {
    const configured=["GEOGRAFIA_AUTOMATICA_DESACTIVADA","GOOGLE_MAPS_KEY_PENDIENTE",
      "UBICACION_LOCAL_NO_VERIFICADA"].includes(quote.reason??"");
    return {handled:true,text:configured?
      "Recibí tu ubicación. La consulta automática de Google Maps aún no está "+
      "configurada o verificada. Un encargado debe comprobar el domicilio y su tarifa.":
      quote.reason==="FUERA_DE_ZONAS_VERIFICADAS"?
      "Recibí tu ubicación, pero está fuera de las zonas de domicilio que tenemos verificadas. "+
      "Podés retirar en el local o consultar con un encargado.":
      "Recibí el punto, pero no pude verificar una ruta vial válida hasta allí. "+
      "Un encargado debe revisar cobertura y tarifa antes de aceptar el domicilio."};
  }
  const safe:VerifiedDeliveryPin={
    lat:input.point.lat,lng:input.point.lng,zoneId:quote.zone.id,
    createdAt:new Date().toISOString(),quotedFeeCOP:quote.zone.feeCOP,
    routeMeters:quote.drivingDistanceMeters!,routeMinutes:quote.drivingDurationMinutes!
  };
  const conversation=await getConversationByPhone(input.phone,COMPANY);
  const checkout=conversation?.metadata?.restaurant_checkout_v1 as
    {stage?:string;mode?:string;createdAt?:string;
      zoneId?:string;address?:string;payment?:string}|undefined;
  const hasDeliveryDraft=checkout?.mode==="delivery" &&
    ["zone","address","notes","payment","confirm"].includes(checkout.stage??"") &&
    Boolean(checkout.createdAt) &&
    Date.now()-Date.parse(checkout.createdAt??"") < 2*3600000;

  const updatedCheckout=hasDeliveryDraft&&checkout ? {
    ...checkout,
    stage:"address",
    zoneId:quote.zone.id,
    address:undefined,
    payment:undefined
  } : null;
  await updateConversationMetadata(input.phone,{
    restaurant_delivery_pin_v1:safe,
    ...(updatedCheckout?{restaurant_checkout_v1:updatedCheckout}:{})
  },COMPANY);
  return {handled:true,text:deliveryPinSummary(quote)+
    "\n\n"+(hasDeliveryDraft?
      "Ya guardé este punto para el domicilio de tu pedido. "+
      "Decime *la calle/número y una referencia de entrega* (casa, edificio o apartamento). "+
      "No voy a confirmar el pedido hasta tener esos datos.":
      "Guardé temporalmente este punto por 30 minutos. "+
      "¿Querés pedir domicilio aquí? Decime qué productos querés y, "+
      "al confirmar el domicilio, te pediré calle/número y referencia.")};
}
