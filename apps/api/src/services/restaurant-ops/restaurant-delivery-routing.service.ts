import {supabaseRequest} from "../db/supabase-rest.client.js";
import {getBusinessProfile} from "./restaurant-agent-business.service.js";
import {containsPoint,polygonSchema} from "./restaurant-zones.service.js";

export type Point={lat:number;lng:number};
type Zone={
  id:string;name:string;fee_cop:number;eta_minutes:number;
  priority:number;geojson:unknown;active:boolean;
};
type Courier={id:string;name:string;vehicle:"bike"|"motorbike";availability:string;active:boolean};
export type DeliveryQuote={
  covered:boolean;
  reason?:string;
  formattedAddress?:string;
  zone?:{id:string;name:string;feeCOP:number;estimatedMinutes:number};
  drivingDistanceMeters?:number;
  drivingDurationMinutes?:number;
  suggestedCouriers?:Array<{id:string;name:string;vehicle:"bike"|"motorbike"}>;
};

function cityFromAddress(address:string):"Funza"|"Mosquera"|null {
  const lower=address.toLocaleLowerCase("es-CO");
  const funza=/\bfunza\b/.test(lower),mosquera=/\bmosquera\b/.test(lower);
  return funza===mosquera?null:funza?"Funza":"Mosquera";
}
export function addressLooksVerifiable(address:string):boolean {
  return address.length>=12 && address.length<=300 &&
    cityFromAddress(address)!==null && /\d/.test(address);
}
async function geocode(address:string,key:string):Promise<{point:Point;formatted:string}|null>{
  const params=new URLSearchParams({
    address:address+", Cundinamarca, Colombia",components:"country:CO",key
  });
  const response=await fetch("https://maps.googleapis.com/maps/api/geocode/json?"+params,{
    signal:AbortSignal.timeout(12000)
  });
  if(!response.ok)throw new Error("DELIVERY_GEOCODING_REQUEST_FAILED");
  const data=await response.json() as {
    status:string;results:Array<{
      formatted_address:string;partial_match?:boolean;
      geometry?:{location:{lat:number;lng:number};location_type?:string};
      address_components:Array<{long_name:string;short_name:string;types:string[]}>
    }>
  };
  if(data.status!=="OK" || !data.results?.length)return null;
  const result=data.results[0];
  if(data.results.length>1||result.partial_match ||
     !["ROOFTOP","RANGE_INTERPOLATED"].includes(result.geometry?.location_type??""))
    return null;
  const country=result.address_components.find(x=>x.types.includes("country"))?.short_name;
  const locality=result.address_components.filter(x=>
    x.types.includes("locality") || x.types.includes("administrative_area_level_2"))
    .map(x=>x.long_name.toLocaleLowerCase("es-CO"));
  const expected=cityFromAddress(address);
  if(country!=="CO"||!expected||
      !locality.some(x=>x.includes(expected.toLocaleLowerCase("es-CO"))))return null;
  const point=result.geometry!.location;
  if(!Number.isFinite(point.lat)||!Number.isFinite(point.lng))return null;
  return {point,formatted:result.formatted_address};
}
async function routeDistance(from:Point,to:Point,key:string):
  Promise<{meters:number;minutes:number}|null>{
  const response=await fetch("https://routes.googleapis.com/directions/v2:computeRoutes",{
    method:"POST",
    headers:{"Content-Type":"application/json","X-Goog-Api-Key":key,
      "X-Goog-FieldMask":"routes.distanceMeters,routes.duration"},
    body:JSON.stringify({
      origin:{location:{latLng:{latitude:from.lat,longitude:from.lng}}},
      destination:{location:{latLng:{latitude:to.lat,longitude:to.lng}}},
      travelMode:"DRIVE",routingPreference:"TRAFFIC_UNAWARE",
      computeAlternativeRoutes:false,languageCode:"es-CO",units:"METRIC"
    }),
    signal:AbortSignal.timeout(13000)
  });
  if(!response.ok)throw new Error("DELIVERY_ROUTE_REQUEST_FAILED");
  const data=await response.json() as {routes?:Array<{distanceMeters:number;duration:string}>};
  const first=data.routes?.[0],seconds=Number.parseFloat(first?.duration??"NaN");
  if(!first||!Number.isSafeInteger(first.distanceMeters)||
     first.distanceMeters<0||!Number.isFinite(seconds)||seconds<=0)return null;
  return {meters:first.distanceMeters,minutes:Math.ceil(seconds/60)};
}
/**
 * Quote is fail-closed. Driving distance is from VERIFIED restaurant origin,
 * not the real-time location of a courier (we do not track courier GPS yet).
 */
export async function quoteVerifiedDeliveryAddress(address:string):Promise<DeliveryQuote>{
  const input=address.trim();
  if(!addressLooksVerifiable(input))
    return {covered:false,reason:"DIRECCION_INCOMPLETA_O_SIN_CIUDAD"};
  if(process.env.DELIBOCADOS_DELIVERY_GEO_ENABLED!=="1")
    return {covered:false,reason:"GEOGRAFIA_AUTOMATICA_DESACTIVADA"};
  const key=process.env.GOOGLE_MAPS_API_KEY?.trim();
  if(!key)return {covered:false,reason:"GOOGLE_MAPS_KEY_PENDIENTE"};
  const profile=await getBusinessProfile();
  const from=profile?.origin_verified&&
    Number.isFinite(profile.origin_lat)&&Number.isFinite(profile.origin_lng)
      ? {lat:Number(profile.origin_lat),lng:Number(profile.origin_lng)}:null;
  if(!from)return {covered:false,reason:"UBICACION_LOCAL_NO_VERIFICADA"};
  const [location,zones,couriers]=await Promise.all([
    geocode(input,key),
    supabaseRequest<Zone[]>({
      table:"restaurant_ops_zones",
      query:"?company_id=eq.delibocados&active=eq.true&select=id,name,fee_cop,eta_minutes,priority,geojson,active&order=priority.asc&limit=80"
    }),
    supabaseRequest<Courier[]>({
      table:"restaurant_ops_couriers",
      query:"?company_id=eq.delibocados&active=eq.true&availability=eq.available&select=id,name,vehicle,availability,active&limit=30"
    })
  ]);
  if(!location)return {covered:false,reason:"DIRECCION_NO_GEOCODIFICADA_CON_PRECISION"};
  const zone=zones.find(z=>{
    const polygon=polygonSchema.safeParse(z.geojson);
    return polygon.success&&containsPoint(polygon.data,location.point.lng,location.point.lat);
  });
  if(!zone)return {covered:false,reason:"FUERA_DE_ZONAS_VERIFICADAS"};
  const route=await routeDistance(from,location.point,key);
  if(!route)return {covered:false,reason:"RUTA_VIAL_NO_VERIFICADA"};
  return {
    covered:true,formattedAddress:location.formatted,
    zone:{id:zone.id,name:zone.name,feeCOP:zone.fee_cop,
      estimatedMinutes:zone.eta_minutes},
    drivingDistanceMeters:route.meters,drivingDurationMinutes:route.minutes,
    // Candidates are limited to those marked available; not a GPS assignment.
    suggestedCouriers:couriers.map(c=>({id:c.id,name:c.name,vehicle:c.vehicle}))
  };
}


/**
 * Shared WhatsApp pin: uses provider-supplied WGS84 coordinates directly.
 * Never infer location from WhatsApp profile or from a pasted map screenshot.
 */
export async function quoteVerifiedDeliveryPoint(destination:Point):Promise<DeliveryQuote> {
  const {lat,lng}=destination;
  if(!Number.isFinite(lat)||!Number.isFinite(lng)||
     lat < -90||lat > 90||lng < -180||lng > 180)
    return {covered:false,reason:"COORDENADAS_INVALIDAS"};
  if(process.env.DELIBOCADOS_DELIVERY_GEO_ENABLED!=="1")
    return {covered:false,reason:"GEOGRAFIA_AUTOMATICA_DESACTIVADA"};
  const key=process.env.GOOGLE_MAPS_API_KEY?.trim();
  if(!key)return {covered:false,reason:"GOOGLE_MAPS_KEY_PENDIENTE"};
  const profile=await getBusinessProfile();
  const from=profile?.origin_verified &&
    Number.isFinite(profile.origin_lat) && Number.isFinite(profile.origin_lng)
      ? {lat:Number(profile.origin_lat),lng:Number(profile.origin_lng)} : null;
  if(!from)return {covered:false,reason:"UBICACION_LOCAL_NO_VERIFICADA"};

  const zones=await supabaseRequest<Zone[]>({
    table:"restaurant_ops_zones",
    query:"?company_id=eq.delibocados&active=eq.true"+
      "&select=id,name,fee_cop,eta_minutes,priority,geojson,active"+
      "&order=priority.asc&limit=80"
  });
  const zone=zones.find(z=>{
    const verified=polygonSchema.safeParse(z.geojson);
    return verified.success && containsPoint(verified.data,lng,lat);
  });
  if(!zone)return {covered:false,reason:"FUERA_DE_ZONAS_VERIFICADAS"};

  // Real road distance, not great-circle distance from a fixed point.
  const route=await routeDistance(from,{lat,lng},key);
  if(!route)return {covered:false,reason:"RUTA_VIAL_NO_VERIFICADA"};
  const couriers=await supabaseRequest<Courier[]>({
    table:"restaurant_ops_couriers",
    query:"?company_id=eq.delibocados&active=eq.true"+
      "&availability=eq.available&select=id,name,vehicle,availability,active&limit=30"
  });
  return {
    covered:true,
    zone:{id:zone.id,name:zone.name,feeCOP:zone.fee_cop,
      estimatedMinutes:zone.eta_minutes},
    drivingDistanceMeters:route.meters,
    drivingDurationMinutes:route.minutes,
    suggestedCouriers:couriers.map(c=>({
      id:c.id,name:c.name,vehicle:c.vehicle
    }))
  };
}
