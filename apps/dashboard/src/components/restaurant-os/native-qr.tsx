"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import styles from "./native-menu.module.css";
import qrStyles from "./native-qr.module.css";

type Table={id:string;label:string;enabled:boolean;editorId:string;reprintAvailable:boolean};
type SecureLink={url:string;dataUrl:string};
type LinkResult={ok:true;url:string;table:{id:string;label:string};unchanged?:boolean};
const API="/dashboard-api/restaurant-ops/qr/secure-tables";

async function request<T>(url:string,method:"GET"|"POST"="GET"):Promise<T>{
 const r=await fetch(url,{method,credentials:"same-origin",cache:"no-store",
   headers:{Accept:"application/json",...(method==="POST"?{"Content-Type":"application/json"}:{})},
   ...(method==="POST"?{body:"{}"}:{})});
 const j=await r.json().catch(()=>({ok:false,error:"INVALID_RESPONSE"}));
 if(!r.ok||j.ok!==true)throw new Error(j.error||"La operación no pudo completarse");
 return j as T;
}
async function qrImage(url:string):Promise<string>{
 // The capability never leaves this browser and our own API. Do NOT use a QR vendor.
 return QRCode.toDataURL(url,{width:400,margin:2,errorCorrectionLevel:"M",
   color:{dark:"#153442",light:"#ffffff"}});
}

export default function NativeQrEditor(){
 const [tables,setTables]=useState<Table[]>([]);
 const [loaded,setLoaded]=useState(false);
 const [busy,setBusy]=useState("");
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [links,setLinks]=useState<Record<string,SecureLink>>({});
 // Never cache tokens in localStorage. Saved encrypted on our server, and
 // fetched only for authenticated owner/admin when they choose to print.
 const load=useCallback(async()=>{
   setError("");
   try{
     const data=await request<{ok:true;tables:Table[]}>(API);
     setTables(data.tables);
   }catch(e){setError(e instanceof Error?e.message:"No se pudieron consultar las mesas");}
   finally{setLoaded(true);}
 },[]);
 useEffect(()=>{void load();},[load]);

 async function show(t:Table){
   if(busy||!t.enabled||!t.reprintAvailable)return;
   setBusy(t.id);setError("");setNotice("");
   try{
     const result=await request<LinkResult>(
       API+"/"+encodeURIComponent(t.id)+"/link"
     );
     const dataUrl=await qrImage(result.url);
     setLinks(current=>({...current,[t.id]:{url:result.url,dataUrl}}));
     setNotice("QR de "+t.label+" recuperado. Es exactamente el mismo código: podés imprimirlo de nuevo sin invalidarlo.");
   }catch(e){setError(e instanceof Error?e.message:"No se pudo recuperar este QR");}
   finally{setBusy("");}
 }

 async function replace(t:Table){
   if(busy||!t.enabled)return;
   // Explicit exceptional operation. Never quietly revoke all printed table QRs.
   const explanation=t.reprintAvailable
     ?"Esto INVALIDA el QR que ya está pegado en "+t.label+". Tendrás que sustituir solamente ese impreso."
     :"No podemos recuperar el enlace anterior porque solo se guardó su hash. Si el QR anterior ya está impreso, SIGUE FUNCIONANDO; crear uno nuevo lo invalidará.";
   const answer=window.prompt(
     explanation+"\n\nLos QR no caducan. Reemplazalos solo por pérdida o compromiso.\n\n"+
     "Escribí REEMPLAZAR para continuar:"
   );
   if(answer!=="REEMPLAZAR")return;
   setBusy(t.id);setError("");setNotice("");
   try{
     const result=await request<LinkResult>(
       API+"/"+encodeURIComponent(t.id)+"/rotate","POST"
     );
     const dataUrl=await qrImage(result.url);
     setLinks(current=>({...current,[t.id]:{url:result.url,dataUrl}}));
     setTables(current=>current.map(table=>
       table.id===t.id?{...table,reprintAvailable:true}:table
     ));
     setNotice("Código permanente emitido para "+t.label+
       ". Descargalo e imprimilo una vez. Podés recuperarlo sin cambiarlo en el futuro.");
   }catch(e){
     setError((e instanceof Error?e.message:"No se pudo emitir QR")+
       ". Si se modificó el código, revisá el panel antes de imprimir.");
   }finally{setBusy("");}
 }

 async function loadAll(){
   if(busy)return;
   const target=tables.filter(t=>t.enabled&&t.reprintAvailable);
   if(!target.length){setNotice("No hay QR guardados para reimpresión. Los QR anteriores continúan válidos.");return;}
   setBusy("bulk");setError("");setNotice("");
   const recovered:Record<string,SecureLink>={};
   try{
     for(const t of target){
       const result=await request<LinkResult>(
         API+"/"+encodeURIComponent(t.id)+"/link"
       );
       recovered[t.id]={url:result.url,dataUrl:await qrImage(result.url)};
     }
     setLinks(current=>({...current,...recovered}));
     setNotice("Preparados "+target.length+" QR SIN CAMBIARLOS. Usá «Imprimir los QR cargados» o descargá cada PNG.");
   }catch(e){
     setError((e instanceof Error?e.message:"Error recuperando códigos")+
       ". No se renovó ningún QR. Los impresos siguen funcionando.");
   }finally{setBusy("");}
 }
 const saved=tables.filter(t=>t.enabled&&t.reprintAvailable).length;
 return <section className={styles.wrapper}>
   <div className={styles.heading}>
     <div><div className={styles.kicker}>DELIBOCADOS / CÓDIGOS QR</div>
       <h1>QR permanentes de mesas</h1>
       <p>Cada mesa tiene su propio QR: se imprime una vez y permanece válido sin vencimiento automático.
         Volver a descargar NO modifica el QR pegado.</p>
     </div>
     <div className={styles.actions}>
       <Link className={styles.secondary} href="/panel/menu">Administrar productos</Link>
       <Link className={styles.secondary} href="/panel/plano">Plano de mesas</Link>
       <button className={styles.secondary} type="button" onClick={()=>void load()}>Actualizar</button>
     </div>
   </div>
   <div className={styles.notice} role="note">
     <strong>Los QR NO se cambian todos los días.</strong> Cada mesa conserva siempre el mismo enlace.
     Cuando una cuenta se cierra, la siguiente persona escanea el mismo código y abre su nueva cuenta.
     Solo «Reemplazar código» lo invalida; es una operación excepcional.
   </div>
   <div className={qrStyles.printToolbar}>
     <button className={styles.secondary} type="button" disabled={!!busy||saved===0}
       onClick={()=>void loadAll()}>{busy==="bulk"?"Preparando…":`Cargar los ${saved} QR guardados para imprimir`}</button>
     <button className={styles.secondary} type="button"
       disabled={!!busy||Object.keys(links).length===0} onClick={()=>window.print()}>
       Imprimir los QR cargados
     </button>
   </div>
   {error&&<div role="alert" className={styles.error}>{error}</div>}
   {notice&&!error&&<div role="status" className={styles.notice}>{notice}</div>}
   {!loaded&&<p>Cargando mesas desde la base de datos…</p>}
   {loaded&&tables.length===0&&<div className={styles.error}>No hay mesas registradas.</div>}
   {loaded&&tables.length>0&&<div className={styles.summary}>
     <div><strong>{tables.length}</strong><span>Mesas registradas</span></div>
     <div><strong>{tables.filter(t=>t.enabled).length}</strong><span>Habilitadas</span></div>
     <div><strong>{saved}</strong><span>QR recuperables sin cambiarlos</span></div>
   </div>}
   <div className={qrStyles.qrGrid}>
     {tables.map(t=><article className={`${qrStyles.qrCard} ${links[t.id]?qrStyles.printReady:qrStyles.notPrintReady}`} key={t.id}>
       <strong>{t.label}</strong>
       <small>{!t.enabled?"Mesa deshabilitada":t.reprintAvailable?
         "Permanente · recuperable":"QR antiguo válido, pero no recuperable desde el panel"}</small>
       {links[t.id]?<>
         <img src={links[t.id].dataUrl} alt={"QR permanente de "+t.label}/>
         <a href={links[t.id].dataUrl}
           download={"delibocados-"+t.label.toLowerCase().replace(/[^a-z0-9]+/g,"-")+".png"}>
           Descargar QR PNG
         </a>
         <a href={links[t.id].url} target="_blank" rel="noopener noreferrer">
           Probar enlace del cliente
         </a>
       </>:null}
       {t.reprintAvailable?<button className={styles.primarySmall}
         type="button" disabled={!t.enabled||!!busy} onClick={()=>void show(t)}>
         {busy===t.id?"Cargando…":"Ver / reimprimir el mismo QR"}
       </button>:<small>Si el QR impreso funciona, no hace falta reemplazarlo.</small>}
       <button className={qrStyles.dangerQr} type="button" disabled={!t.enabled||!!busy}
         onClick={()=>void replace(t)}>
         {busy===t.id?"Guardando…":t.reprintAvailable?"Reemplazar código (invalida el anterior)":"Emitir nuevo QR si perdiste el anterior"}
       </button>
     </article>)}
   </div>
   <p className={styles.muted}>
     Los códigos antiguos que llevan a delibocados.online/menu no muestran la nueva cuenta de mesa.
     Una vez que imprimas los QR de /qr-pedido, conservalos: no expiran al cerrar caja,
     al cambiar de turno ni al finalizar el día. Si el enlace anterior ya estaba pegado
     y no fue almacenado cifrado, seguirá funcionando, pero no se puede reimprimir desde su hash.
   </p>
 </section>;
}
