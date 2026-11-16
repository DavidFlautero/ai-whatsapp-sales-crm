"use client";
import {useEffect,useState} from "react";
import styles from "./MenuBannersEditor.module.css";
type Banner={eyebrow:string;title:string;detail:string};
export default function MenuBannersEditor(){
  const [banners,setBanners]=useState<Banner[]>([]);
  const [busy,setBusy]=useState(false),[status,setStatus]=useState(""),[dirty,setDirty]=useState(false);
  useEffect(()=>{fetch("/api/delibocados-menu-banners",{cache:"no-store"}).then(r=>r.json()).then(r=>{if(r.ok&&Array.isArray(r.banners))setBanners(r.banners)}).catch(()=>setStatus("No se pudieron cargar las promociones."))},[]);
  function edit(i:number,field:keyof Banner,value:string){setBanners(old=>old.map((b,j)=>j===i?{...b,[field]:value}:b));setDirty(true);setStatus("");}
  async function save(){if(busy||!dirty)return;setBusy(true);setStatus("");try{
    const res=await fetch("/api/delibocados-menu-banners",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({banners})});
    const data=await res.json();if(!res.ok||!data.ok)throw Error(data.error||"No se pudo guardar");
    setBanners(data.banners);setDirty(false);setStatus("Promociones publicadas en la carta digital.");
  }catch(e){setStatus(e instanceof Error?e.message:"No se pudo guardar");}finally{setBusy(false);}}
  return <section className={styles.wrapper}>
    <div className={styles.heading}><div><span>DELIBOCADOS · PORTADA</span><h2>Mensajes y promociones del menú</h2><p>El carrusel blanco de la carta muestra estos mensajes. Podés editar horario, almuerzo del día y promociones sin tocar código.</p></div>
      <button type="button" onClick={()=>void save()} disabled={busy||!dirty}>{busy?"Guardando…":"Guardar y publicar"}</button></div>
    {status?<p className={styles.status} role="status">{status}</p>:null}
    <div className={styles.grid}>{banners.map((b,i)=><article key={i}><strong>Diapositiva {i+1}</strong>
      <label>Etiqueta<input maxLength={55} value={b.eyebrow} onChange={e=>edit(i,"eyebrow",e.target.value)}/></label>
      <label>Título<input maxLength={95} value={b.title} onChange={e=>edit(i,"title",e.target.value)}/></label>
      <label>Descripción<textarea maxLength={210} value={b.detail} onChange={e=>edit(i,"detail",e.target.value)}/></label>
      {banners.length>1?<button type="button" className={styles.remove} onClick={()=>{setBanners(a=>a.filter((_,j)=>j!==i));setDirty(true)}}>Quitar</button>:null}
    </article>)}</div>
    {banners.length<5?<button type="button" className={styles.add} onClick={()=>{setBanners(a=>[...a,{eyebrow:"NOVEDAD",title:"Nueva promoción",detail:"Editá este mensaje antes de publicar."}]);setDirty(true)}}>+ Agregar diapositiva</button>:null}
  </section>;
}
