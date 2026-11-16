"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "./mesas-pedidos.module.css";

type Table = { id: string; label: string; enabled: boolean };
type Item = { id: string; product_name: string; quantity: number; line_total_cop: number; instructions?: string };
type Order = {
 id: string; number: number; qr_table_id?: string | null; fulfillment_mode: string;
 status: string; payment_status: string; customer_name: string;
 total_cop: number; created_at: string; restaurant_ops_order_items?: Item[];
};
type Response = { ok: boolean; tables?: Table[]; orders?: Order[]; error?: string };
const money = (n: number) => new Intl.NumberFormat("es-CO", {
 style:"currency", currency:"COP", maximumFractionDigits:0
}).format(n);
const statusLabel: Record<string,string> = {
 confirmed:"Pedido nuevo", preparing:"En cocina", ready:"Listo para servir",
 completed:"Entregado", cancelled:"Cancelado", out_for_delivery:"En reparto"
};
export default function MesasPedidosClient() {
 const [tables,setTables]=useState<Table[]>([]);
 const [orders,setOrders]=useState<Order[]>([]);
 const [error,setError]=useState("");
 const [loading,setLoading]=useState(true);
 const [refreshed,setRefreshed]=useState("");
 const load=useCallback(async()=>{
  try{
   const r=await fetch("/dashboard-api/restaurant-ops/orders/tables",{credentials:"same-origin",cache:"no-store"});
   const data=await r.json() as Response;
   if(!r.ok||!data.ok||!Array.isArray(data.tables)||!Array.isArray(data.orders))
    throw new Error(data.error||"No se pudo consultar el panel de mesas");
   setTables(data.tables);setOrders(data.orders);setError("");setRefreshed(new Date().toLocaleTimeString("es-CO"));
  }catch(e){setError(e instanceof Error?e.message:"Error consultando mesas");}
  finally{setLoading(false);}
 },[]);
 useEffect(()=>{void load();const timer=setInterval(()=>void load(),10000);return()=>clearInterval(timer);},[load]);
 const grouped=useMemo(()=>{
  const lookup=new Map<string,Order[]>();
  for(const o of orders){if(o.fulfillment_mode!=="dine_in"||!o.qr_table_id)continue;
   const existing=lookup.get(o.qr_table_id)||[];existing.push(o);lookup.set(o.qr_table_id,existing);
  }return lookup;
 },[orders]);
 return <main className={styles.page}>
  <header className={styles.header}><div><span>DELIBOCADOS / CENTRO DE OPERACIONES</span>
   <h1>Mesas y pedidos</h1><p>Los pedidos se agrupan por la mesa registrada en la base de datos, no por el texto que escribió el cliente.</p></div>
   <div className={styles.actions}><button type="button" onClick={()=>void load()}>Actualizar</button>
    <Link href="/panel/pedidos">Todos los pedidos</Link><Link href="/panel/cocina">Cocina</Link>
    <Link href="/panel/reparto">Domicilios</Link></div>
  </header>
  {error&&<div className={styles.error} role="alert">{error}</div>}
  {loading&&<p>Cargando mesas…</p>}
  {!loading&&<p className={styles.hint}>{tables.length} mesas · {orders.filter(o=>o.fulfillment_mode==="dine_in"&&!['completed','cancelled'].includes(o.status)).length} pedidos activos · Actualizado {refreshed}</p>}
  <section className={styles.grid} aria-label="Mesas registradas">
   {tables.map(t=>{
    const records=grouped.get(t.id)||[];
    const active=records.filter(o=>!['completed','cancelled'].includes(o.status));
    return <article className={styles.table} key={t.id}>
     <div className={styles.tableHeader}><h2>{t.label}</h2><span className={active.length?styles.occupied:styles.free}>{active.length?`${active.length} pedido(s) activo(s)`:"Sin pedidos"}</span></div>
     {!t.enabled&&<p className={styles.hint}>Mesa deshabilitada para nuevos pedidos.</p>}
     {active.length===0?<p className={styles.muted}>Todavía no hay pedidos activos.</p>:active.map(o=><div className={styles.order} key={o.id}>
      <div className={styles.orderHeader}><strong>Pedido #{o.number}</strong><span>{statusLabel[o.status]||o.status}</span></div>
      <small>{o.customer_name} · {new Date(o.created_at).toLocaleTimeString("es-CO",{hour:"2-digit",minute:"2-digit"})}</small>
      {(o.restaurant_ops_order_items||[]).map(i=><div className={styles.item} key={i.id}>
       <span>{i.quantity} × {i.product_name}{i.instructions?<em> · {i.instructions}</em>:null}</span>
       <span>{money(i.line_total_cop)}</span>
      </div>)}
      <div className={styles.sum}><strong>{money(o.total_cop)}</strong><small>Pago: {o.payment_status}</small></div>
      <div className={styles.warn}>El registro interno no confirma impresión en POS360.</div>
     </div>)}
    </article>;
   })}
  </section>
 </main>;
}
