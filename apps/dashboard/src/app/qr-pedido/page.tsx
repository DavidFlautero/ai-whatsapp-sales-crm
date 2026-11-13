"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";

type Product = {
  id:string; name:string; category:string; description:string;
  priceCOP:number; imageUrl?:string|null;
};
type Category = {name:string;label:string};
type Context = {
  table:{id:string;label:string};
  revision:number; products:Product[]; categories:Category[];
  ordersEnabled:boolean;
};
type QrIdentity = {kind:"table"|"general";tableId?:string;token:string};
type TableChoice = {id:string;label:string};
type Receipt = {id:string;number:number;status:string;paymentStatus:string;totalCOP:number;table:string};
type Cart = Record<string,number>;
type PanelError = {ok?:boolean;error?:string};
const peso = (n:number) => new Intl.NumberFormat("es-CO",{
  style:"currency",currency:"COP",maximumFractionDigits:0
}).format(n);

const errors:Record<string,string> = {
  QR_CHECKOUT_NOT_ENABLED:"Los pedidos por QR aún no están habilitados.",
  QR_NOT_ENABLED_FOR_TABLE:"Esta mesa todavía no está habilitada para pedidos.",
  QR_GENERAL_DISABLED_DURING_PILOT:"El QR general aún no está habilitado.",
  QR_NOT_AVAILABLE:"Este código QR no es válido o fue renovado. Pedí uno actualizado.",
  QR_RATE_LIMIT:"Demasiados intentos. Volvé a probar dentro de un minuto.",
  MENU_NOT_AVAILABLE:"El menú no está publicado en este momento.",
  QR_SERVICE_UNAVAILABLE:"No hay conexión con el servicio del restaurante.",
  QR_OPERATION_UNAVAILABLE:"No pudimos confirmar el registro del pedido.",
  ORIGIN_DENIED:"No se pudo verificar la conexión con el dominio.",
  INVALID_INPUT:"Revisá los datos del pedido.",
  JSON_REQUIRED:"Formato de solicitud incorrecto.",
  QR_ORDER_UNVERIFIED:"No se pudo verificar el pedido.",
  QR_ORDER_FAILED:"No se pudo registrar el pedido.",
  BAD_QR_UPSTREAM:"El servidor devolvió una respuesta incompatible.",
  MENU_REVISION_CHANGED:"El menú se actualizó. Recargá para revisar los precios.",
  BAD_JSON:"Datos enviados incorrectamente."
};
const message = (code:string) => errors[code] || "No se pudo completar la operación ("+code+").";
function safeParse(value:string):PanelError{
  try{return JSON.parse(value) as PanelError;}catch{return {ok:false,error:"QR_SERVICE_UNAVAILABLE"};}
}

export default function DelibocadosQrCheckoutPage(){
  const [qr,setQr]=useState<QrIdentity|null>(null);
  const [context,setContext]=useState<Context|null>(null);
  const [tableChoices,setTableChoices]=useState<TableChoice[]>([]);
  const [cart,setCart]=useState<Cart>({});
  const [notes,setNotes]=useState<Record<string,string>>({});
  const [query,setQuery]=useState("");
  const [category,setCategory]=useState("all");
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
  const [restored,setRestored]=useState(false);
  const [cartOpen,setCartOpen]=useState(false);
  const [review,setReview]=useState(false);

  async function fetchJson<T>(path:string,body:unknown):Promise<T>{
    const response=await fetch(path,{
      method:"POST",credentials:"omit",cache:"no-store",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(body)
    });
    const payload=safeParse(await response.text());
    if(!response.ok||!payload.ok)
      throw new Error(message(payload.error||"QR_SERVICE_UNAVAILABLE"));
    return payload as T;
  }
  async function loadContext(identity:QrIdentity){
    if(!identity.tableId){setError("Seleccioná tu mesa.");setLoading(false);return;}
    setError("");setLoading(true);setContext(null);setRestored(false);
    try{
      const result=await fetchJson<Context & {ok:boolean}>(
        "/api/delibocados-qr/context",identity
      );
      if(!result.table || !Array.isArray(result.products) ||
         !Number.isSafeInteger(result.revision))throw new Error("El catálogo llegó incompleto.");
      setContext({...result,
        products:result.products.filter(p=>p&&typeof p.id==="string"&&
          typeof p.name==="string"&&Number.isSafeInteger(p.priceCOP)&&
          p.priceCOP>=0),
        categories:Array.isArray(result.categories)?result.categories:[],
        ordersEnabled:result.ordersEnabled===true
      });
    }catch(e){setError(e instanceof Error?e.message:"No se pudo cargar la carta.");}
    finally{setLoading(false);}
  }

  useEffect(()=>{
    const hash=new URLSearchParams(window.location.hash.slice(1));
    const kind=hash.get("kind"),tableId=hash.get("tableId"),token=hash.get("token");
    if((kind!=="table"&&kind!=="general")||!token||
       (kind==="table"&&!tableId)){
      setError("Este enlace no identifica una mesa. Escaneá el QR del restaurante.");
      setLoading(false);return;
    }
    const identity:QrIdentity={kind,tableId:tableId||undefined,token};
    setQr(identity);
    if(kind==="general"&&!tableId){
      void (async()=>{
        try{
          const result=await fetchJson<{ok:boolean;tables:TableChoice[]}>(
            "/api/delibocados-qr/tables",{kind:"general",token}
          );
          setTableChoices(result.tables||[]);
          if(!result.tables?.length)setError("No encontramos mesas disponibles.");
        }catch(e){setError(e instanceof Error?e.message:"Error al consultar las mesas.");}
        finally{setLoading(false);}
      })();
    }else void loadContext(identity);
  },[]);

  const cartKey=context?.table?.id?"deli-qr-cart-v2:"+context.table.id:"";
  useEffect(()=>{
    if(!cartKey||!context||restored)return;
    try{
      const previous=window.sessionStorage.getItem(cartKey);
      if(previous){
        const parsed=JSON.parse(previous) as Record<string,unknown>;
        const allowed=new Set(context.products.map(p=>p.id));
        const result:Cart={};
        for(const [id,qty] of Object.entries(parsed))
          if(allowed.has(id)&&Number.isInteger(qty)&&Number(qty)>0)
            result[id]=Math.min(25,Number(qty));
        setCart(result);
      }
      const saved=window.sessionStorage.getItem(cartKey+":key");
      if(saved && /^[a-f0-9-]{36}$/.test(saved))setSourceKey(saved);
      else{
        const fresh=crypto.randomUUID();
        setSourceKey(fresh);
        window.sessionStorage.setItem(cartKey+":key",fresh);
      }
    }catch{
      const fresh=crypto.randomUUID();setSourceKey(fresh);
      window.sessionStorage.setItem(cartKey+":key",fresh);
    }finally{setRestored(true);}
  },[cartKey,context,restored]);
  useEffect(()=>{
    if(restored&&cartKey&&!receipt)
      window.sessionStorage.setItem(cartKey,JSON.stringify(cart));
  },[cart,cartKey,receipt,restored]);

  const categories=useMemo(()=>{
    if(!context)return [];
    const distinct=Array.from(new Set(context.products.map(p=>p.category||"Otros")));
    const ordered=context.categories
      .filter(c=>distinct.includes(c.name))
      .map(c=>({name:c.name,label:c.label||c.name}));
    for(const c of distinct)if(!ordered.some(x=>x.name===c))
      ordered.push({name:c,label:c});
    return ordered;
  },[context]);

  const visible=useMemo(()=>{
    if(!context)return [];
    const search=query.trim().toLocaleLowerCase("es-CO");
    return context.products.filter(p=>
      (category==="all"||(p.category||"Otros")===category)&&
      (!search||(p.name+" "+p.description+" "+p.category)
        .toLocaleLowerCase("es-CO").includes(search)));
  },[context,category,query]);
  const selected=useMemo(()=>
    (context?.products||[]).filter(p=>(cart[p.id]||0)>0)
      .map(p=>({...p,quantity:cart[p.id]}))
  ,[cart,context]);
  const total=selected.reduce((sum,p)=>sum+p.priceCOP*p.quantity,0);
  const units=selected.reduce((sum,p)=>sum+p.quantity,0);

  function change(id:string,amount:number){
    if(busy||receipt||uncertain)return;
    setCart(previous=>{
      const quantity=Math.max(0,Math.min(25,(previous[id]||0)+amount));
      const result={...previous};
      if(quantity===0)delete result[id];else result[id]=quantity;
      return result;
    });
    setError("");
  }
  function chooseTable(id:string){
    if(!qr||qr.kind!=="general")return;
    const next={...qr,tableId:id};
    setQr(next);setTableChoices([]);setCart({});setNotes({});
    setCategory("all");setQuery("");setCartOpen(false);
    void loadContext(next);
  }
  async function checkout(){
    if(!qr?.tableId||!context||!sourceKey||busy||uncertain||receipt||
       !context.ordersEnabled)return;
    if(!selected.length){setError("Agregá al menos un producto.");return;}
    if(name.trim().length<2||!(/^[0-9]{8,15}$/).test(phone)){
      setError("Completá tu nombre y teléfono con indicativo de país.");return;
    }
    setBusy(true);setError("");
    try{
      const response=await fetch("/api/delibocados-qr/order",{
        method:"POST",credentials:"omit",cache:"no-store",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({...qr,sourceKey,customerName:name.trim(),
          customerPhone:phone,expectedMenuRevision:context.revision,
          items:selected.map(p=>({
            productId:p.id,quantity:p.quantity,
            instructions:(notes[p.id]||"").slice(0,500)
          })),
          paymentMethod:payment,customerNote:customerNote.slice(0,2000),
          customerConfirmed:true})
      });
      const payload=safeParse(await response.text()) as PanelError&{order?:Receipt};
      if(!response.ok||!payload.ok){
        const code=payload.error||"QR_OPERATION_UNAVAILABLE";
        // Only explicit pre-write rejections can safely be retried/edited.
        if([400,404,413,415,422,429].includes(response.status)||
           (response.status===503&&
             ["QR_CHECKOUT_NOT_ENABLED","QR_NOT_ENABLED_FOR_TABLE","MENU_NOT_AVAILABLE"]
               .includes(code))){
          setError(message(code));return;
        }
        setUncertain(true);
        setError("No podemos confirmar si el restaurante registró este pedido. No lo repitas: consultá con el encargado.");
        return;
      }
      if(!payload.order?.id)throw new Error("RESPONSE_UNCERTAIN");
      setReceipt(payload.order);setCartOpen(false);setReview(false);
      if(cartKey){
        window.sessionStorage.removeItem(cartKey);
        window.sessionStorage.removeItem(cartKey+":key");
      }
    }catch{
      setUncertain(true);
      setError("Se perdió la confirmación. El pedido podría estar registrado. No lo repitas: consultá con el encargado.");
    }finally{setBusy(false);}
  }

  return <main className={styles.page}>
    <header className={styles.topbar}>
      <div className={styles.identity}>
        <img src="https://delibocados.online/delibocados/assets/logo.webp"
          alt="Delibocados" className={styles.logo}/>
        <div><strong>Delibocados</strong><small>Funza · Hecho con sabor</small></div>
      </div>
      <div className={styles.topRight}>
        {context?<span className={styles.tablePill}>{context.table.label}</span>:null}
        {units>0&&context&&!receipt?
          <button type="button" className={styles.cartTop}
            onClick={()=>setCartOpen(true)} aria-label={"Abrir carrito con "+units+" productos"}>
            Ver carrito <b>{units}</b>
          </button>:null}
      </div>
    </header>

    <section className={styles.hero}>
      <div className={styles.heroCopy}>
        <span>LA CARTA DE DELIBOCADOS</span>
        <h1>Todo lo rico, directo a tu mesa.</h1>
        <p>Elegí lo que se te antoje, armá tu carrito y revisá tu pedido antes de enviarlo.</p>
        {context?<div className={styles.heroTable}>Mesa confirmada <strong>{context.table.label}</strong></div>:null}
      </div>
      <div className={styles.heroOrnament} aria-hidden="true">
        <span>Delibocados</span><strong>¡Buen provecho!</strong>
      </div>
    </section>

    {loading?<div className={styles.loading} role="status">Cargando productos y verificando tu mesa…</div>:null}
    {error?<div className={styles.error} role="alert">{error}</div>:null}
    {!loading&&!context&&error?
      <button type="button" className={styles.retry}
        onClick={()=>qr?.tableId&&void loadContext(qr)}>Volver a intentar</button>:null}
    {tableChoices.length>0&&!context?
      <section className={styles.chooseTable}>
        <h2>¿En qué mesa estás?</h2><p>Seleccioná la mesa indicada en el restaurante.</p>
        <div className={styles.tableGrid}>
          {tableChoices.map(t=><button type="button" key={t.id}
            onClick={()=>chooseTable(t.id)}>{t.label}</button>)}
        </div>
      </section>:null}

    {receipt?<section className={styles.success}>
      <span className={styles.successSymbol} aria-hidden="true">✓</span>
      <h2>Pedido #{receipt.number} registrado</h2>
      <p>Recibimos tu pedido para <strong>{receipt.table}</strong>.</p>
      <div className={styles.receiptDetails}>
        <p><span>Total</span><strong>{peso(receipt.totalCOP)}</strong></p>
        <p><span>Estado</span><strong>Registrado en Neuromind</strong></p>
        <p><span>Pago</span><strong>{receipt.paymentStatus==="pending"?
          "Transferencia pendiente de verificar":"Cobro pendiente"}</strong></p>
      </div>
      <p className={styles.receiptNote}>El registro interno no confirma impresión en POS360.
        El personal puede consultar el ticket en el panel de cocina.</p>
      <button type="button" className={styles.retry} onClick={()=>window.location.reload()}>
        Volver a ver la carta
      </button>
    </section>:null}

    {context&&!receipt?<div className={styles.layout}>
      <section className={styles.menuArea}>
        {!context.ordersEnabled?
          <div className={styles.preview} role="status">
            <strong>Carta en modo prueba</strong>
            <span>Podés explorar y armar tu carrito. El envío a cocina todavía está desactivado.</span>
          </div>:null}
        <div className={styles.menuHeading}>
          <div><span className={styles.eyebrow}>CONOCÉ NUESTRA CARTA</span>
            <h2>¿Qué vas a pedir hoy?</h2>
            <p>{context.products.length} productos disponibles</p>
          </div>
          <label className={styles.searchLabel}>
            <span>Buscar producto</span>
            <input type="search" placeholder="Hamburguesa, jugo, almuerzo…"
              value={query} onChange={e=>setQuery(e.target.value)}
              aria-label="Buscar productos"/>
          </label>
        </div>

        <nav className={styles.categories} aria-label="Categorías de la carta">
          <button type="button" className={category==="all"?styles.activeCategory:""}
            onClick={()=>setCategory("all")}>Todo el menú</button>
          {categories.map(c=><button key={c.name} type="button"
            className={category===c.name?styles.activeCategory:""}
            onClick={()=>setCategory(c.name)}>{c.label}</button>)}
        </nav>

        {visible.length?
          <div className={styles.products}>
            {visible.map(p=><article className={styles.product} key={p.id}>
              <div className={styles.photo}>
                {p.imageUrl?<img src={p.imageUrl} loading="lazy" alt={p.name}/>:<div
                  className={styles.photoFallback} aria-hidden="true">D</div>}
              </div>
              <div className={styles.productBody}>
                <span className={styles.productCategory}>{p.category||"Delibocados"}</span>
                <h3>{p.name}</h3>
                {p.description?<p className={styles.description}>{p.description}</p>:null}
                <div className={styles.productBottom}>
                  <strong>{peso(p.priceCOP)}</strong>
                  {(cart[p.id]||0)>0?
                    <div className={styles.quantity}>
                      <button type="button" onClick={()=>change(p.id,-1)}
                        aria-label={"Quitar una unidad de "+p.name}>−</button>
                      <span>{cart[p.id]}</span>
                      <button type="button" onClick={()=>change(p.id,1)}
                        disabled={cart[p.id]>=25}
                        aria-label={"Agregar una unidad de "+p.name}>+</button>
                    </div>:
                    <button type="button" className={styles.add}
                      onClick={()=>change(p.id,1)}
                      aria-label={"Agregar "+p.name+" al carrito"}>Agregar +</button>}
                </div>
              </div>
            </article>)}
          </div>:
          <div className={styles.emptyResults}>No encontramos productos con ese nombre.
            <button type="button" onClick={()=>{setQuery("");setCategory("all");}}>
              Mostrar toda la carta
            </button>
          </div>}
      </section>

      {cartOpen?<button type="button" className={styles.backdrop}
        aria-label="Cerrar carrito" onClick={()=>setCartOpen(false)}/>:null}
      <aside className={[styles.cartPanel,cartOpen?styles.cartOpen:""].join(" ")}
        aria-label="Tu carrito">
        <div className={styles.cartHead}>
          <div><span className={styles.eyebrow}>TU PEDIDO</span>
            <h2>Mi carrito <small>{units} {units===1?"producto":"productos"}</small></h2>
          </div>
          <button type="button" className={styles.closeCart}
            onClick={()=>setCartOpen(false)} aria-label="Cerrar carrito">×</button>
        </div>
        <div className={styles.cartContent}>
          {selected.length===0?<div className={styles.emptyCart}>
            <div className={styles.emptyArt} aria-hidden="true">+</div>
            <strong>Tu carrito está vacío</strong>
            <p>Agregá tus favoritos de la carta y los verás acá.</p>
          </div>:<>
            <div className={styles.cartList}>
              {selected.map(p=><div key={p.id} className={styles.cartItem}>
                <div className={styles.cartItemTitle}><strong>{p.name}</strong>
                  <strong>{peso(p.priceCOP*p.quantity)}</strong></div>
                <div className={styles.cartLine}>
                  <span>{peso(p.priceCOP)} c/u</span>
                  <div className={styles.quantity}>
                    <button type="button" onClick={()=>change(p.id,-1)}
                      aria-label={"Quitar "+p.name}>−</button>
                    <span>{p.quantity}</span>
                    <button type="button" onClick={()=>change(p.id,1)}
                      aria-label={"Sumar "+p.name} disabled={p.quantity>=25}>+</button>
                  </div>
                </div>
                <input className={styles.itemNote} value={notes[p.id]||""}
                  placeholder="Sin cebolla, poco picante…"
                  aria-label={"Observaciones para "+p.name}
                  maxLength={500} onChange={e=>setNotes(n=>({...n,[p.id]:e.target.value}))}/>
              </div>)}
            </div>
            <div className={styles.orderTotal}>
              <div><span>Subtotal</span><strong>{peso(total)}</strong></div>
              <div><span>Servicio en mesa</span><strong>{peso(0)}</strong></div>
              <div className={styles.grandTotal}><span>Total</span><strong>{peso(total)}</strong></div>
            </div>
            {review?<form className={styles.checkoutForm}
              onSubmit={e=>{e.preventDefault();void checkout();}}>
              <h3>Confirmá tus datos</h3>
              <label>Nombre<input required minLength={2} maxLength={120}
                value={name} autoComplete="name"
                onChange={e=>setName(e.target.value)}/></label>
              <label>WhatsApp con indicativo<input required inputMode="tel" type="tel"
                placeholder="573001234567" minLength={8} maxLength={15}
                value={phone} autoComplete="tel"
                onChange={e=>setPhone(e.target.value.replace(/\D/g,"").slice(0,15))}/></label>
              <label>Medio de pago<select value={payment}
                onChange={e=>setPayment(e.target.value as "cash"|"transfer")}>
                <option value="cash">Efectivo en el restaurante</option>
                <option value="transfer">Transferencia (por verificar)</option>
              </select></label>
              <label>Observaciones del pedido<textarea maxLength={2000}
                value={customerNote} placeholder="¿Algo que debamos saber?"
                onChange={e=>setCustomerNote(e.target.value)}/></label>
              <button type="submit" className={styles.confirm}
                disabled={!context.ordersEnabled||busy||uncertain}>
                {busy?"Registrando pedido…":context.ordersEnabled?
                  "Confirmar y enviar pedido":"Envío desactivado durante la prueba"}
              </button>
              <small>Al confirmar se registrará el pedido en Neuromind. El pago por
                transferencia quedará pendiente de comprobación.</small>
            </form>:<button className={styles.confirm} type="button"
              onClick={()=>setReview(true)}>
              Revisar pedido · {peso(total)}
            </button>}
          </>}
        </div>
        <div className={styles.cartFooter}>
          <span>{context.table.label} · Delibocados Funza</span>
          {review?<button type="button" onClick={()=>setReview(false)}>← Seguir comprando</button>:null}
        </div>
      </aside>
    </div>:null}
    {context&&units>0&&!receipt?<button type="button"
      className={styles.mobileBar} onClick={()=>setCartOpen(true)}>
      <span><b>{units}</b> Ver mi carrito</span><strong>{peso(total)}</strong>
    </button>:null}
  </main>;
}
