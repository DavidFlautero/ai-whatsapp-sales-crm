"use client";
import {useEffect,useState} from "react";

type Item = Record<string,unknown>;
function field(row:Item,...keys:string[]) {for(const key of keys){const v=row[key];if(typeof v==="string"||typeof v==="number")return String(v);}return "—";}
export default function RestaurantData({kind}:{kind:"orders"|"customers"}) {
  const [rows,setRows]=useState<Item[]>([]);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    const controller=new AbortController();
    fetch(`/api/restaurant/${kind}`,{credentials:"same-origin",cache:"no-store",signal:controller.signal})
      .then(async r=>{if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json();})
      .then(json=>{const result=Array.isArray(json)?json:Array.isArray(json[kind])?json[kind]:[];setRows(result);})
      .catch(e=>{if(!controller.signal.aborted)setError(String(e.message||e));})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[kind]);
  return <><h1>{kind==="orders"?"Pedidos y ventas":"Clientes del restaurante"}</h1>
    {loading?<p>Cargando registros…</p>:null}
    {error?<p role="alert">Error consultando la API: {error}</p>:null}
    {!loading&&!error?<div style={{overflowX:"auto",background:"white",borderRadius:14,border:"1px solid #e2e8f0",padding:20,marginTop:20}}>
      <table style={{width:"100%",borderCollapse:"collapse",textAlign:"left"}}><thead><tr>{(kind==="orders"?["Pedido","Cliente","Total","Estado"]:["Cliente","WhatsApp","Correo","Ciudad"]).map(h=><th key={h} style={{padding:12,borderBottom:"1px solid #ddd"}}>{h}</th>)}</tr></thead><tbody>
        {rows.map((r,i)=><tr key={String(r.id||i)}>{(kind==="orders"?[field(r,"number","id"),field(r,"customer_name","customer_id"),field(r,"total"),field(r,"payment_status")]:[field(r,"name"),field(r,"whatsapp"),field(r,"email"),field(r,"city")]).map((v,j)=><td key={j} style={{padding:12,borderBottom:"1px solid #eee"}}>{v}</td>)}</tr>)}
      </tbody></table>{rows.length===0?<p>No hay registros disponibles.</p>:null}
    </div>:null}
  </>;
}
