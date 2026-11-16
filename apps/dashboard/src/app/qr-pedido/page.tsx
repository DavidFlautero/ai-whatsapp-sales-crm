"use client";
import { useEffect, useMemo, useState } from "react";
import CafeMenuView from "./CafeMenuView";
type Product={id:string;name:string;category:string;priceCOP:number;description?:string;imageUrl?:string|null};
type Context={table:{id:string;label:string}|null;revision:number;products:Product[];ordersEnabled?:boolean};
type Token={kind:"table"|"general";tableId?:string;token:string};
type TableChoice={id:string;label:string};
type Receipt={id:string;number:number;status:string;paymentStatus:string;totalCOP:number;table:string};
function failure(code:string):string{
 const messages:Record<string,string>={
  QR_CHECKOUT_NOT_ENABLED:"Este canal todavía no está habilitado para recibir pedidos.",
  QR_NOT_ENABLED_FOR_TABLE:"Esta mesa todavía no está habilitada para pedidos. Estamos realizando pruebas controladas.",
  QR_GENERAL_DISABLED_DURING_PILOT:"El QR general no está disponible durante las pruebas.",
  QR_NOT_AVAILABLE:"QR no disponible o mesa deshabilitada. Pedile ayuda al encargado.",
  QR_RATE_LIMIT:"Demasiadas consultas. Intentá nuevamente más adelante.",
  MENU_NOT_AVAILABLE:"La carta todavía no está disponible.",
  QR_SERVICE_UNAVAILABLE:"El sistema no pudo confirmar la operación.",
  QR_OPERATION_UNAVAILABLE:"No pudimos verificar el registro. Consultá al encargado.",
  ORIGIN_DENIED:"La conexión del checkout fue rechazada por una configuración del dominio.",
  INVALID_INPUT:"Los datos del código QR no tienen el formato esperado.",
  JSON_REQUIRED:"El servidor requiere una solicitud JSON.",
  QR_ORDER_UNVERIFIED:"El servidor no pudo confirmar este pedido.",
  BAD_QR_UPSTREAM:"La conexión del panel con el servicio QR devolvió una respuesta incompatible.",
  BAD_JSON:"Solicitud inválida."
 };
 return messages[code]??"No se pudo completar la operación. Consultá al encargado.";
}
export default function DelibocadosQrCheckoutPage(){
 const [token,setToken]=useState<Token|null>(null);
 const [context,setContext]=useState<Context|null>(null);
 const [tables,setTables]=useState<TableChoice[]>([]);
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
 const loadContext=async(t:Token)=>{
   if(!t.tableId){setError("Seleccioná una mesa.");setLoading(false);return;}
   try{
     const res=await fetch("/api/delibocados-qr/context",{
       method:"POST",credentials:"omit",cache:"no-store",
       headers:{"Content-Type":"application/json"},body:JSON.stringify(t)
     });
     const payload=await res.json();
     if(!res.ok||!payload.ok)throw new Error(failure(payload.error??"QR_SERVICE_UNAVAILABLE") + (payload.error?" ("+payload.error+")":""));
     setContext({table:payload.table,revision:payload.revision,products:payload.products,ordersEnabled:payload.ordersEnabled===true});
     setSourceKey(crypto.randomUUID());
   }catch(e){setError(e instanceof Error?e.message:"No se pudo cargar la carta");}
   finally{setLoading(false);}
 };
 useEffect(()=>{
   const hash=new URLSearchParams(window.location.hash.replace(/^#/,""));
   const kind=hash.get("kind"),tableId=hash.get("tableId"),qrToken=hash.get("token");
   if((kind!=="table"&&kind!=="general")||!qrToken||
     (kind==="table"&&!tableId)){
     setError("Este enlace QR no incluye los datos necesarios.");setLoading(false);return;
   }
   const t:Token={kind,tableId:tableId??undefined,token:qrToken};setToken(t);
   if(t.kind==="general"&&!t.tableId){
     const loadTables=async()=>{
       try{
         const res=await fetch("/api/delibocados-qr/tables",{
           method:"POST",credentials:"omit",cache:"no-store",
           headers:{"Content-Type":"application/json"},
           body:JSON.stringify({kind:"general",token:t.token})
         });
         const payload=await res.json();
         if(!res.ok||!payload.ok)throw new Error(failure(payload.error??"QR_SERVICE_UNAVAILABLE"));
         if(!Array.isArray(payload.tables)||!Array.isArray(payload.products)||!Number.isInteger(payload.revision))
           throw new Error("El menú general devolvió datos incompletos.");
         setTables(payload.tables);
         setContext({table:null,revision:payload.revision,products:payload.products,ordersEnabled:false});
       }catch(e){setError(e instanceof Error?e.message:"No se pudieron cargar las mesas");}
       finally{setLoading(false);}
     };void loadTables();
   }else void loadContext(t);
 },[]);
 const chooseTable=(id:string)=>{
   if(!token||token.kind!=="general")return;
   const chosen={...token,tableId:id};
   setToken(chosen);setTables([]);setError("");setLoading(true);
   void loadContext(chosen);
 };
 const selected=useMemo(()=>Object.entries(cart).flatMap(([id,quantity])=>{
   const product=context?.products.find(p=>p.id===id);
   return product&&quantity>0?[{...product,quantity}]:[];
 }),[cart,context]);
 const change=(id:string,delta:number)=>{
   if(uncertain||receipt||busy)return;
   setCart(c=>({...c,[id]:Math.max(0,Math.min(25,(c[id]??0)+delta))}));
 };
 const checkout=async()=>{
   if(!token?.tableId||!context||!context.ordersEnabled||!sourceKey||busy||uncertain||receipt)return;
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
 return <CafeMenuView
   loading={loading} error={error} context={context} tables={tables} receipt={receipt}
   cart={cart} notes={notes} name={name} phone={phone} payment={payment}
   customerNote={customerNote} busy={busy} uncertain={uncertain}
   onChooseTable={chooseTable} onChangeQty={change}
   onChangeNotes={(id,value)=>setNotes(n=>({...n,[id]:value}))}
   onName={setName} onPhone={setPhone} onPayment={setPayment}
   onCustomerNote={setCustomerNote} onCheckout={()=>void checkout()}
 />;
}