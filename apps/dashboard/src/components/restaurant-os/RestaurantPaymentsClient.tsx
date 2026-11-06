"use client";

import { useCallback, useEffect, useState } from "react";
import "./restaurant-ops.css";

type Order = {
  number: number; customer_name: string; customer_phone: string;
  total_cop: number; payment_status: string; status: string;
};
type Proof = {
  id: string; order_id: string; source_message_id: string; status: string;
  created_at: string; reviewed_at?: string; reviewed_by?: string;
  rejection_reason?: string; order: Order | null;
};
type PaymentList = { ok:boolean; proofs: Proof[]; error?: string };
const url="/dashboard-api/restaurant-ops/payments";
const money=(v:number)=>new Intl.NumberFormat("es-CO",{
  style:"currency",currency:"COP",maximumFractionDigits:0
}).format(v);

export default function RestaurantPaymentsClient() {
  const [proofs,setProofs]=useState<Proof[]>([]);
  const [filter,setFilter]=useState<"pending_review"|"approved"|"rejected"|"all">("pending_review");
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState<string|null>(null);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const refresh=useCallback(async()=>{
    try {
      const response=await fetch(url+"?status="+filter,{
        credentials:"same-origin",cache:"no-store"
      });
      const result=await response.json() as PaymentList;
      if(!response.ok||!result.ok)throw new Error(result.error||"PAYMENT_QUEUE_UNAVAILABLE");
      setProofs(result.proofs);setError("");
    }catch(e){setError(e instanceof Error?e.message:"Error al consultar pagos");}
    finally{setLoading(false);}
  },[filter]);
  useEffect(()=>{
    void refresh();
    const timer=setInterval(()=>void refresh(),10000);
    return ()=>clearInterval(timer);
  },[refresh]);

  async function review(proof:Proof,decision:"approve"|"reject") {
    if(!proof.order)return;
    const number=proof.order.number;
    let reason:string|null=null;
    if(decision==="approve") {
      const confirmed=window.confirm(
        "Pedido #"+number+". ¿Comprobaste en la cuenta bancaria que ingresaron exactamente "+
        money(proof.order.total_cop)+"? Una captura NO demuestra que se recibió el dinero."
      );
      if(!confirmed)return;
    } else {
      const answer=window.prompt("Motivo de rechazo para el cliente (mínimo 5 caracteres)");
      if(!answer || answer.trim().length<5)return;
      reason=answer.trim();
    }
    setBusy(proof.id);setNotice("");setError("");
    try {
      const result=await fetch(url+"/"+proof.id+"/review",{
        method:"POST",credentials:"same-origin",cache:"no-store",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({decision,...(reason?{reason}:{})})
      });
      const data=await result.json();
      if(!result.ok||!data.ok)throw new Error(data.error||"PAYMENT_REVIEW_FAILED");
      setNotice(decision==="approve"
        ?"Pago del pedido #"+number+" verificado. Comanda liberada a cocina."
        :"Comprobante rechazado. Pedido #"+number+" pendiente de un nuevo comprobante.");
      await refresh();
    }catch(e){setError(e instanceof Error?e.message:"No se pudo revisar el pago");}
    finally{setBusy(null);}
  }
  return <main className="rops">
    <header className="rops-heading">
      <div>
        <span className="rops-eyebrow">DELIBOCADOS / CONTROL FINANCIERO</span>
        <h1>Verificación de transferencias</h1>
        <p>Comprobantes recibidos desde WhatsApp y vinculados a pedidos. Cocina espera la aprobación.</p>
      </div>
      <button type="button" onClick={()=>void refresh()}>Actualizar</button>
    </header>
    {error&&<div className="rops-error" role="alert">{error}</div>}
    {notice&&<div className="rops-notice" role="status">{notice}</div>}
    <section className="rops-card">
      <div className="rops-row">
        <h2>Cola de comprobantes</h2>
        <label>Mostrar
          <select value={filter} onChange={e=>{
            setLoading(true);setFilter(e.target.value as typeof filter);
          }}>
            <option value="pending_review">Pendientes de verificación</option>
            <option value="approved">Aprobados</option>
            <option value="rejected">Rechazados</option>
            <option value="all">Todos</option>
          </select>
        </label>
      </div>
      {loading&&<p className="rops-muted">Consultando comprobantes…</p>}
      {!loading&&proofs.length===0&&
        <p className="rops-empty">No hay comprobantes en esta categoría.</p>}
      <div className="rops-cards">{proofs.map(proof=>
        <article className="rops-order" key={proof.id}>
          <div className="rops-order-head">
            <div><strong>Pedido #{proof.order?.number??"No encontrado"}</strong>
              <small>{proof.order?.customer_name??"Cliente"} · {new Date(proof.created_at).toLocaleString("es-CO")}</small>
            </div>
            <span className={"rops-pill "+(proof.status==="approved"?"rops-ok":
              proof.status==="rejected"?"rops-danger":"rops-warning")}>
              {proof.status==="pending_review"?"Por verificar":
                proof.status==="approved"?"Aprobado":"Rechazado"}
            </span>
          </div>
          <div className="rops-order-body">
            <p><b>Total requerido:</b> {money(proof.order?.total_cop??0)}</p>
            <p><b>Cliente:</b> {proof.order?.customer_phone??"—"}</p>
            <p><b>Pago:</b> {proof.order?.payment_status??"—"}</p>
            <p><b>Documento:</b> recibido por WhatsApp, almacenado en la conversación.</p>
            {proof.rejection_reason&&<p><b>Rechazo:</b> {proof.rejection_reason}</p>}
          </div>
          <div className="rops-actions">
            <a href={"/dashboard-api/messages/"+encodeURIComponent(proof.source_message_id)+"/media"}
              target="_blank" rel="noopener noreferrer">
              Abrir comprobante original
            </a>
            <a href="/panel/operador">Abrir conversación del cliente</a>
            {proof.status==="pending_review"&&proof.order&&<>
              <button type="button" disabled={busy!==null}
                onClick={()=>void review(proof,"approve")}>Aprobar tras comprobar ingreso</button>
              <button type="button" className="rops-danger-btn"
                disabled={busy!==null} onClick={()=>void review(proof,"reject")}>
                Rechazar
              </button>
            </>}
          </div>
        </article>
      )}</div>
    </section>
    <p className="rops-footnote">
      Una captura o PDF no certifica una transferencia. Es obligatorio verificar el ingreso
      y el importe en la entidad bancaria. Cada aprobación o rechazo se registra en la auditoría.
    </p>
  </main>;
}
