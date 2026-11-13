/*
 * Delibocados — checkout integrated in the ORIGINAL cafe cart.
 * Replaces legacy script deli-qr-checkout-v1; it does not create another form.
 * Physical POS/printing is not claimed. Prices always come from the backend.
 */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const submit = $("deli-qr-submit");
  const message = $("deli-qr-message");
  const name = $("customer");
  const phone = $("phone");
  const table = $("table");
  const address = $("address");
  const neighborhood = $("neighborhood");
  const note = $("note");
  const payment = $("deli-qr-payment");
  const confirmField = $("deli-qr-confirm-field");
  const confirm = $("deli-qr-confirm");
  if (!submit || !message || !name || !phone || !confirm) {
    console.error("[Delibocados checkout] No se encontraron campos originales");
    return;
  }
  const qs = new URLSearchParams(location.search);
  const hs = new URLSearchParams(location.hash.replace(/^#/, ""));
  const token = hs.get("kind") === "table" ? (hs.get("token") || "") : (qs.get("mesa") || "");
  const secureTableId = hs.get("kind") === "table" ? (hs.get("tableId") || "") : "";
  const uuid = s => /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(String(s || ""));
  const norm = s => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .trim().toLowerCase().replace(/\s+/g," ");
  const state = {catalog:null,qr:null,quote:null,sending:false,complete:false,uncertain:false};
  let changedAddress = "";
  function mode() {
    const selected = document.querySelector('input[name="mode"]:checked');
    if (selected?.value === "recoger") return "pickup";
    if (selected?.value === "domicilio") return "delivery";
    if (selected?.value === "mesa") return "table";
    return "";
  }
  function show(messageText,error=false) {
    message.hidden = false;
    message.style.display = "block";
    message.textContent = messageText;
    message.style.color = error ? "#ffc8b8" : "#e7c99d";
  }
  function selectedAddress() {
    return ((address?.value || "").trim() + ", " +
      (neighborhood?.value || "").trim()).replace(/,\s*$/, "").trim();
  }
  const deliver = document.createElement("button");
  deliver.type = "button";
  deliver.textContent = "Verificar cobertura y costo de domicilio";
  deliver.style.cssText="width:100%;border:1px solid #bc945e;padding:11px;border-radius:9px;background:#44291c;color:#f5dfbd;cursor:pointer;";
  const deliveryNotice=document.createElement("div");
  deliveryNotice.style.cssText="font-size:12px;line-height:1.5;color:#e6c79e;";
  const quoteBox=document.createElement("div");
  quoteBox.id="deli-live-delivery-quote";
  quoteBox.style.cssText="display:none;gap:8px;margin:10px 0;";
  quoteBox.append(deliver,deliveryNotice);
  if (address?.closest("label")) address.closest("label").insertAdjacentElement("afterend",quoteBox);
  else submit.parentNode.insertBefore(quoteBox,submit);

  if (confirmField) {
    confirmField.hidden = false;
    confirmField.style.display = "block";
    const text = [...confirmField.childNodes].find(n=>n.nodeType===Node.TEXT_NODE);
    if (text) text.textContent=" Confirmo los productos, el total y la forma de pago";
  }
  if (payment?.closest("label")) {
    payment.closest("label").hidden=false;
    payment.closest("label").style.display="block";
  }
  // Make the original button the ONLY confirmation control.
  submit.removeAttribute("disabled");
  submit.classList.remove("disabled-submit");
  submit.style.cursor="pointer";
  function sync() {
    const m=mode();
    const ready = m==="table" ? !!state.qr : m==="pickup" ? !!state.catalog :
      m==="delivery" ? !!state.catalog && !!state.quote &&
       changedAddress===selectedAddress() : false;
    quoteBox.style.display=m==="delivery"?"grid":"none";
    if(confirmField) {
      confirmField.hidden=false;
      confirmField.style.display="block";
    }
    submit.disabled = !ready || !confirm.checked || state.sending || state.complete || state.uncertain;
    submit.textContent=state.complete?"Pedido registrado":state.sending?"Registrando pedido...":
      m==="pickup" && state.catalog?"Confirmar pedido":
      m==="delivery" && ready?"Confirmar pedido":
      m==="delivery"?"Verificá el domicilio":
      m==="table" && state.qr?"Confirmar pedido":
      m==="table"?"Se necesita QR válido de mesa":
      state.catalog?"Elegí cómo recibir el pedido":"Cargando pedidos...";
    submit.classList.toggle("disabled-submit",submit.disabled);
    submit.style.cursor=submit.disabled?"not-allowed":"pointer";
  }
  async function post(action,body) {
    const response=await fetch("/public/delibocados-qr/"+action,{
      method:"POST",headers:{"Content-Type":"application/json"},
      credentials:"omit",cache:"no-store",body:JSON.stringify(body)
    });
    let result={};
    try{result=await response.json()}catch(_){}
    return {response,result};
  }
  function cartLines() {
    let saved=null;
    const keys=["delibocados-v2-cart","delibocados-cart","deli-cart","cart"];
    for(const key of keys) {
      for(const storage of [sessionStorage,localStorage]){
        try {
          const raw=storage.getItem(key);
          if (!raw) continue;
          const parsed=JSON.parse(raw);
          if (parsed && typeof parsed==="object" && Object.keys(parsed).length){
            saved=parsed;break;
          }
        }catch(_){}
      }
      if(saved)break;
    }
    if(!saved)return [];
    const rawLines=Array.isArray(saved)?saved:Array.isArray(saved.items)?saved.items:
      saved.items && typeof saved.items==="object"?saved.items:
      saved.cart && typeof saved.cart==="object"?saved.cart:saved;
    const pairs=Array.isArray(rawLines)?rawLines.map(v=>["",v]):Object.entries(rawLines);
    return pairs.map(([key,line])=>{
      const e=line && typeof line==="object"?line:{};
      return {
        id:String(e.productId??e.product_id??e.id??key),
        name:String(e.name??e.nombre??e.title??""),
        price:Number(e.priceCOP??e.price??e.precio),
        qty:Number(typeof line==="number"?line:e.quantity??e.qty??e.count??e.cantidad??0),
        instructions:String(e.instructions??e.nota??"").slice(0,500)
      };
    });
  }
  function itemsFromCart(catalog) {
    const raw=cartLines();
    if(!raw.length)throw Error("El carrito está vacío. Volvé a agregar un producto.");
    const merged=new Map();
    for(const line of raw) {
      if(!Number.isSafeInteger(line.qty)||line.qty<1||line.qty>25)
        throw Error("Hay una cantidad inválida en el carrito.");
      let prod=catalog.find(p=>String(p.id)===line.id);
      if(!prod&&line.name) {
        const options=catalog.filter(p=>norm(p.name)===norm(line.name));
        const exact=options.filter(p=>p.priceCOP===line.price);
        prod=exact.length===1?exact[0]:options.length===1?options[0]:null;
      }
      if(!prod)throw Error("El carrito contiene productos que no coinciden con el menú oficial.");
      const prior=merged.get(prod.id);
      const quantity=line.qty+(prior?.quantity||0);
      if(quantity>25)throw Error("Máximo 25 unidades por producto.");
      merged.set(prod.id,{productId:prod.id,quantity,
        instructions:line.instructions||(prior?.instructions||"")});
    }
    if(merged.size>60)throw Error("Demasiados productos para un solo pedido.");
    return [...merged.values()];
  }
  function stableKey(fingerprint) {
    try {
      const key="delibocados-cafe-checkout-idempotency";
      const current=JSON.parse(sessionStorage.getItem(key)||"null");
      if(current?.fingerprint===fingerprint&&uuid(current.sourceKey))return current.sourceKey;
      const sourceKey=crypto.randomUUID();
      sessionStorage.setItem(key,JSON.stringify({fingerprint,sourceKey}));
      return sourceKey;
    }catch(_){return crypto.randomUUID();}
  }
  async function init(){
    show("Conectando con los pedidos del restaurante...");
    sync();
    try{
      const c=await post("context",{kind:"pickup"});
      if(!c.response.ok||!c.result.ok||!Array.isArray(c.result.products)||
          !Number.isInteger(c.result.revision))throw Error("API_NO_DISPONIBLE");
      state.catalog=c.result;
      show("Pedidos disponibles para retirar. Para domicilio verificá cobertura; en mesa necesitás un QR válido.");
      if(/^[A-Za-z0-9_-]{32,200}$/.test(token)){
        const id=secureTableId||table?.dataset?.mesaId||"";
        if(uuid(id)){
          const qr=await post("context",{kind:"table",tableId:id,token});
          if(qr.response.ok&&qr.result.ok&&uuid(qr.result.table?.id)){
            state.qr=qr.result;
            if(table){table.value=qr.result.table.label;table.readOnly=true;}
          }
        }
      }
      sync();
    }catch(_){
      state.catalog=null;
      show("No se pudo conectar con el servicio de pedidos. No se enviará nada.",true);
      sync();
    }
  }
  deliver.addEventListener("click",async()=>{
    const full=selectedAddress();
    if(full.length<12){show("Completá calle, número, barrio y municipio (Funza o Mosquera).",true);return;}
    state.quote=null;changedAddress="";sync();
    deliver.disabled=true;show("Comprobando cobertura y costo real...");
    try{
      const v=await post("context",{kind:"delivery",address:full});
      if(v.response.ok&&v.result.ok&&v.result.quote?.covered&&v.result.quote.zone?.id){
        state.quote=v.result.quote;changedAddress=full;
        deliveryNotice.textContent="Zona: "+v.result.quote.zone.name+
          " · Envío: $"+Number(v.result.quote.zone.feeCOP).toLocaleString("es-CO")+
          " COP (se suma al carrito).";
        show("Cobertura verificada. Confirmá los datos del pedido.");
      } else {
        deliveryNotice.textContent="";
        show("No hay cobertura o tarifa verificada para esta dirección. No se aceptó ningún pedido.",true);
      }
    }catch(_){show("No se pudo verificar el domicilio. No se envió ningún pedido.",true);}
    finally{deliver.disabled=false;sync();}
  });
  for(const el of [address,neighborhood])el?.addEventListener("input",()=>{
    state.quote=null;changedAddress="";deliveryNotice.textContent="";sync();
  });
  confirm.addEventListener("change",sync);
  document.querySelectorAll('input[name="mode"]').forEach(el=>
    el.addEventListener("change",()=>{queueMicrotask(sync);}));
  async function send(event) {
    event.preventDefault();event.stopImmediatePropagation();
    if(state.sending||state.complete||state.uncertain)return;
    const m=mode();
    if(m==="table"&&!state.qr){show("Esta mesa necesita un código QR seguro.",true);return;}
    if((m==="pickup"||m==="delivery")&&!state.catalog){show("Pedidos aún no disponibles.",true);return;}
    if(m==="delivery"&&(!state.quote||changedAddress!==selectedAddress())){
      show("Verificá primero la dirección y su tarifa.",true);return;
    }
    if(!confirm.checked){show("Confirmá los datos del pedido.",true);return;}
    let payload;
    try{
      const customerName=name.value.trim();
      const customerPhone=phone.value.replace(/\D/g,"");
      if(customerName.length<2||customerName.length>120)throw Error("Ingresá tu nombre.");
      if(!/^[0-9]{8,15}$/.test(customerPhone))
        throw Error("Ingresá un teléfono de 8 a 15 dígitos con código de país.");
      const data=m==="table"?state.qr:state.catalog;
      const items=itemsFromCart(data.products);
      const method=payment?.value==="transfer"?"transfer":"cash";
      payload={kind:m,customerName,customerPhone,items,
        expectedMenuRevision:data.revision,paymentMethod:method,
        customerNote:(note?.value||"").slice(0,2000),customerConfirmed:true};
      if(m==="table"){payload.tableId=data.table.id;payload.token=token;}
      if(m==="delivery"){payload.address=selectedAddress();}
      payload.sourceKey=stableKey(JSON.stringify(payload));
    }catch(e){show(e instanceof Error?e.message:"Revisá los datos.",true);return;}
    state.sending=true;sync();show("Registrando tu pedido...");
    try{
      const r=await post("order",payload);
      if(!r.response.ok||!r.result.ok||!r.result.order?.id){
        if([400,404,415,422,429].includes(r.response.status)){
          show("Pedido rechazado: "+String(r.result.error||"datos inválidos")+
             ". No se registró.",true);
        }else{
          state.uncertain=true;
          show("No pudimos confirmar la respuesta. No repitas el pedido; consultá al personal.",true);
        }
        return;
      }
      state.complete=true;
      show("Pedido #"+String(r.result.order.number||"")+
        " registrado. Total $"+Number(r.result.order.totalCOP||0).toLocaleString("es-CO")+
        " COP. Pago pendiente; cocina debe confirmar recepción.");
    }catch(_){
      state.uncertain=true;
      show("Conexión interrumpida. El pedido podría existir; consultá al personal antes de reintentar.",true);
    }finally{state.sending=false;sync();}
  }
  submit.addEventListener("click",send,true);
  sync();void init();
})();