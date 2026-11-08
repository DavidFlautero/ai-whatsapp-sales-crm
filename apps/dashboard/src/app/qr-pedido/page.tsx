"use client";
import { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";
type Product={id:string;name:string;category:string;priceCOP:number};
type Context={table:{id:string;label:string};revision:number;products:Product[]};
type Token={kind:"table"|"general";tableId:string;token:string};
type Receipt={id:string;number:number;status:string;paymentStatus:string;totalCOP:number;table:string};
const money=(value:number)=>new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",
  maximumFractionDigits:0}).format(value);
function failure(code:string):string{
 const messages:Record<string,string>={
  QR_CHECKOUT_NOT_ENABLED:"Este canal todavía no está habilitado para recibir pedidos.",
  QR_NOT_AVAILABLE:"QR no disponible o mesa deshabilitada. Pedile ayuda al encargado.",
  QR_RATE_LIMIT:"Demasiadas consultas. Intentá nuevamente más adelante.",
  MENU_NOT_AVAILABLE:"La carta todavía no está disponible.",
  QR_SERVICE_UNAVAILABLE:"El sistema no pudo confirmar la operación.",
  QR_OPERATION_UNAVAILABLE:"No pudimos verificar el registro. Consultá al encargado.",
  BAD_JSON:"Solicitud inválida."
 };
 return messages[code]??"No se pudo completar la operación. Consultá al encargado.";
}
export default function DelibocadosQrCheckoutPage(){
 const [token,setToken]=useState<Token|null>(null);
 const [context,setContext]=useState<Context|null>(null);
 const [cart,setCart]=useState<Record<string,number>>({});
 const [notes,setNotes]=useState<Record<string,string>>({});
 const [name,setName]=useState("");
 const [phone,setPhone]=useState("");
 const [payment,setPayment]=useState<"cash"|"transfer">("cash");
 const [customerNote,setCustomerNote]=useState("");
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [receipt,setReceipt]=useState<Receipt|null>(null);
 const [uncertain,setUncertain]=useState(false);
 const [sourceKey,setSourceKey]=useState("");
 useEffect(()=>{
   const hash=new URLSearchParams(window.location.hash.replace(/^#/,""));
   const kind=hash.get("kind"),tableId=hash.get("tableId"),qrToken=hash.get("token");
   if((kind!=="table"&&kind!=="general")||!tableId||!qrToken){
     setError("Este enlace QR no incluye una mesa válida.");setLoading(false);return;
   }
   const t:Token={kind,tableId,token:qrToken};setToken(t);
   // The browser sends the token in the JSON body, never in URL parameters.
   const load=async()=>{
     try{
       const res=await fetch("/api/delibocados-qr/context",{
         method:"POST",credentials:"omit",cache:"no-store",
         headers:{"Content-Type":"application/json"},body:JSON.stringify(t)
       });
       const payload=await res.json();
       if(!res.ok||!payload.ok)throw new Error(failure(payload.error??"QR_SERVICE_UNAVAILABLE"));
       setContext({table:payload.table,revision:payload.revision,products:payload.products});
       setSourceKey(crypto.randomUUID());
     }catch(e){setError(e instanceof Error?e.message:"No se pudo cargar la carta");}
     finally{setLoading(false);}
   };void load();
 },[]);
 const selected=useMemo(()=>Object.entries(cart).flatMap(([id,quantity])=>{
   const product=context?.products.find(p=>p.id===id);
   return product&&quantity>0?[{...product,quantity}]:[];
 }),[cart,context]);
 const total=selected.reduce((a,p)=>a+p.priceCOP*p.quantity,0);
 const change=(id:string,delta:number)=>{
   if(uncertain||receipt||busy)return;
   setCart(c=>({...c,[id]:Math.max(0,Math.min(25,(c[id]??0)+delta))}));
 };
 const checkout=async()=>{
   if(!token||!context||!sourceKey||busy||uncertain||receipt)return;
   if(!selected.length){setError("Elegí al menos un producto.");return;}
   if(name.trim().length<2||!/^[0-9]{8,15}$/.test(phone)){
     setError("Completá tu nombre y teléfono con indicativo de país.");return;
   }
   setError("");setBusy(true);
   try{
     const response=await fetch("/api/delibocados-qr/order",{
       method:"POST",credentials:"omit",cache:"no-store",
       headers:{"Content-Type":"application/json"},
       body:JSON.stringify({...token,sourceKey,customerName:name.trim(),
         customerPhone:phone,expectedMenuRevision:context.revision,
         items:selected.map(p=>({productId:p.id,quantity:p.quantity,
           instructions:(notes[p.id]??"").slice(0,500)})),
         paymentMethod:payment,customerNote:customerNote.slice(0,2000),
         customerConfirmed:true})
     });
     const payload=await response.json();
     if(!response.ok||!payload.ok){
       const code=payload.error??"QR_OPERATION_UNAVAILABLE";
       if([400,404,413,415,422,429].includes(response.status)){
         setError(failure(code));setBusy(false);return;
       }
       // Unknown network/database outcome: NEVER generate a new sourceKey
       // and retry silently, because the order may already exist.
       setUncertain(true);setError("No pudimos confirmar el resultado. "
         +"No repitas el pedido; consultá con el encargado usando tu teléfono.");
       return;
     }
     setReceipt(payload.order as Receipt);
   }catch{
     setUncertain(true);setError("Conexión interrumpida. El pedido podría estar "
       +"registrado. No lo repitas; consultá al encargado.");
   }finally{setBusy(false);}
 };
 return <main className={styles.page}>
   <header className={styles.hero}><span>DELIBOCADOS · FUNZA</span>
     <h1>Tu pedido en la mesa</h1><p>Elegí tus productos y confirmá con el restaurante.</p>
   </header>
   {loading?<p className={styles.notice}>Cargando carta y verificando mesa…</p>:null}
   {error?<p role="alert" className={styles.error}>{error}</p>:null}
   {receipt?<section className={styles.receipt}>
     <h2>Pedido #{receipt.number} registrado</h2>
     <p>Mesa: {receipt.table}</p><p>Total: {money(receipt.totalCOP)}</p>
     <p>El pedido quedó registrado. Confirmá con el personal si llegó a cocina.</p>
     <p>Estado de pago: {receipt.paymentStatus==="pending"?"Pendiente de verificar":"Cobro pendiente"}</p>
   </section>:null}
   {context&&!receipt?<section className={styles.content}>
     <div className={styles.table}>Mesa verificada: <strong>{context.table.label}</strong></div>
     <section className={styles.catalog}>
       <h2>Carta</h2>
       {context.products.length===0?<p>No hay productos disponibles.</p>:null}
       {context.products.map(p=><article className={styles.product} key={p.id}>
         <div><h3>{p.name}</h3><small>{p.category}</small><p>{money(p.priceCOP)}</p>
           {(cart[p.id]??0)>0?<input aria-label={`Observaciones para ${p.name}`}
             placeholder="Observaciones (opcional)" maxLength={500} value={notes[p.id]??""}
             disabled={uncertain||busy}
             onChange={e=>setNotes(n=>({...n,[p.id]:e.target.value}))}/>:null}
         </div>
         <div className={styles.qty}><button type="button" onClick={()=>change(p.id,-1)}
           disabled={!cart[p.id]||uncertain||busy}>−</button><strong>{cart[p.id]??0}</strong>
           <button type="button" onClick={()=>change(p.id,1)}
             disabled={(cart[p.id]??0)>=25||uncertain||busy}>+</button></div>
       </article>)}
     </section>
     <section className={styles.summary}><h2>Confirmar pedido</h2>
       {selected.map(p=><p key={p.id}>{p.quantity} × {p.name} <b>{money(p.priceCOP*p.quantity)}</b></p>)}
       <div className={styles.total}><strong>Total</strong><strong>{money(total)}</strong></div>
       <label>Nombre<input value={name} onChange={e=>setName(e.target.value)}
         maxLength={120} autoComplete="name" disabled={busy||uncertain}/></label>
       <label>Teléfono con indicativo<input value={phone} onChange={e=>
         setPhone(e.target.value.replace(/\D/g,"").slice(0,15))}
         inputMode="tel" autoComplete="tel" disabled={busy||uncertain}/></label>
       <label>Forma de pago<select value={payment} disabled={busy||uncertain}
         onChange={e=>setPayment(e.target.value as "cash"|"transfer")}>
         <option value="cash">Efectivo pendiente de cobrar</option>
         <option value="transfer">Transferencia por verificar</option>
       </select></label>
       <label>Observaciones generales<textarea value={customerNote}
         onChange={e=>setCustomerNote(e.target.value)}
         maxLength={2000} disabled={busy||uncertain}/></label>
       <button type="button" className={styles.confirm} onClick={()=>void checkout()}
         disabled={!selected.length||busy||uncertain}>
         {busy?"Registrando…":"Confirmar pedido"}
       </button>
       <small>Los precios se verifican nuevamente en el servidor. La transferencia
         no se considera pagada hasta ser revisada.</small>
     </section>
   </section>:null}
 </main>;
}
