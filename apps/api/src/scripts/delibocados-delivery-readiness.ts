/**
 * Complete Delibocados release audit in READ ONLY mode.
 * This is a DB/config snapshot, not certification of Toteat POST, actual printed
 * paper, WhatsApp delivery, bank settlement or physical handoff.
 *
 * Run from apps/api: pnpm exec tsx src/scripts/delibocados-delivery-readiness.ts
 */
import {config} from "dotenv";
import {existsSync} from "node:fs";
config({path:"../../.env",quiet:true});
type Status="ok"|"pending"|"blocked";
type Gate={stage:string;name:string;status:Status;detail:string};
type AnyRow=Record<string,unknown>;
const gates:Gate[]=[];
function gate(stage:string,name:string,status:Status,detail:string){
  gates.push({stage,name,status,detail});
}
async function safe<T>(fn:()=>Promise<T>):Promise<{ok:true;data:T}|{ok:false}>{
  try{return {ok:true,data:await fn()};}catch{return {ok:false};}
}
function validPolygon(value:unknown,schema:{safeParse:(value:unknown)=>{success:boolean}}):boolean{
  if(value==null)return false;
  try{return schema.safeParse(typeof value==="string"?JSON.parse(value):value).success;}
  catch{return false;}
}
async function main(){
  const [{supabaseRequest},{polygonSchema}]=await Promise.all([
    import("../services/db/supabase-rest.client.js"),
    import("../services/restaurant-ops/restaurant-zones.service.js")
  ]);
  const db=<T extends AnyRow>(table:string,query:string)=>
    safe(()=>supabaseRequest<T[]>({table,query}));
  const [docs,mappings,integrations,origin,zones,couriers,exports,orders,tickets,events]=
    await Promise.all([
      db<{revision:number;payload?:{products?:Array<{
        id?:string;name?:string;available?:boolean;priceNeedsReview?:boolean;priceCOP?:number
      }>}}>("restaurant_menu_documents",
        "?company_id=eq.delibocados&select=revision,payload&limit=2"),
      db<{product_id:string;active:boolean;reviewed_at:string|null}>(
        "restaurant_ops_pos_product_map",
        "?company_id=eq.delibocados&provider=eq.toteat&select=product_id,active,reviewed_at&limit=200"),
      db<{provider:string;status:string;enabled:boolean}>(
        "company_integrations",
        "?company_id=eq.delibocados&provider=eq.toteat&select=provider,status,enabled&limit=1"),
      db<{origin_verified:boolean;origin_lat:number|null;origin_lng:number|null}>(
        "restaurant_agent_business_profiles",
        "?company_id=eq.delibocados&select=origin_verified,origin_lat,origin_lng&limit=1"),
      db<{id:string;active:boolean;fee_cop:number;geojson:unknown}>(
        "restaurant_ops_zones",
        "?company_id=eq.delibocados&select=id,active,fee_cop,geojson&limit=100"),
      db<{id:string;vehicle:string;active:boolean;availability:string}>(
        "restaurant_ops_couriers",
        "?company_id=eq.delibocados&select=id,vehicle,active,availability&limit=100"),
      db<{order_id:string;provider:string;status:string}>(
        "restaurant_ops_pos_exports",
        "?company_id=eq.delibocados&provider=eq.toteat&select=order_id,provider,status&limit=200"),
      db<{id:string;number:number;status:string;source:string;fulfillment_mode:string;payment_status:string}>(
        "restaurant_ops_orders",
        "?company_id=eq.delibocados&select=id,number,status,source,fulfillment_mode,payment_status&order=created_at.desc&limit=200"),
      db<{order_id:string;status:string;printed_at:string|null}>(
        "restaurant_ops_kitchen_tickets",
        "?company_id=eq.delibocados&select=order_id,status,printed_at&limit=200"),
      db<{event_type:string;order_id:string}>(
        "restaurant_ops_order_events",
        "?company_id=eq.delibocados&select=event_type,order_id&order=created_at.desc&limit=200")
    ]);
  const docsData=docs.ok?docs.data:[];
  const products=docsData[0]?.payload?.products??[];
  const verified=products.filter(x=>x.id&&x.name&&x.available!==false &&
    x.priceNeedsReview!==true && Number.isSafeInteger(Number(x.priceCOP)) &&
    Number(x.priceCOP)>=0);
  const product055=products.find(x=>x.id==="deli-055");
  const catalogReady=docsData.length===1 && products.length===133 &&
    verified.length===133 &&
    product055?.priceCOP===8001 && product055.priceNeedsReview===false;
  gate("01","Menú",docs.ok && catalogReady?"ok":"blocked",
    docs.ok?`${verified.length}/${products.length} productos verificados; revision ${docsData[0]?.revision??"N/A"}`:
      "Consulta no disponible; verificar migraciones/credenciales");
  const mapData=mappings.ok?mappings.data:[];
  const reviewed=mapData.filter(x=>x.active===true&&Boolean(x.reviewed_at));
  const distinct=new Set(reviewed.map(x=>x.product_id));
  const mappingReady=mappings.ok&&reviewed.length===133&&distinct.size===133;
  gate("01","Mapeos POS",mappingReady?"ok":"blocked",
    mappings.ok?`${reviewed.length} activos revisados / ${mapData.length} en total`:
    "No se puede consultar restaurant_ops_pos_product_map");
  gate("02","Agente y canal WhatsApp","pending",
    "CI valida codigo; falta prueba conversacional en testPhone y evidencia de respuestas reales");
  const liveFlags=["DELIBOCADOS_CHECKOUT_LIVE","DELIBOCADOS_ORDER_NOTIFICATIONS_LIVE"];
  const noLive=liveFlags.every(x=>process.env[x]!=="1");
  gate("02","Aislamiento de pruebas",noLive?"ok":"blocked",
    noLive?"Flags LIVE no establecidos en este proceso (revisar PM2 por separado)":
      "Hay flags LIVE activados en este proceso");
  gate("02","Archivo de pausa IA",existsSync("/root/delibocados-ai.stop")?"pending":"ok",
    existsSync("/root/delibocados-ai.stop")?"La IA está pausada":"No hay archivo de pausa");
  const integration=integrations.ok?integrations.data[0]:null;
  gate("03","Permiso/estado Toteat",integrations.ok&&integration?.enabled===true &&
    integration.status==="connected"?"ok":"blocked",
    !integrations.ok?"No se pudo consultar company_integrations":
      `Toteat ${integration?.status??"ausente"}, enabled=${integration?.enabled===true}`);
  const exportList=exports.ok?exports.data:[];
  const accepted=exportList.filter(x=>x.status==="accepted").length;
  const unknown=exportList.filter(x=>x.status==="unknown").length;
  gate("03","Evidencia de pedidos aceptados por POS",accepted>0?"ok":"pending",
    exports.ok?`accepted=${accepted}, unknown=${unknown}. Sólo BD: comprobar recibo Toteat`:
      "No se pudo consultar restaurant_ops_pos_exports");
  if(unknown>0)gate("03","Exportaciones sin conciliar","blocked",
    `${unknown} envíos con estado unknown: NO reintentar ciegamente`);
  const kitchenTickets=tickets.ok?tickets.data:[];
  const prints=kitchenTickets.filter(x=>Boolean(x.printed_at)).length;
  const withKitchen=events.ok?events.data.filter(x=>x.event_type==="status_changed").length:0;
  gate("04","Cocina (prueba real)",accepted>0&&withKitchen>0?"pending":"blocked",
    `aceptadas=${accepted}; cambios de estado vistos=${withKitchen}; printed_at en BD=${prints}; papel físico NO verificable aquí`);
  const profile=origin.ok?origin.data[0]:null;
  const originOk=Boolean(profile?.origin_verified) &&
    Number.isFinite(Number(profile?.origin_lat)) && Number.isFinite(Number(profile?.origin_lng)) &&
    Number(profile?.origin_lat)!==0 && Number(profile?.origin_lng)!==0;
  gate("05","Origen de reparto",originOk?"ok":"blocked",
    originOk?"Origen verificado en perfil (validar in situ)":"Origen no verificado");
  const zoneRows=zones.ok?zones.data:[];
  const validZones=zoneRows.filter(z=>z.active===true&&
    Number.isSafeInteger(Number(z.fee_cop))&&Number(z.fee_cop)>=0&&
    validPolygon(z.geojson,polygonSchema));
  gate("05","Geocercas y tarifas",validZones.length>0?"ok":"blocked",
    zones.ok?`${validZones.length} zonas activas con polígono correcto de ${zoneRows.length} registradas`:
      "No se pueden consultar zonas");
  const courierRows=couriers.ok?couriers.data:[];
  const activeCouriers=courierRows.filter(x=>x.active);
  const bikes=activeCouriers.filter(x=>x.vehicle==="bike").length;
  const motos=activeCouriers.filter(x=>x.vehicle==="motorbike").length;
  gate("05","Repartidores",bikes>=2&&motos>=3?"ok":"pending",
    couriers.ok?`activos: bicicletas=${bikes}, motos=${motos} (objetivo 2/3)`:
      "No se pudo consultar couriers");
  const orderRows=orders.ok?orders.data:[];
  const delivered=orderRows.filter(x=>x.source==="whatsapp"&&
    x.fulfillment_mode==="delivery"&&x.status==="completed").length;
  gate("05","Entrega final",delivered>0?"pending":"blocked",
    `Pedidos delivery terminados en los últimos 200=${delivered}; NO confirma prueba de entrega física`);
  const cashPending=orderRows.filter(x=>x.payment_status==="cash_on_delivery").length;
  gate("06","Cobro y conciliación","pending",
    `Pedidos efectivos por cobrar en últimos 200=${cashPending}; verificar cierre bancario/caja por separado`);
  gate("06","Notificaciones reales","pending",
    "Hay outbox y código; faltan evidencias Whapi de mensajes enviados por estado");
  gate("07","Panel e inventario","pending",
    "Pantallas existentes; comprobar permisos, enlaces y source-of-truth de stock en sede");
  gate("08","Matriz pruebas E01-E35","pending",
    "Requiere fixture/CI, POS real supervisado, comanda observada y entrega física");
  gate("09","Entrega y acta","pending",
    "No existe aprobación del propietario ni piloto supervisado documentado");
  console.log("=== DELIBOCADOS / PROGRAMACION HASTA ENTREGA ===");
  for(const x of gates)console.log(
    `ETAPA ${x.stage} | ${x.status.toUpperCase().padEnd(7)} | ${x.name} | ${x.detail}`);
  const blocked=gates.filter(x=>x.status==="blocked").length;
  const pending=gates.filter(x=>x.status==="pending").length;
  console.log(`RESULTADO: ${gates.length-blocked-pending} OK, ${blocked} BLOQUEADAS, ${pending} PENDIENTES`);
  console.log("AUDITORIA SOLO LECTURA: NINGUN PEDIDO / NINGUN POST / NINGUNA IMPRESION");
}
void main().catch(()=>{console.error("READINESS_CHECK_FAILED");process.exitCode=1;});
