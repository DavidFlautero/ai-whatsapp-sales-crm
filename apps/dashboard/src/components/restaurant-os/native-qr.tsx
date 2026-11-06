"use client";

import { useCallback, useEffect, useState, type PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import styles from "./native-menu.module.css";
import qrStyles from "./native-qr.module.css";

type Table = { id: string; mesa: string; enabled: boolean; x: number; y: number; token?: string | null; [key:string]: unknown };
type QrData = { salon: string; general_enabled: boolean; tables: Table[]; [key:string]: unknown };
type QrResponse = { revision: number; payload: QrData; error?: string };
const PUBLIC = "https://delibocados.online";

export default function NativeQrEditor() {
  const [data, setData] = useState<QrData | null>(null);
  const [revision, setRevision] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/panel/qr/api", { credentials: "same-origin", cache: "no-store" });
      const result = await response.json() as QrResponse;
      if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
      if (!result.payload || !Array.isArray(result.payload.tables)) throw new Error("Formato de mesas incorrecto");
      setData(result.payload);setRevision(Number(result.revision));setDirty(false);
      setSelected(result.payload.tables[0]?.id || "");
      setNotice("Se cargaron las mesas y los QR del restaurante.");
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudieron cargar las mesas"); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { const warn=(e:BeforeUnloadEvent)=>{if(dirty){e.preventDefault();e.returnValue="";}};window.addEventListener("beforeunload",warn);return()=>window.removeEventListener("beforeunload",warn);},[dirty]);

  function updateData(patch: Partial<QrData>) {setData(d => d ? ({...d,...patch}) : null);setDirty(true);setError("");}
  function updateTable(id: string, patch: Partial<Table>) {
    setData(d => d ? ({...d,tables:d.tables.map(t=>t.id===id?{...t,...patch}:t)}) : null);
    setDirty(true);setError("");
  }
  function addTable() {
    if (!data || data.tables.length >= 80) {setError("Límite de 80 mesas.");return;}
    const name = window.prompt("Nombre de la mesa:", `Mesa ${data.tables.length+1}`)?.trim();
    if (!name) return;
    if (name.length > 48 || data.tables.some(t=>t.mesa.toLowerCase()===name.toLowerCase())) {setError("Nombre repetido o demasiado largo.");return;}
    const id = "mesa_" + crypto.randomUUID().replaceAll("-", "");
    const table:Table={id,mesa:name,enabled:true,x:Math.min(90,18+(data.tables.length%5)*16),y:Math.min(84,18+Math.floor(data.tables.length/5)*15),token:null};
    updateData({tables:[...data.tables,table]});setSelected(id);
  }
  function removeTable(id:string){if(!data)return;const t=data.tables.find(x=>x.id===id);if(!t||!window.confirm(`¿Eliminar la mesa «${t.mesa}»? Sus QR quedarán inactivos al publicar.`))return;updateData({tables:data.tables.filter(t=>t.id!==id)});setSelected("");}
  function move(e: ReactPointerEvent<HTMLButtonElement>, table:Table) {
    if (e.buttons !== 1) return;
    const map = e.currentTarget.parentElement;
    if (!map) return;
    const box = map.getBoundingClientRect();
    const x = Math.min(96,Math.max(4,((e.clientX-box.left)/box.width)*100));
    const y = Math.min(94,Math.max(6,((e.clientY-box.top)/box.height)*100));
    updateTable(table.id,{x:Math.round(x*10)/10,y:Math.round(y*10)/10});
  }
  async function save() {
    if (!data || revision===null || !dirty || busy) return;
    setBusy(true);setError("");
    try {
      const response=await fetch("/panel/qr/api",{method:"POST",credentials:"same-origin",cache:"no-store",headers:{"Content-Type":"application/json"},body:JSON.stringify({revision,payload:data})});
      const result=await response.json() as QrResponse;
      if(!response.ok) throw new Error(result.error||`HTTP ${response.status}`);
      if(!result.payload || !Array.isArray(result.payload.tables)) throw new Error("Respuesta incompleta del editor QR");
      setData(result.payload);setRevision(Number(result.revision));setDirty(false);
      setNotice("Mesas y QR guardados en PostgreSQL. Los enlaces de la carta quedaron actualizados.");
    }catch(e){setError((e instanceof Error?e.message:"No se pudo guardar")+". Los cambios siguen en el borrador.");}
    finally{setBusy(false);}
  }

  return <section className={styles.wrapper}>
    <div className={styles.heading}><div><div className={styles.kicker}>DELIBOCADOS / RESTAURANTE</div><h1>Mesas y códigos QR</h1><p>Gestioná los códigos QR vinculados al menú real. Los identificadores existentes se conservan.</p></div>
      <div className={styles.actions}><Link className={styles.secondary} href="/panel/menu">Menú digital</Link>
        <a className={styles.secondary} href={`${PUBLIC}/menu`} target="_blank" rel="noopener noreferrer">Carta pública</a>
        <button className={styles.primary} disabled={!dirty||busy} onClick={()=>void save()}>{busy?"Guardando…":dirty?"Guardar mesas y QR":"Sin cambios"}</button></div></div>
    {notice&&!error&&<div role="status" className={styles.notice}>{notice}{dirty?" Hay cambios pendientes.":""}</div>}
    {error&&<div role="alert" className={styles.error}>{error}</div>}
    {!data?<button className={styles.secondary} onClick={()=>void load()}>Cargar mesas</button>:<>
      <div className={qrStyles.topGrid}>
        <section className={styles.card}><h2>QR general</h2><label className={qrStyles.check}><input type="checkbox" checked={data.general_enabled} onChange={e=>updateData({general_enabled:e.target.checked})}/> Permitir que el cliente elija su mesa desde un QR general</label>
          <label className={qrStyles.field}>Nombre del salón<input maxLength={80} value={data.salon||""} onChange={e=>updateData({salon:e.target.value})}/></label>
          <img className={qrStyles.qr} alt="Código QR general" src={`${PUBLIC}/restaurant-qr/image?tipo=general`}/>
          <a className={styles.secondary} target="_blank" rel="noopener noreferrer" href={`${PUBLIC}/restaurant-qr/image?tipo=general`}>Abrir para imprimir</a>
        </section>
        <section className={styles.card}><div className={styles.cardTitle}><h2>Mesas registradas ({data.tables.length})</h2><button className={styles.primarySmall} type="button" onClick={addTable}>+ Mesa</button></div>
          <div className={qrStyles.tableList}>{data.tables.map(t=><div className={`${qrStyles.tableRow} ${selected===t.id?qrStyles.selected:""}`} key={t.id}>
            <button type="button" className={qrStyles.tableName} onClick={()=>setSelected(t.id)}><strong>{t.mesa}</strong><small>{t.token?"QR generado":"QR pendiente de guardar"}</small></button>
            <label className={qrStyles.check}><input type="checkbox" checked={t.enabled} onChange={e=>updateTable(t.id,{enabled:e.target.checked})}/> Activa</label>
            <button className={qrStyles.link} type="button" onClick={()=>{const name=window.prompt("Nuevo nombre de mesa:",t.mesa)?.trim();if(name&&name.length<=48&&!data.tables.some(x=>x.id!==t.id&&x.mesa.toLowerCase()===name.toLowerCase())) updateTable(t.id,{mesa:name});}}>Editar</button>
            <button className={qrStyles.link} type="button" onClick={()=>removeTable(t.id)}>Eliminar</button>
          </div>)}</div>
        </section>
      </div>
      <section className={styles.card}><h2>Plano de ubicación</h2><p className={styles.muted}>Seleccioná y arrastrá las mesas para ubicarlas. Los cambios quedan pendientes hasta guardar.</p>
        <div className={qrStyles.map}>{data.tables.map(t=><button key={t.id} type="button" title={t.mesa} className={`${qrStyles.pin} ${t.enabled?"":qrStyles.disabled} ${selected===t.id?qrStyles.pinSelected:""}`} style={{left:`${t.x}%`,top:`${t.y}%`}} onPointerDown={e=>{setSelected(t.id);e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>move(e,t)}>{t.mesa}</button>)}</div>
      </section>
      <section className={styles.card}><h2>Códigos QR por mesa</h2><div className={qrStyles.qrGrid}>{data.tables.map(t=><div className={qrStyles.qrCard} key={t.id}><strong>{t.mesa}</strong><small>{t.enabled?"Habilitada":"Deshabilitada"}</small>
        {t.token?<><img alt={`QR de ${t.mesa}`} src={`${PUBLIC}/restaurant-qr/image?mesa=${encodeURIComponent(t.token)}`}/><a href={`${PUBLIC}/restaurant-qr/image?mesa=${encodeURIComponent(t.token)}`} target="_blank" rel="noopener noreferrer">Abrir QR</a></>:<p className={styles.muted}>Guardá para generar el QR.</p>}
      </div>)}</div></section>
    </>}
  </section>;
}
