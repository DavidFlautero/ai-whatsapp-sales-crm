"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "./mesas-pedidos.module.css";

type Table = { id: string; label: string; enabled: boolean };
type Session = { id: string; qr_table_id: string; opened_at: string; status: "open"|"closed" };
type Item = { id: string; product_name: string; quantity: number; line_total_cop: number; instructions?: string };
type Order = {
 id: string; number: number; qr_table_id?: string|null; table_session_id?: string|null;
 fulfillment_mode: string; status: string; payment_status: string; customer_name: string;
 total_cop: number; created_at: string; restaurant_ops_order_items?: Item[];
};
type Payload = { ok: boolean; tables?: Table[]; sessions?: Session[]; orders?: Order[]; error?: string };
const money = (n: number) => new Intl.NumberFormat("es-CO", {
 style: "currency", currency: "COP", maximumFractionDigits: 0
}).format(n);
const statusLabel: Record<string,string> = {
 confirmed:"Recibido",preparing:"En preparación",ready:"Listo",
 completed:"Entregado",cancelled:"Cancelado",out_for_delivery:"En reparto"
};
const isBillable = (o: Order) => o.status!=="cancelled";
const canClose = (orders: Order[]) => orders.length>0 && orders.every(o=>
 o.status==="cancelled" || (o.status==="completed" && o.payment_status==="verified")
);
export default function MesasPedidosClient() {
 const [tables,setTables]=useState<Table[]>([]);
 const [sessions,setSessions]=useState<Session[]>([]);
 const [orders,setOrders]=useState<Order[]>([]);
 const [selectedId,setSelectedId]=useState("");
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [refreshed,setRefreshed]=useState("");
 const load=useCallback(async()=>{
  try{
   const r=await fetch("/dashboard-api/restaurant-ops/orders/tables",{
     credentials:"same-origin",cache:"no-store"
   });
   const data=await r.json() as Payload;
   if(!r.ok||!data.ok||!Array.isArray(data.tables)||
      !Array.isArray(data.orders)||!Array.isArray(data.sessions))
    throw new Error(data.error||"No se pudo consultar el panel de mesas");
   setTables(data.tables);setSessions(data.sessions);setOrders(data.orders);
   setError("");setRefreshed(new Date().toLocaleTimeString("es-CO"));
  }catch(e){setError(e instanceof Error?e.message:"Error consultando mesas");}
  finally{setLoading(false);}
 },[]);
 useEffect(()=>{
  void load();
  const timer=setInterval(()=>void load(),10000);
  return()=>clearInterval(timer);
 },[load]);
 const activeSessions=useMemo(()=>new Map(sessions.map(x=>[x.qr_table_id,x])),[sessions]);
 const byTable=useMemo(()=>{
  const lookup=new Map<string,Order[]>();
  for(const o of orders){
   if(o.fulfillment_mode!=="dine_in"||!o.qr_table_id)continue;
   const existing=lookup.get(o.qr_table_id)||[];
   existing.push(o);lookup.set(o.qr_table_id,existing);
  }
  return lookup;
 },[orders]);
 const current=selectedId ? tables.find(t=>t.id===selectedId) : undefined;
 const currentSession=current ? activeSessions.get(current.id) : undefined;
 const currentOrders=currentSession
  ? (byTable.get(current?.id??"")??[]).filter(o=>o.table_session_id===currentSession.id)
  : (byTable.get(current?.id??"")??[]).filter(o=>
      !o.table_session_id&&!["completed","cancelled"].includes(o.status));
 const total=currentOrders.filter(isBillable).reduce((sum,o)=>sum+o.total_cop,0);
 const occupied=tables.filter(t=>activeSessions.has(t.id)).length;
 async function closeTable(){
  if(!current||!currentSession||busy||!canClose(currentOrders))return;
  if(!window.confirm("¿Cerrar la cuenta de "+current.label+"? Solo se permite con los pedidos entregados y cobrados."))return;
  setBusy(true);setError("");setNotice("");
  try{
   const r=await fetch("/dashboard-api/restaurant-ops/orders/tables/"+
     encodeURIComponent(currentSession.id)+"/close",{
       method:"POST",credentials:"same-origin",
       headers:{"Content-Type":"application/json"},body:"{}"
   });
   const data=await r.json();
   if(!r.ok||data.ok!==true)throw new Error(
     data.error==="TABLE_HAS_UNFINISHED_OR_UNPAID_ORDERS"
       ?"Hay pedidos pendientes de entregar o cobrar; la mesa sigue abierta."
       :data.error||"No se pudo cerrar la mesa"
   );
   setNotice(current.label+" cerrada correctamente. El siguiente QR abrirá una cuenta nueva.");
   await load();
  }catch(e){setError(e instanceof Error?e.message:"No se pudo cerrar la mesa");}
  finally{setBusy(false);}
 }
 return <main className={styles.page}>
  <header className={styles.header}>
   <div><span>DELIBOCADOS / SALÓN</span><h1>Plano de mesas y cuentas</h1>
    <p>Seleccioná una mesa para consultar su cuenta abierta, sus comandas y el importe total. Los pedidos adicionales se suman a la cuenta de esa mesa.</p></div>
   <div className={styles.actions}>
    <button type="button" onClick={()=>void load()}>Actualizar</button>
    <Link href="/panel/pedidos">Pedidos</Link>
    <Link href="/panel/cocina">Cocina</Link>
    <Link href="/panel/qr">Códigos QR</Link>
   </div>
  </header>
  {error&&<div className={styles.error} role="alert">{error}</div>}
  {notice&&<div className={styles.success} role="status">{notice}</div>}
  {loading&&<p>Cargando mesas…</p>}
  {!loading&&<p className={styles.hint}>{tables.length} mesas registradas ·
    {" "}{occupied} ocupadas · {tables.filter(t=>t.enabled&&!activeSessions.has(t.id)).length} libres ·
    {" "}Actualizado {refreshed} (cada 10 s)</p>}
  <section className={styles.grid} aria-label="Plano interactivo de mesas">
   {tables.map(t=>{
    const session=activeSessions.get(t.id);
    const bill=session?(byTable.get(t.id)??[]).filter(o=>o.table_session_id===session.id):[];
    const tableTotal=bill.filter(isBillable).reduce((sum,o)=>sum+o.total_cop,0);
    const count=bill.length;
    return <button type="button" key={t.id}
      className={[styles.tableTile,selectedId===t.id?styles.selected:"",
         session?styles.occupiedTile:t.enabled?styles.freeTile:styles.disabledTile].join(" ")}
      onClick={()=>setSelectedId(t.id)} aria-pressed={selectedId===t.id}>
      <strong>{t.label}</strong>
      <span>{session?"OCUPADA":t.enabled?"LIBRE":"DESHABILITADA"}</span>
      <b>{session?money(tableTotal):"—"}</b>
      {session&&<small>{count} pedido(s) · cuenta abierta</small>}
    </button>;
   })}
  </section>
  {current&&<section className={styles.detail} aria-label={"Cuenta de "+current.label}>
   <div className={styles.detailHead}>
    <div><span>CUENTA DE MESA</span><h2>{current.label}</h2>
      <p>{currentSession
        ?"Abierta desde "+new Date(currentSession.opened_at).toLocaleString("es-CO")
        :"Sin una cuenta activa"}</p></div>
    <button type="button" className={styles.closeDetail} onClick={()=>setSelectedId("")}
      aria-label="Cerrar detalle">×</button>
   </div>
   {currentOrders.length===0?<p className={styles.muted}>
    No hay comandas activas vinculadas a esta cuenta. La mesa queda libre al cerrar su cuenta desde el panel.
   </p>:currentOrders.map(o=><article className={styles.order} key={o.id}>
    <div className={styles.orderHeader}>
     <strong>Comanda #{o.number}</strong><span>{statusLabel[o.status]??o.status}</span>
    </div>
    <small>{o.customer_name} · {new Date(o.created_at).toLocaleTimeString("es-CO",{hour:"2-digit",minute:"2-digit"})}</small>
    {(o.restaurant_ops_order_items??[]).map(i=><div className={styles.item} key={i.id}>
      <span>{i.quantity} × {i.product_name}{i.instructions?<em> · {i.instructions}</em>:null}</span>
      <span>{money(i.line_total_cop)}</span>
    </div>)}
    <div className={styles.sum}><strong>{money(o.status==="cancelled"?0:o.total_cop)}</strong>
      <small>Pago: {o.payment_status}</small></div>
   </article>)}
   <div className={styles.bill}><span>Total de la cuenta abierta</span><strong>{money(total)}</strong></div>
   {currentSession?<div className={styles.actions}>
     <button type="button" disabled={busy||!canClose(currentOrders)}
       onClick={()=>void closeTable()}>{busy?"Cerrando…":"Cerrar cuenta y liberar mesa"}</button>
     {!canClose(currentOrders)&&<p className={styles.hint}>
       Para cerrar: entregar todas las comandas y registrar el pago verificado.
     </p>}
   </div>:null}
   <p className={styles.hint}>Cada pedido adicional genera una comanda nueva. No se confirma envío ni impresión en POS360.</p>
  </section>}
 </main>;
}
