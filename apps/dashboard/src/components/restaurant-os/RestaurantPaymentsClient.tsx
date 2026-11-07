"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import "./restaurant-ops.css";

type Order = {
  id:string;number:number;version:number;customer_name:string;customer_phone:string;
  total_cop:number;payment_status:string;payment_method:string;status:string;
};
type Proof = {
  id: string; order_id: string; source_message_id: string; status: string;
  created_at: string; reviewed_at?: string; reviewed_by?: string;
  rejection_reason?: string; order: Order | null;
  split:{order_id:string;transfer_due_cop:number;cash_due_cop:number;
    transfer_verified_cop:number;cash_collected_cop:number}|null;
};
type BankAccount={
 institution_name:string;holder_name:string;
 account_type:"bank_account"|"virtual_wallet";
 account_number:string|null;alias:string|null;
 instructions:string|null;active:boolean;
};
type PaymentList = { ok:boolean; proofs: Proof[]; error?: string };
const url="/dashboard-api/restaurant-ops/payments";
const money=(v:number)=>new Intl.NumberFormat("es-CO",{
  style:"currency",currency:"COP",maximumFractionDigits:0
}).format(v);

export default function RestaurantPaymentsClient() {
  const [account,setAccount]=useState<BankAccount|null>(null);
  const [institution,setInstitution]=useState("");
  const [holder,setHolder]=useState("");
  const [accountType,setAccountType]=useState<"bank_account"|"virtual_wallet">("bank_account");
  const [accountNumber,setAccountNumber]=useState("");
  const [alias,setAlias]=useState("");
  const [bankNotes,setBankNotes]=useState("");
  const [bankActive,setBankActive]=useState(false);
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

  const loadAccount=useCallback(async()=>{
    try {
      const response=await fetch(url+"/account",{credentials:"same-origin",cache:"no-store"});
      const data=await response.json();
      if(!response.ok||!data.ok)throw new Error(data.error||"ACCOUNT_UNAVAILABLE");
      const a=data.account as BankAccount|null;
      setAccount(a);
      if(a) {
        setInstitution(a.institution_name);setHolder(a.holder_name);
        setAccountType(a.account_type);setAccountNumber(a.account_number??"");
        setAlias(a.alias??"");setBankNotes(a.instructions??"");setBankActive(a.active);
      }
    }catch(e){setError(e instanceof Error?e.message:"No se pudo consultar la cuenta COP");}
  },[]);
  useEffect(()=>{void loadAccount();},[loadAccount]);
  async function saveAccount(event:FormEvent) {
    event.preventDefault();
    if(!accountNumber.trim()&&!alias.trim()) {
      setError("Indicá número de cuenta o alias oficial.");return;
    }
    setBusy("bank");setError("");setNotice("");
    try {
      const response=await fetch(url+"/account",{
        method:"POST",credentials:"same-origin",cache:"no-store",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          institutionName:institution,holderName:holder,accountType,
          accountNumber:accountNumber||null,alias:alias||null,
          instructions:bankNotes||null,active:bankActive
        })
      });
      const data=await response.json();
      if(!response.ok||!data.ok)throw new Error(data.error||"SAVE_ACCOUNT_FAILED");
      setNotice("Cuenta COP guardada. "+(bankActive?
        "El bot podrá enviar estos datos en pedidos por transferencia.":"Sigue inactiva."));
      await loadAccount();
    }catch(e){setError(e instanceof Error?e.message:"No se pudo guardar la cuenta");}
    finally{setBusy(null);}
  }

  async function review(proof:Proof,decision:"approve"|"reject") {
    if(!proof.order)return;
    const number=proof.order.number;
    let reason:string|null=null;
    if(decision==="approve") {
      const confirmed=window.confirm(
        "Pedido #"+number+". ¿Comprobaste en la cuenta bancaria que ingresaron exactamente "+
        money(proof.split?.transfer_due_cop??proof.order.total_cop)+
        "? Una captura NO demuestra que se recibió el dinero."
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
  async function collectSplitCash(proof:Proof) {
    if(!proof.order||!proof.split||proof.order.payment_status!=="cash_on_delivery")return;
    const balance=proof.split.cash_due_cop;
    if(!window.confirm("Pedido #"+proof.order.number+
      ". Confirmá que recibiste físicamente "+money(balance)+
      " COP en efectivo. ¿Registrar recaudo completo?"))return;
    setBusy("cash-"+proof.id);setError("");setNotice("");
    try{
      const response=await fetch(url+"/splits/"+
        encodeURIComponent(proof.order.id)+"/collect-cash",{
          method:"POST",credentials:"same-origin",cache:"no-store",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({version:proof.order.version,amountCOP:balance})
        });
      const result=await response.json();
      if(!response.ok||!result.ok)
        throw new Error(result.error||"SPLIT_CASH_COLLECTION_FAILED");
      setNotice("Pedido #"+proof.order.number+
        ": efectivo registrado y pago dividido conciliado.");
      await refresh();
    }catch(e){setError(e instanceof Error?e.message:"No se registró el efectivo");}
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
        <h2>Cuenta oficial para transferencias · COP</h2>
        <span className={"rops-pill "+(account?.active?"rops-ok":"rops-warning")}>
          {account?.active?"Activa":"No configurada / inactiva"}
        </span>
      </div>
      <p>Estos datos se comparten con clientes que seleccionan transferencia. No uses cuentas personales no autorizadas.</p>
      <form className="rops-mini-form" onSubmit={e=>void saveAccount(e)}>
        <input aria-label="Banco o plataforma de pago" placeholder="Banco / Nequi / Daviplata"
          required minLength={2} value={institution} onChange={e=>setInstitution(e.target.value)}/>
        <input aria-label="Titular de la cuenta" placeholder="Nombre del titular"
          required minLength={2} value={holder} onChange={e=>setHolder(e.target.value)}/>
        <select aria-label="Tipo de cuenta" value={accountType}
          onChange={e=>setAccountType(e.target.value as typeof accountType)}>
          <option value="bank_account">Cuenta bancaria</option>
          <option value="virtual_wallet">Billetera digital</option>
        </select>
        <input aria-label="Número de cuenta" placeholder="Número de cuenta / celular"
          value={accountNumber} onChange={e=>setAccountNumber(e.target.value)}/>
        <input aria-label="Alias o identificación de cobro" placeholder="Alias (opcional)"
          value={alias} onChange={e=>setAlias(e.target.value)}/>
        <textarea aria-label="Instrucciones para pagar" rows={2} placeholder="Instrucciones"
          value={bankNotes} onChange={e=>setBankNotes(e.target.value)}/>
        <label className="rops-check"><input type="checkbox" checked={bankActive}
          onChange={e=>setBankActive(e.target.checked)}/>
          Activar cuenta oficial verificada
        </label>
        <button disabled={busy!==null}>Guardar cuenta COP</button>
      </form>
    </section>
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
            <p><b>Total del pedido:</b> {money(proof.order?.total_cop??0)}</p>
            {proof.split&&<>
              <p><b>Transferencia que debe verificarse:</b> {money(proof.split.transfer_due_cop)}</p>
              <p><b>Efectivo pendiente de recaudo:</b> {money(proof.split.cash_due_cop-proof.split.cash_collected_cop)}</p>
              <p><b>Transferencia comprobada:</b> {money(proof.split.transfer_verified_cop)}</p>
            </>}
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
            {proof.split&&proof.order?.payment_status==="cash_on_delivery" &&
              proof.split.transfer_verified_cop===proof.split.transfer_due_cop &&
              proof.split.cash_collected_cop===0 &&
              <button type="button" disabled={busy!==null}
                onClick={()=>void collectSplitCash(proof)}>
                Registrar efectivo recibido: {money(proof.split.cash_due_cop)}
              </button>}
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
