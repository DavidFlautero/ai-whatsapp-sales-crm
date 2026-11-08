/**
 * Delibocados onboarding orchestration, deliberately disconnected from live POS.
 * prepare: register missing providers disabled; never change an existing integration.
 * status: read-only readiness matrix, no secret values, no network to vendors.
 * toteat-key: safely prompt for vendor credentials using hidden TTY input; store
 *             via existing AES-256-GCM tenant secret repository. NO activation.
 * catalog-template: CSV mapping scaffolds, never fake vendor product IDs.
 */
import {config} from "dotenv";
import {createHash} from "node:crypto";
import {mkdir,writeFile} from "node:fs/promises";
import {join} from "node:path";
config({path:"../../.env",quiet:true});

const COMPANY="delibocados";
type Provider="toteat"|"pos360";
type Integration={company_id:string;provider:string;status:string;enabled:boolean};
type MapRow={provider:string;product_id:string;external_product_code:string;active:boolean;reviewed_at:string|null};
type MenuProduct={id?:unknown;name?:unknown;priceCOP?:unknown;available?:unknown};
type MenuRow={revision:number;payload:{products?:MenuProduct[]}};
type QRTable={enabled:boolean};
type QRGeneral={enabled:boolean};
type SecretRow={provider:string};
type ExportRow={provider:string;status:string;attempts:number};

function out(message:string){process.stdout.write(message+"\n");}
function oneLine(value:unknown){return typeof value==="string"?value.replace(/[\r\n\t]/g," ").trim():"";}
function csv(value:unknown):string{
  let s=String(value??"").replace(/\r/g," ").replace(/\n/g," ");
  if(/^[=+@-]/.test(s))s="'"+s;
  return '"'+s.replace(/"/g,'""')+'"';
}
function hidden(prompt:string,max=512):Promise<string>{
  if(!process.stdin.isTTY || typeof process.stdin.setRawMode!=="function"){
    return Promise.reject(new Error("NECESITA_TERMINAL_INTERACTIVA"));
  }
  process.stdout.write(prompt);
  const stdin=process.stdin;
  const raw=Boolean(stdin.isRaw);
  stdin.setRawMode(true);
  stdin.resume();
  return new Promise<string>((resolve,reject)=>{
    let buffer="";
    const close=()=>{
      stdin.off("data",data);
      stdin.setRawMode(raw);
      stdin.pause();
      process.stdout.write("\n");
    };
    const data=(chunk:Buffer)=>{
      for(const char of chunk.toString("utf8")){
        if(char==="\r"||char==="\n"){
          close();
          resolve(buffer);
          return;
        }
        if(char==="\u0003"||char==="\u001b"){
          close();
          reject(new Error("OPERACION_CANCELADA"));
          return;
        }
        if(char==="\u007f"||char==="\b"){
          buffer=buffer.slice(0,-1);
          continue;
        }
        if(char>=" " && buffer.length<max)buffer+=char;
      }
    };
    stdin.on("data",data);
  });
}
async function setup(){
  const {supabaseRequest}=await import("../services/db/supabase-rest.client.js");
  const existing=await supabaseRequest<Integration[]>({
    table:"company_integrations",
    query:"?company_id=eq.delibocados&provider=in.(toteat,pos360)&select=company_id,provider,status,enabled&limit=5"
  });
  const found=new Set(existing.map(x=>x.provider));
  const missing=(["toteat","pos360"] as const).filter(p=>!found.has(p));
  if(existing.some(x=>x.enabled || x.status==="connected")){
    out("BLOQUEADO: Integraciones ya habilitadas; no se modificó nada.");
    process.exitCode=1;return;
  }
  if(missing.length){
    await supabaseRequest<Integration[]>({
      table:"company_integrations",method:"POST",
      query:"?on_conflict=company_id,provider",
      prefer:"resolution=ignore-duplicates,return=representation",
      body:missing.map(provider=>({company_id:COMPANY,provider,status:"pending",enabled:false}))
    });
  }
  out("=== REGISTRO POS PREPARADO (SIN ENVÍOS) ===");
  for(const provider of ["toteat","pos360"])
    out(provider+": "+(missing.includes(provider as Provider)?"REGISTRADO DESACTIVADO":"YA EXISTÍA, SIN CAMBIOS"));
  out("Integraciones externas NO activadas. Ningún worker ni impresión iniciados.");
}
async function status(){
  const {supabaseRequest}=await import("../services/db/supabase-rest.client.js");
  const [integrations,secrets,mappings,menu,qrTables,qrGeneral,exports]=await Promise.all([
    supabaseRequest<Integration[]>({
      table:"company_integrations",
      query:"?company_id=eq.delibocados&provider=in.(toteat,pos360)&select=company_id,provider,status,enabled&limit=5"
    }),
    supabaseRequest<SecretRow[]>({
      table:"company_integration_secrets",
      query:"?company_id=eq.delibocados&provider=in.(toteat,pos360)&select=provider&limit=5"
    }),
    supabaseRequest<MapRow[]>({
      table:"restaurant_ops_pos_product_map",
      query:"?company_id=eq.delibocados&select=provider,product_id,external_product_code,active,reviewed_at&limit=2000"
    }),
    supabaseRequest<MenuRow[]>({
      table:"restaurant_menu_documents",
      query:"?company_id=eq.delibocados&select=revision,payload&limit=1"
    }),
    supabaseRequest<QRTable[]>({
      table:"restaurant_ops_qr_tables",
      query:"?company_id=eq.delibocados&select=enabled&limit=100"
    }),
    supabaseRequest<QRGeneral[]>({
      table:"restaurant_ops_qr_general",
      query:"?company_id=eq.delibocados&select=enabled&limit=1"
    }),
    supabaseRequest<ExportRow[]>({
      table:"restaurant_ops_pos_exports",
      query:"?company_id=eq.delibocados&select=provider,status,attempts&limit=1000"
    })
  ]);
  const products=Array.isArray(menu[0]?.payload?.products)?menu[0].payload.products:[];
  const ids=new Set(products.filter(p=>typeof p.id==="string").map(p=>String(p.id)));
  const sellable=products.filter(p=>
    typeof p.id==="string" && p.available!==false &&
    Number.isSafeInteger(p.priceCOP) && Number(p.priceCOP)>=0
  );
  out("=== MATRIZ DE SINCRONIZACION DELIBOCADOS (SOLO LECTURA) ===");
  out("Menu: "+products.length+" productos | revisados para venta: "+sellable.length);
  out("Revision catalogo: "+String(menu[0]?.revision??"PENDIENTE"));
  for(const provider of ["toteat","pos360"] as const){
    const i=integrations.find(x=>x.provider===provider);
    const m=mappings.filter(x=>x.provider===provider&&x.active&&Boolean(x.reviewed_at)&&ids.has(x.product_id));
    const s=secrets.some(x=>x.provider===provider);
    const statuses=new Map<string,number>();
    for(const x of exports.filter(x=>x.provider===provider))
      statuses.set(x.status,(statuses.get(x.status)??0)+1);
    out("\n"+provider.toUpperCase()+":");
    out("  Registro: "+(i?i.status+" / enabled="+i.enabled:"NO REGISTRADO"));
    out("  Secreto cifrado almacenado: "+(s?"SI (sin validar contenido)":"NO"));
    out("  Mapeos con revision humana: "+m.length+"/"+ids.size+" IDs de menu");
    out("  Outbox (hasta 1000): "+JSON.stringify(Object.fromEntries(statuses)));
    if(i?.enabled===true)out("  ADVERTENCIA: INTEGRACION ENABLED; revisar operacion");
    out("  Transporte verificado: NO (adaptador vendor/puente Windows pendiente)");
  }
  out("\nQR: "+qrTables.length+" mesas registradas; "+
    qrTables.filter(x=>x.enabled).length+" habilitadas.");
  out("QR general: "+(qrGeneral[0]?.enabled===true?"ACTIVO":"DESACTIVADO"));
  out("Toteat: requiere contrato POST, mapeos y confirmacion de impresión.");
  out("POS360: requiere protocolo o puente Windows verificado y mapeos.");
  out("Google Maps: coordenadas/poligonos y credenciales deben validarse aparte.");
  out("=== FIN: NINGUN POST A PROVEEDORES; SIN PEDIDOS NUEVOS ===");
}
async function saveToteatKey(){
  const {getCompanyIntegration}=await import("../services/integrations/company-integration.repository.js");
  const integration=await getCompanyIntegration(COMPANY,"toteat");
  if(!integration || integration.enabled || integration.status!=="pending")
    throw new Error("PRIMERO_PREPARE_REGISTRO_PENDING_DESACTIVADO");
  out("=== TOTEAT: CAPTURA CIFRADA EN VPS (NO EN EL CHAT) ===");
  out("Los valores se ocultan al escribir. Pegar un valor y pulsar Enter por campo.");
  const environment=await hidden("Ambiente development|production: ",30);
  const restaurantId=await hidden("Restaurant ID: ",40);
  const localNumber=await hidden("Local number: ",40);
  const userId=await hidden("User ID: ",40);
  const apiToken=await hidden("API token (oculto): ",512);
  const plain=JSON.stringify({environment,restaurantId,localNumber,userId,apiToken});
  const {parseToteatCredentials}=await import("../services/restaurant-ops/restaurant-toteat-readonly.service.js");
  const parsed=parseToteatCredentials(plain);
  if(!parsed.ok)throw new Error("CREDENCIALES_INVALIDAS_"+parsed.reason);
  const confirm=await hidden("Escribí GUARDAR para cifrar sin activar: ",15);
  if(confirm!=="GUARDAR")throw new Error("OPERACION_CANCELADA");
  const {saveCompanySecret,readCompanySecret}=await import("../services/integrations/company-secret.repository.js");
  await saveCompanySecret({companyId:COMPANY,provider:"toteat",keyVersion:1},plain);
  const decrypted=await readCompanySecret({companyId:COMPANY,provider:"toteat",keyVersion:1});
  if(!decrypted || createHash("sha256").update(decrypted).digest("hex")!==
    createHash("sha256").update(plain).digest("hex"))
    throw new Error("VERIFICACION_CIFRADO_FALLIDA");
  out("OK: Credencial cifrada y verificada. Contenido NO impreso.");
  out("Toteat sigue PENDING, DESACTIVADO. NO se enviaron pedidos.");
}
async function exportCatalog(){
  if(typeof process.getuid==="function" && process.getuid()!==0)
    throw new Error("REQUIERE_ROOT_PARA_ARCHIVOS_PRIVADOS");
  const {supabaseRequest}=await import("../services/db/supabase-rest.client.js");
  const menu=await supabaseRequest<MenuRow[]>({
    table:"restaurant_menu_documents",
    query:"?company_id=eq.delibocados&select=revision,payload&limit=1"
  });
  const products=menu[0]?.payload?.products;
  if(!Array.isArray(products)||products.length===0)
    throw new Error("MENU_NO_DISPONIBLE");
  const dir="/root/backups/delibocados-pos-onboarding";
  await mkdir(dir,{recursive:true,mode:0o700});
  for(const provider of ["toteat","pos360"]){
    const lines=[
      ["provider","product_id","name","price_cop","external_product_code","reviewed"].map(csv).join(",")
    ];
    for(const p of products){
      if(typeof p.id!=="string")continue;
      lines.push([provider,p.id,oneLine(p.name),p.priceCOP??"","","NO"].map(csv).join(","));
    }
    const dest=join(dir,provider+"-menu-revision-"+String(menu[0].revision)+".csv");
    await writeFile(dest,lines.join("\n")+"\n",{flag:"wx",mode:0o600});
    out("Plantilla privada: "+dest);
  }
  out("Mapeos VACIOS: revisar códigos de producto del proveedor antes de importar.");
}
async function main(){
  const cmd=process.argv[2]??"status";
  if(cmd==="prepare")await setup();
  else if(cmd==="status")await status();
  else if(cmd==="toteat-key")await saveToteatKey();
  else if(cmd==="catalog-template")await exportCatalog();
  else throw new Error("ACCION_INVALIDA_USAR_prepare_status_toteat-key_catalog-template");
}
void main().catch((error:unknown)=>{
  // Never log underlying errors: secrets, URLs and vendor payloads remain private.
  const reason=error instanceof Error && /^(?:CREDENCIALES_INVALIDAS_|MENU_NO_DISPONIBLE|OPERACION_CANCELADA|NECESITA_TERMINAL_INTERACTIVA|REQUIERE_ROOT_PARA_ARCHIVOS_PRIVADOS|PRIMERO_PREPARE_REGISTRO_PENDING_DESACTIVADO)/.test(error.message)?
    error.message:"ERROR_DE_CONFIGURACION_O_BASE_DE_DATOS";
  console.error("DELIBOCADOS POS: "+reason+" (sin cambios automáticos de activación)");
  process.exitCode=1;
});
