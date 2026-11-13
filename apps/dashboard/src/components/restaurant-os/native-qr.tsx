"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import styles from "./native-menu.module.css";
import qrStyles from "./native-qr.module.css";

type Table = { id:string; label:string; enabled:boolean; editorId:string };
type SecureLink = { url:string; dataUrl:string };
const API = "/dashboard-api/restaurant-ops/qr/secure-tables";

async function request<T>(url:string,method:"GET"|"POST"="GET"):Promise<T> {
  const r=await fetch(url,{method,credentials:"same-origin",cache:"no-store",
    headers:{Accept:"application/json",...(method==="POST"?{"Content-Type":"application/json"}:{})},
    ...(method==="POST"?{body:"{}"}:{})});
  const j=await r.json().catch(()=>({ok:false,error:"INVALID_RESPONSE"}));
  if(!r.ok||j.ok!==true)throw new Error(j.error||"La operación no pudo completarse");
  return j as T;
}

export default function NativeQrEditor(){
  const [tables,setTables]=useState<Table[]>([]);
  const [loaded,setLoaded]=useState(false);
  const [busy,setBusy]=useState<string>("");
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  // Raw capability links only live in this browser tab after explicit rotation.
  // They are not stored in localStorage or transmitted to third-party QR APIs.
  const [links,setLinks]=useState<Record<string,SecureLink>>({});
  const load=useCallback(async()=>{
    setError("");
    try{
      const data=await request<{ok:true;tables:Table[]}>(API);
      setTables(data.tables);
    }catch(e){setError(e instanceof Error?e.message:"No se pudieron consultar las mesas");}
    finally{setLoaded(true);}
  },[]);
  useEffect(()=>{void load();},[load]);

  async function rotate(t:Table){
    if(busy||!t.enabled)return;
    const approved=window.confirm(
      "Se generará un nuevo QR para "+t.label+".\n\n"+
      "ATENCIÓN: el QR anterior de esta mesa dejará de funcionar.\n"+
      "El enlace nuevo solo se muestra una vez. Guardalo o descargá la imagen antes de cerrar.\n\n"+
      "¿Continuar?"
    );
    if(!approved)return;
    setBusy(t.id);setError("");setNotice("");
    try{
      const result=await request<{ok:true;url:string;table:{id:string;label:string};notice:string}>(
        API+"/"+encodeURIComponent(t.id)+"/rotate","POST"
      );
      // Encode locally: the bearer token must not be shared with a QR vendor.
      const dataUrl=await QRCode.toDataURL(result.url,{
        width:360,margin:2,errorCorrectionLevel:"M",
        color:{dark:"#153442",light:"#ffffff"}
      });
      setLinks(prev=>({...prev,[t.id]:{url:result.url,dataUrl}}));
      setNotice("QR seguro emitido para "+t.label+
        ". Descargá e imprimí ESTE código. El anterior quedó invalidado.");
    }catch(e){
      setError((e instanceof Error?e.message:"No se pudo generar el QR")+
        ". Si el servidor cambió el token, volvé a emitirlo antes de imprimir.");
    }finally{setBusy("");}
  }

  return <section className={styles.wrapper}>
    <div className={styles.heading}>
      <div><div className={styles.kicker}>DELIBOCADOS / CÓDIGOS QR</div>
        <h1>QR de mesas del sistema nuevo</h1>
        <p>Estos códigos abren la carta de pedidos de Neuromind,
          no la carta café retirada de /menu.</p>
      </div>
      <div className={styles.actions}>
        <Link className={styles.secondary} href="/panel/menu">Administrar productos</Link>
        <Link className={styles.secondary} href="/panel/pedidos">Ver pedidos</Link>
        <button className={styles.secondary} type="button" onClick={()=>void load()}>Actualizar</button>
      </div>
    </div>
    <div className={styles.notice} role="note">
      Cada mesa tiene un QR propio y abre la misma carta. El número de mesa
      se reconoce automáticamente; el cliente no debe escribirlo.
      Emitir un QR NO activa la recepción de pedidos: el checkout seguro debe
      estar habilitado y probado primero. SmartPOS e impresión no están verificados.
    </div>
    {error&&<div role="alert" className={styles.error}>{error}</div>}
    {notice&&!error&&<div role="status" className={styles.notice}>{notice}</div>}
    {!loaded&&<p>Cargando mesas desde la base de datos…</p>}
    {loaded&&tables.length===0&&
      <div className={styles.error}>No hay mesas en el registro seguro. No se muestran QR antiguos.</div>}
    {loaded&&tables.length>0&&
      <div className={styles.summary}>
        <div><strong>{tables.length}</strong><span>Mesas registradas</span></div>
        <div><strong>{tables.filter(t=>t.enabled).length}</strong><span>Habilitadas</span></div>
        <div><strong>{Object.keys(links).length}</strong><span>QR emitidos en esta sesión</span></div>
      </div>}
    <div className={qrStyles.qrGrid}>
      {tables.map(t=><article className={qrStyles.qrCard} key={t.id}>
        <strong>{t.label}</strong>
        <small>{t.enabled?"Mesa habilitada":"Mesa deshabilitada"}</small>
        {links[t.id]?<>
          <img src={links[t.id].dataUrl} alt={"QR nuevo para "+t.label} />
          <a href={links[t.id].dataUrl}
            download={"delibocados-"+t.label.toLowerCase().replace(/[^a-z0-9]+/g,"-")+".png"}>
            Descargar QR PNG
          </a>
          <a href={links[t.id].url} target="_blank" rel="noopener noreferrer">
            Probar enlace del cliente
          </a>
          <button type="button" className={qrStyles.link}
            onClick={()=>void navigator.clipboard.writeText(links[t.id].url)}>
            Copiar URL
          </button>
        </>:<small>Sin QR nuevo generado en esta sesión</small>}
        <button type="button" className={styles.primarySmall}
          disabled={!t.enabled||busy!==""}
          onClick={()=>void rotate(t)}>
          {busy===t.id?"Generando…":links[t.id]?"Renovar QR":"Generar QR seguro"}
        </button>
      </article>)}
    </div>
    <p className={styles.muted}>
      Los códigos nuevos sustituyen a los que todavía llevan a
      delibocados.online/menu (410 Gone). Si cerrás esta pestaña sin
      descargar el QR, tendrás que renovarlo.
    </p>
  </section>;
}
