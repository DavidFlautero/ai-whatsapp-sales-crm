"use client";

import {useEffect,useMemo,useState} from "react";
import styles from "./CafeMenuView.module.css";

type Product={id:string;name:string;category:string;priceCOP:number;description?:string;imageUrl?:string|null};
type TableChoice={id:string;label:string};
type Account={id:string;openedAt:string;totalCOP:number;truncated:boolean;
 orders:Array<{number:number;status:string;createdAt:string;totalCOP:number;
  items:Array<{name:string;quantity:number;totalCOP:number;instructions:string}>}>};
type MenuContext={table:{id:string;label:string}|null;revision:number;products:Product[];ordersEnabled?:boolean;account?:Account|null};
type Receipt={id:string;number:number;status:string;paymentStatus:string;totalCOP:number;table:string};
type Banner={eyebrow:string;title:string;detail:string};
type Props={
  loading:boolean;error:string;context:MenuContext|null;tables:TableChoice[];receipt:Receipt|null;
  cart:Record<string,number>;notes:Record<string,string>;name:string;phone:string;
  payment:"cash"|"transfer";customerNote:string;busy:boolean;uncertain:boolean;
  onChooseTable:(id:string)=>void;onChangeQty:(id:string,delta:number)=>void;
  onChangeNotes:(id:string,value:string)=>void;onName:(value:string)=>void;onPhone:(value:string)=>void;
  onPayment:(value:"cash"|"transfer")=>void;onCustomerNote:(value:string)=>void;
  onCheckout:()=>void;onRefreshContext:()=>void;onAnotherOrder:()=>void;
};
const money=(value:number)=>new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(value);
const defaultBanners:Banner[]=[
  {eyebrow:"BIENVENIDOS A DELIBOCADOS",title:"Comé rico, disfrutá más",detail:"Elegí tus favoritos de nuestra carta digital."},
  {eyebrow:"ALMUERZOS",title:"El sabor de todos los días",detail:"Consultá en el restaurante el almuerzo disponible hoy."},
  {eyebrow:"SERVICIO",title:"Estamos en Funza",detail:"Seleccioná lo que más te guste y revisá tu pedido."}
];
const categoryIcons:Record<string,string>={
  "ALMUERZOS":"🍽", "HAMBURGUESAS":"🍔", "PERRO CALIENTE":"🌭", "AREPAS RELLENAS":"🫓",
  "A LA CARTA":"🥩", "SALCHIPAPA":"🍟", "PORCIONES":"🥗", "PARA PICAR":"🥟",
  "CALIENTES":"☕", "JUGOS":"🥤", "GASEOSAS":"🧊", "CERVEZAS":"🍺"
};
function safePicture(value?:string|null){
  if(!value)return "";
  if(/^https:\/\/delibocados\.online\/restaurant-menu-media\/[a-f0-9]{32}\.(?:png|jpg|webp)$/i.test(value))return value;
  if(/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value)&&value.length<250000)return value;
  return "";
}
export default function CafeMenuView(props:Props){
  const {context,cart,busy,uncertain,receipt,error,loading}=props;
  const [category,setCategory]=useState("");
  const [search,setSearch]=useState("");
  const [cartOpen,setCartOpen]=useState(false);
  const [slide,setSlide]=useState(0);
  const [banners,setBanners]=useState<Banner[]>(defaultBanners);
  useEffect(()=>{
    let active=true;
    fetch("/api/delibocados-menu-banners",{cache:"no-store"}).then(r=>r.ok?r.json():null)
      .then(data=>{if(active&&Array.isArray(data?.banners)&&data.banners.length)setBanners(data.banners);})
      .catch(()=>{});
    return()=>{active=false;};
  },[]);
  const categories=useMemo(()=>[...new Set((context?.products??[]).map(p=>p.category).filter(Boolean))],[context]);
  const visible=useMemo(()=>{
    const needle=search.trim().toLocaleLowerCase("es-CO");
    return (context?.products??[]).filter(p=>(!category||p.category===category)&&
      (!needle||[p.name,p.description??"",p.category].join(" ").toLocaleLowerCase("es-CO").includes(needle)));
  },[context,category,search]);
  const selected=useMemo(()=>Object.entries(cart).flatMap(([id,quantity])=>{
    const product=context?.products.find(p=>p.id===id);
    return product&&quantity>0?[{...product,quantity}]:[];
  }),[cart,context]);
  const count=selected.reduce((sum,p)=>sum+p.quantity,0);
  const total=selected.reduce((sum,p)=>sum+p.priceCOP*p.quantity,0);
  const ordersEnabled=context?.ordersEnabled===true;
  const hasTable=!!context?.table?.id;
  const canOrder=ordersEnabled&&hasTable&&count>0&&!busy&&!uncertain&&!receipt;
  const banner=banners[slide%banners.length]??defaultBanners[0];
  return <main className={styles.page}>
    <div className={styles.topbar}><span>DELIBOCADOS · FUNZA, CUNDINAMARCA</span><span>Hecho con sabor, servido con cariño</span></div>
    <header className={styles.header}>
      <a href="#inicio" className={styles.brand} aria-label="Delibocados, volver al inicio">
        <img src="https://delibocados.online/delibocados/assets/logo.webp" alt="Delibocados" onError={e=>{e.currentTarget.style.display="none"}}/>
        <span><strong>DELIBOCADOS</strong><small>RESTAURANTE · FUNZA</small></span>
      </a>
      <button type="button" className={styles.headerCart} onClick={()=>setCartOpen(true)}>
        <span aria-hidden="true">🛒</span> Mi pedido <strong>{count}</strong>
      </button>
    </header>
    <div className={styles.container} id="inicio">
      <section className={styles.promo} aria-label="Promociones y novedades">
        <div className={styles.promoText} key={slide}>
          <span className={styles.eyebrow}>{banner.eyebrow}</span>
          <h1>{banner.title}</h1><p>{banner.detail}</p>
          <a href="#carta" className={styles.promoLink}>Explorar la carta <span aria-hidden="true">→</span></a>
        </div>
        <div className={styles.promoVisual} aria-hidden="true"><span>DEL</span><b>IBO</b><span>CADOS</span></div>
        {banners.length>1?<div className={styles.slideControls}>
          <button type="button" aria-label="Promoción anterior" onClick={()=>setSlide(s=>(s-1+banners.length)%banners.length)}>‹</button>
          <span>{slide%banners.length+1} / {banners.length}</span>
          <button type="button" aria-label="Promoción siguiente" onClick={()=>setSlide(s=>(s+1)%banners.length)}>›</button>
        </div>:null}
      </section>
      <div className={styles.serviceStrip}>
        <span>◈ Carta digital</span><span>♨ Preparación al momento</span><span>✦ Precios en pesos colombianos</span>
      </div>
      {loading?<p className={styles.notice} role="status">Cargando productos y verificando el código QR…</p>:null}
      {error?<p className={styles.error} role="alert">{error}</p>:null}
      {!loading&&!context&&!error?<p className={styles.notice}>Escaneá un QR vigente del restaurante para consultar la carta.</p>:null}
      {receipt?<section className={styles.receipt}>
        <div className={styles.receiptCheck}>✓</div><h2>Pedido #{receipt.number} registrado</h2>
        <p>Mesa: <strong>{receipt.table}</strong></p><p>Total: <strong>{money(receipt.totalCOP)}</strong></p>
        <p>Confirmá con el personal que el pedido llegó a cocina.</p>
        <p>{receipt.paymentStatus==="pending"?"Transferencia pendiente de verificar.":"Pago pendiente de cobrar."}</p>
        <button type="button" className={styles.confirm} onClick={props.onAnotherOrder}>
          Ver cuenta de mesa y agregar otro pedido
        </button>
      </section>:null}
      {context&&!receipt?<>
        <section className={styles.menuHeading} id="carta"><div><span>EXPLORÁ NUESTRA CARTA</span><h2>Algo rico para cada momento</h2></div>
          <div className={styles.tableStatus}>{hasTable?<><span className={styles.statusDot}/> Mesa identificada: <strong>{context.table?.label}</strong></>:<>QR general · <strong>Sin mesa asignada</strong></>}</div>
        </section>
        {context.account?<section className={styles.accountCard} aria-label="Cuenta abierta de la mesa">
          <div className={styles.accountHeader}>
            <div><strong>Cuenta abierta · {context.table?.label}</strong>
            <small>Todo lo registrado en esta mesa hasta ahora</small></div>
            <b>{money(context.account.totalCOP)}</b>
          </div>
          {context.account.orders.map(o=><div className={styles.accountOrder} key={o.number}>
            <strong>Comanda #{o.number} · {o.status}</strong>
            {o.items.map((item,index)=><div key={index}>
              <span>{item.quantity} × {item.name}</span><span>{money(item.totalCOP)}</span>
            </div>)}
          </div>)}
          {context.account.truncated?<p>La cuenta tiene muchas comandas: consultá el total completo con el encargado.</p>:null}
          <small>Para agregar algo más, seleccioná productos abajo. Se enviará solo una comanda nueva.</small>
        </section>:null}
        {!hasTable&&props.tables.length>0?<section className={styles.tablePicker}>
          <h3>¿Vas a pedir desde una mesa?</h3>
          <p>Podés explorar toda la carta. Si estás sentado en el local, seleccioná tu mesa antes de confirmar.</p>
          <div className={styles.tableGrid}>{props.tables.map(t=><button type="button" key={t.id} onClick={()=>props.onChooseTable(t.id)}>{t.label}</button>)}</div>
        </section>:null}
        <div className={styles.searchBox}><span aria-hidden="true">⌕</span><input type="search" aria-label="Buscar productos" placeholder="¿Qué se te antoja? Buscá un producto..." value={search} onChange={e=>setSearch(e.target.value)}/></div>
        <nav className={styles.categories} aria-label="Categorías del menú">
          <button type="button" className={!category?styles.active:""} aria-pressed={!category} onClick={()=>setCategory("")}>Todos <small>{context.products.length}</small></button>
          {categories.map(c=><button key={c} type="button" className={category===c?styles.active:""} aria-pressed={category===c} onClick={()=>setCategory(c)}>
            <span aria-hidden="true">{categoryIcons[c]??"✦"}</span> {c.toLocaleLowerCase("es-CO")} <small>{context.products.filter(p=>p.category===c).length}</small>
          </button>)}
        </nav>
        <div className={styles.layout}>
          <section className={styles.catalog} aria-label="Productos">
            <div className={styles.sectionLabel}><h3>{category||"Toda nuestra carta"}</h3><span>{visible.length} productos</span></div>
            {visible.length===0?<div className={styles.empty}>No encontramos productos con esos filtros.</div>:null}
            <div className={styles.productGrid}>{visible.map(p=>{
              const qty=cart[p.id]??0;const img=safePicture(p.imageUrl);
              return <article className={styles.productCard} key={p.id}>
                <div className={styles.productImage}>{img?<img src={img} alt={p.name} loading="lazy"/>:<div className={styles.imageFallback} aria-label="Fotografía no disponible"><span aria-hidden="true">{categoryIcons[p.category]??"🍽"}</span><small>DELIBOCADOS</small></div>}</div>
                <div className={styles.productBody}>
                  <span className={styles.productCategory}>{p.category}</span>
                  <h4>{p.name}</h4>
                  {p.description?<p className={styles.description}>{p.description}</p>:null}
                  <div className={styles.productFooter}><strong>{money(p.priceCOP)}</strong>
                    {qty===0?<button type="button" className={styles.addButton} disabled={busy||uncertain} onClick={()=>props.onChangeQty(p.id,1)} aria-label={`Agregar ${p.name}`}>+ Agregar</button>
                    :<div className={styles.quantity}><button type="button" onClick={()=>props.onChangeQty(p.id,-1)} disabled={busy||uncertain} aria-label={`Quitar una unidad de ${p.name}`}>−</button><b>{qty}</b><button type="button" onClick={()=>props.onChangeQty(p.id,1)} disabled={busy||uncertain||qty>=25} aria-label={`Agregar una unidad de ${p.name}`}>+</button></div>}
                  </div>
                  {qty>0?<input className={styles.productNote} aria-label={`Observaciones para ${p.name}`} placeholder="¿Sin cebolla, alguna indicación?" maxLength={500} value={props.notes[p.id]??""} onChange={e=>props.onChangeNotes(p.id,e.target.value)} disabled={busy||uncertain}/>:null}
                </div>
              </article>;
            })}</div>
          </section>
          <aside className={styles.cartPanel} aria-label="Resumen del pedido">
            <div className={styles.cartTitle}><span>🛒</span><div><h3>Tu pedido</h3><small>{count} {count===1?"producto":"productos"}</small></div></div>
            {selected.length===0?<div className={styles.emptyCart}><span>🛍</span><p>Tu carrito está vacío</p><small>Sumá tus favoritos desde nuestra carta.</small></div>:<div className={styles.cartItems}>{selected.map(p=><div className={styles.cartLine} key={p.id}><span>{p.quantity} × {p.name}</span><b>{money(p.priceCOP*p.quantity)}</b></div>)}</div>}
            <div className={styles.cartTotal}><span>Total estimado</span><strong>{money(total)}</strong></div>
            {hasTable?<div className={styles.cartMesa}>Mesa: <b>{context.table?.label}</b></div>:<div className={styles.cartMesa}>QR general: sin mesa asignada</div>}
            <button type="button" className={styles.cartAction} onClick={()=>setCartOpen(true)} disabled={!count}>Revisar pedido <span>→</span></button>
            <p className={styles.cartDisclaimer}>El total se valida con los precios oficiales del restaurante.</p>
          </aside>
        </div>
      </>:null}
    </div>
    {context&&!receipt&&count>0?<button type="button" className={styles.mobileCart} onClick={()=>setCartOpen(true)}><span>🛒 {count} productos</span><strong>{money(total)}</strong><span>Ver pedido →</span></button>:null}
    {cartOpen&&context&&!receipt?<div className={styles.modalOverlay} role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setCartOpen(false)}}>
      <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="deli-cart-title">
        <div className={styles.modalHeader}><div><small>DELIBOCADOS</small><h2 id="deli-cart-title">Revisá tu pedido</h2></div><button type="button" aria-label="Cerrar carrito" onClick={()=>setCartOpen(false)}>×</button></div>
        <div className={styles.modalBody}>
          {selected.length===0?<p>Tu carrito está vacío.</p>:selected.map(p=><div className={styles.modalLine} key={p.id}><div><strong>{p.name}</strong><small>{p.quantity} × {money(p.priceCOP)}</small></div><b>{money(p.priceCOP*p.quantity)}</b></div>)}
          <div className={styles.modalTotal}><span>Total</span><strong>{money(total)}</strong></div>
          {!hasTable?<div className={styles.checkoutWarning}>Estás viendo el menú general. Para realizar un pedido en mesa, seleccioná una mesa válida desde la carta. No se enviará ningún pedido sin identificarla.</div>:<div className={styles.cartMesa}>Pedido para <strong>{context.table?.label}</strong></div>}
          <div className={styles.formGrid}>
            <label>Tu nombre<input autoComplete="name" value={props.name} maxLength={120} placeholder="Nombre para el pedido" disabled={busy||uncertain} onChange={e=>props.onName(e.target.value)}/></label>
            <label>Celular con indicativo (opcional)<input autoComplete="tel" inputMode="tel" placeholder="57..." value={props.phone} disabled={busy||uncertain} onChange={e=>props.onPhone(e.target.value.replace(/\D/g,"").slice(0,15))}/></label>
            <label>Forma de pago<select value={props.payment} disabled={busy||uncertain} onChange={e=>props.onPayment(e.target.value as "cash"|"transfer")}><option value="cash">Efectivo · pendiente de cobrar</option><option value="transfer">Transferencia · por verificar</option></select></label>
            <label>Observaciones generales<textarea value={props.customerNote} maxLength={2000} placeholder="Alguna indicación para la cocina" disabled={busy||uncertain} onChange={e=>props.onCustomerNote(e.target.value)}/></label>
          </div>
          {!ordersEnabled?<div className={styles.checkoutWarning} role="status">
            <p>La carta está disponible para consultar. Esta mesa todavía no está habilitada para enviar pedidos.</p>
            {hasTable?<button type="button" onClick={props.onRefreshContext} disabled={loading||busy||uncertain}>
              {loading?"Comprobando autorización…":"Comprobar si ya está habilitada"}
            </button>:null}
          </div>:null}
          {uncertain?<p className={styles.checkoutWarning} role="alert">No confirmamos el resultado anterior. Consultá al personal antes de intentar otro pedido.</p>:null}
          {error?<p className={styles.error} role="alert">{error}</p>:null}
        </div>
        <div className={styles.modalFooter}><button type="button" className={styles.confirm} disabled={!canOrder} onClick={props.onCheckout}>{busy?"Registrando…":!hasTable?"Seleccioná tu mesa":!ordersEnabled?"Pedidos QR aún no habilitados":!count?"Agregá un producto":"Confirmar pedido"}</button><small>Los cobros por transferencia se verifican antes de marcarse como pagados.</small></div>
      </section>
    </div>:null}
    <footer className={styles.footer}>© Delibocados · Funza · Tu carta digital</footer>
  </main>;
}
