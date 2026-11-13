/* Delibocados public menu checkout. Does not print, charge or send to POS360. */
(() => {
  "use strict";
  const button = document.querySelector("button.disabled-submit");
  if (!button || document.getElementById("deli-live-checkout")) return;
  const originalLabel = button.textContent || "Confirmar pedido";
  const tableInput = document.getElementById("table");
  const params = new URLSearchParams(location.search);
  const hash = new URLSearchParams(location.hash.replace(/^#/, ""));
  const qrToken = hash.get("kind") === "table"
    ? (hash.get("token") || "") : (params.get("mesa") || "");
  const secureTableId = hash.get("kind") === "table"
    ? (hash.get("tableId") || "") : "";
  const isUuid = s => typeof s === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
  const isEditorId = s => typeof s === "string" && /^mesa_[a-f0-9]{32}$/.test(s);
  const validToken = /^[A-Za-z0-9_-]{32,200}$/.test(qrToken);
  let context = null, qrContext = null, confirmed = false, sending = false,
    uncertain = false, quote = null;
  const box = document.createElement("section");
  box.id = "deli-live-checkout";
  box.style.cssText = "display:grid;gap:12px;margin:16px 0;padding:15px;border:1px solid #bd966d;border-radius:12px;max-width:100%;box-sizing:border-box;";
  const heading = document.createElement("strong");
  heading.textContent = "Finalizar pedido";
  box.append(heading);
  function field(label, input) {
    const root = document.createElement("label");
    root.style.cssText = "display:grid;gap:5px;";
    const span = document.createElement("span");
    span.textContent = label;
    input.style.cssText = "width:100%;min-width:0;padding:10px;border:1px solid #bd966d;border-radius:8px;box-sizing:border-box;color:inherit;background:transparent";
    root.append(span, input);
    return root;
  }
  const phone = document.createElement("input");
  phone.type = "tel"; phone.autocomplete = "tel"; phone.inputMode = "tel";
  phone.placeholder = "Ej. 573001234567";
  phone.maxLength = 24;
  box.append(field("Teléfono con indicativo de país", phone));
  const payment = document.createElement("select");
  payment.add(new Option("Efectivo (pendiente de cobrar)", "cash"),
    new Option("Transferencia (pendiente de verificar)", "transfer"));
  box.append(field("Forma de pago", payment));
  const deliveryBox = document.createElement("div");
  deliveryBox.style.cssText = "display:grid;gap:10px;";
  const address = document.createElement("input");
  address.maxLength = 300;address.placeholder = "Dirección completa, municipio y departamento";
  deliveryBox.append(field("Dirección del domicilio", address));
  const addressNote = document.createElement("input");
  addressNote.maxLength = 500;addressNote.placeholder = "Casa, apartamento, referencias...";
  deliveryBox.append(field("Indicaciones de entrega (opcional)", addressNote));
  const quoteButton = document.createElement("button");
  quoteButton.type = "button";quoteButton.textContent = "Calcular domicilio";
  deliveryBox.append(quoteButton);box.append(deliveryBox);
  const confirmLabel = document.createElement("label");
  confirmLabel.style.cssText = "display:flex;gap:9px;align-items:flex-start;";
  const consent = document.createElement("input");
  consent.type = "checkbox";consent.style.marginTop = "4px";
  const consentText = document.createElement("span");
  consentText.textContent = "Confirmo los productos de mi carrito, los datos y la forma de pago.";
  confirmLabel.append(consent, consentText);box.append(confirmLabel);
  const statusEl = document.createElement("p");
  statusEl.setAttribute("role", "status");
  statusEl.setAttribute("aria-live", "polite");
  statusEl.style.cssText = "min-height:18px;margin:0;font-size:14px;line-height:1.5";
  box.append(statusEl);
  button.parentNode.insertBefore(box, button);
  function status(message, isError) {
    statusEl.textContent = message;
    statusEl.style.color = isError ? "#b22112" : "inherit";
  }
  const norm = v => String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .trim().toLowerCase().replace(/\s+/g, " ");
  function mode() {
    const chosen = document.querySelector('input[name="mode"]:checked, input[name="orderMode"]:checked, input[name="fulfillment"]:checked');
    const fallback = document.querySelector('select[name="mode"], select[name="orderMode"], #order-mode');
    const v = norm(chosen ? chosen.value : fallback && fallback.value);
    if (/(mesa|salon|comer aqui|dine|table)/.test(v)) return "table";
    if (/(domicilio|delivery|envio|reparto)/.test(v)) return "delivery";
    if (/(retiro|recoger|paso a buscar|pickup|llevar|local)/.test(v)) return "pickup";
    return "";
  }
  async function post(action, body) {
    const response = await fetch("/public/delibocados-qr/" + action, {
      method:"POST",cache:"no-store",credentials:"omit",
      headers:{"Content-Type":"application/json"},body:JSON.stringify(body)
    });
    let data = {};
    try { data = await response.json(); } catch (_) {}
    return {response,data};
  }
  function readCart() {
    let stored = null;
    for (const storage of [sessionStorage, localStorage]) {
      try {
        const val = storage.getItem("delibocados-v2-cart");
        if (val) { stored = JSON.parse(val);break; }
      } catch (_) {}
    }
    if (!stored && typeof cart !== "undefined") stored = cart;
    if (!stored && window.deliCart) stored = window.deliCart;
    if (!stored) return [];
    let entries = [];
    if (Array.isArray(stored)) entries = stored.map(x => ["",x]);
    else if (stored && typeof stored === "object" && Array.isArray(stored.items))
      entries = stored.items.map(x => ["",x]);
    else if (stored && typeof stored === "object" && stored.items &&
      typeof stored.items === "object") entries = Object.entries(stored.items);
    else if (stored && typeof stored === "object" && stored.cart &&
      typeof stored.cart === "object") entries = Object.entries(stored.cart);
    else if (typeof stored === "object") entries = Object.entries(stored);
    return entries.map(([key,raw]) => {
      if(raw === null || raw === undefined) return null;
      const entry = raw && typeof raw === "object" ? raw : {};
      const n = typeof raw === "number" ? raw :
        Number(entry.quantity ?? entry.qty ?? entry.count ?? entry.cantidad ?? 0);
      return {id:String(entry.productId ?? entry.product_id ?? entry.id ?? key),
        name:String(entry.name ?? entry.nombre ?? entry.title ?? ""),
        price:Number(entry.priceCOP ?? entry.price ?? entry.precio),
        quantity:n,instructions:String(entry.instructions ?? entry.nota ?? "").slice(0,500)};
    }).filter(Boolean);
  }
  function verifiedItems(products) {
    const lines = readCart();
    if (!lines.length) throw new Error("Tu carrito está vacío. Agregá productos antes de confirmar.");
    const merged = new Map();
    for (const item of lines) {
      if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 25)
        throw new Error("Revisá la cantidad de productos en el carrito.");
      let p = products.find(p=>p.id === item.id);
      if (!p && item.name) {
        const sameName=products.filter(p=>norm(p.name)===norm(item.name));
        const exact=sameName.filter(p=>Number(p.priceCOP)===item.price);
        if (exact.length===1) p=exact[0];
        // An unambiguous catalog name can safely resolve an item; server
        // prices are authoritative and never taken from browser input.
        else if (sameName.length===1) p=sameName[0];
      }
      if (!p) throw new Error("El carrito contiene productos sin identificar en la carta oficial. Actualizá el menú antes de pedir.");
      const old = merged.get(p.id);
      const quantity = item.quantity + (old?.quantity || 0);
      if (quantity>25) throw new Error("Máximo 25 unidades del mismo producto.");
      merged.set(p.id,{productId:p.id,quantity,
        instructions:item.instructions || old?.instructions || ""});
    }
    if (merged.size>60) throw new Error("El pedido supera 60 productos diferentes.");
    return [...merged.values()];
  }
  function customerName() {
    const f = document.querySelector('#name, #customer-name, input[name="customerName"]');
    if (f) return String(f.value || "").trim();
    for (const root of document.querySelectorAll("label")) {
      if (root===confirmLabel) continue;
      if (/(tu nombre|nombre completo|nombre del cliente)/.test(norm(root.textContent))) {
        const input = root.querySelector("input");
        if(input) return String(input.value || "").trim();
      }
    }
    return "";
  }
  function customerNote() {
    const el=document.querySelector('#notes, #note, #observations, textarea[name="notes"]');
    return String(el?.value||"").trim().slice(0,2000);
  }
  function sessionKey(fingerprint) {
    try {
      const k = "delibocados-web-source-v1";
      const existing = JSON.parse(sessionStorage.getItem(k) || "null");
      if (existing && existing.fingerprint===fingerprint && isUuid(existing.sourceKey))
        return existing.sourceKey;
      const sourceKey = crypto.randomUUID();
      sessionStorage.setItem(k,JSON.stringify({fingerprint,sourceKey}));
      return sourceKey;
    } catch (_) {return crypto.randomUUID();}
  }
  function updateButton() {
    const m=mode();
    deliveryBox.style.display = m==="delivery" ? "grid" : "none";
    const valid = m==="table" ? !!qrContext : m==="pickup" ? !!context :
      m==="delivery" ? !!context && !!quote?.covered &&
        quote.address===address.value.trim() : false;
    button.disabled = !valid || !consent.checked || sending || confirmed || uncertain;
    button.textContent = confirmed ? "Pedido registrado" :
      sending ? "Registrando pedido..." :
      valid ? "Confirmar pedido" :
      !context ? originalLabel :
      m==="table" ? "Se necesita QR de mesa" :
      m==="delivery" ? "Verificá el domicilio" :
      m==="pickup" ? "Confirmar pedido" : "Elegí cómo recibir el pedido";
    button.style.opacity = valid && !sending && !confirmed ? "1" : "";
    button.style.cursor = button.disabled ? "not-allowed" : "pointer";
  }
  async function initialize() {
    status("Comprobando disponibilidad del checkout...",false);
    try {
      const result = await post("context",{kind:"pickup"});
      if(!result.response.ok || !result.data.ok ||
        !Array.isArray(result.data.products) || !Number.isInteger(result.data.revision)) {
        status("Los pedidos online aún no están habilitados. Consultá con el restaurante.",true);
        updateButton();return;
      }
      context=result.data;
      // Remove legacy placeholder copy only after a live backend confirms the catalog.
      const parent=button.parentElement;
      if(parent) for (const el of parent.querySelectorAll("small,p")) {
        if (/(pedidos? en linea proximamente|se habilitara proximamente|proximamente disponible)/.test(norm(el.textContent))) {
          el.hidden=true;el.style.display="none";
        }
      }
      status("Podés pedir para retirar. Para mesa hace falta un QR seguro; para domicilio, una dirección verificada.",false);
      if(validToken && (isUuid(secureTableId)||tableInput)) {
        let tableId=secureTableId;
        if (!tableId) {
          for(let i=0;i<25;i++) {
            tableId=tableInput?.dataset?.mesaId || "";
            if (isUuid(tableId)||isEditorId(tableId)) break;
            await new Promise(r=>setTimeout(r,240));
          }
        }
        if(isUuid(tableId)||isEditorId(tableId)) {
          const qr=await post("context",{kind:"table",tableId,token:qrToken});
          if(qr.response.ok && qr.data.ok && isUuid(qr.data.table?.id)) {
            qrContext=qr.data;
            if(tableInput){tableInput.readOnly=true;tableInput.value=qr.data.table.label;}
            status("QR verificado: "+qr.data.table.label+". Ya podés confirmar el pedido.",false);
          }
        }
      }
      updateButton();
    } catch (_) {
      status("Sin conexión con el sistema de pedidos. No se envió nada.",true);
      updateButton();
    }
  }
  quoteButton.addEventListener("click",async()=>{
    if(sending || !context)return;
    quote=null;updateButton();
    const a=address.value.trim();
    if(a.length<8){status("Ingresá dirección completa con municipio.",true);return;}
    quoteButton.disabled=true;
    status("Verificando cobertura y costo de domicilio...",false);
    try{
      const {response,data}=await post("context",{kind:"delivery",address:a});
      if(!response.ok || !data.ok || !data.quote?.covered || !data.quote?.zone) {
        status("No podemos confirmar cobertura ni costo para esa dirección. Pedí para retirar o consultá al local.",true);
      } else {
        quote={...data.quote,address:a};
        status("Domicilio verificado: "+data.quote.zone.name+
          ". Envío: $"+Number(data.quote.zone.feeCOP).toLocaleString("es-CO")+
          " COP. Se suma al valor de los productos.",false);
      }
    }catch(_){status("No se pudo verificar el domicilio. No se envió ningún pedido.",true);}
    finally{quoteButton.disabled=false;updateButton();}
  });
  address.addEventListener("input",()=>{quote=null;updateButton();});
  consent.addEventListener("change",updateButton);
  payment.addEventListener("change",updateButton);
  document.addEventListener("change",ev=>{
    if(ev.target && ev.target.matches &&
      ev.target.matches('input[name="mode"],input[name="orderMode"],input[name="fulfillment"],select[name="mode"],select[name="orderMode"],#order-mode')) {
      queueMicrotask(updateButton);
    }
  },true);
  async function submit(event) {
    const m=mode();
    if(m!=="pickup" && m!=="delivery" && m!=="table")return;
    event.preventDefault();event.stopImmediatePropagation();
    if(sending || confirmed || uncertain || !consent.checked)return;
    if(m==="table"&&!qrContext){status("Esta mesa necesita un QR seguro verificado.",true);return;}
    if((m==="pickup"||m==="delivery")&&!context){status("Checkout no habilitado.",true);return;}
    if(m==="delivery"&&(!quote?.covered||quote.address!==address.value.trim())) {
      status("Primero verificá cobertura y costo del domicilio.",true);return;
    }
    let payload;
    try {
      const name=customerName();
      if(name.length<2||name.length>120)throw new Error("Completá tu nombre.");
      const number=phone.value.replace(/\D/g,"");
      if(!/^[0-9]{8,15}$/.test(number))throw new Error("Ingresá teléfono con indicativo de país.");
      const active=m==="table"?qrContext:context;
      const items=verifiedItems(active.products);
      payload={kind:m,sourceKey:"",customerName:name,customerPhone:number,items,
        expectedMenuRevision:active.revision,paymentMethod:payment.value,
        customerNote:customerNote(),customerConfirmed:true};
      if(m==="table"){
        payload.kind="table";payload.tableId=active.table.id;payload.token=qrToken;
      } else if(m==="delivery"){
        payload.address=address.value.trim();payload.addressNote=addressNote.value.trim();
      }
      payload.sourceKey=sessionKey(JSON.stringify(payload));
    }catch(error){status(error instanceof Error?error.message:"Revisá los datos del pedido.",true);return;}
    sending=true;updateButton();status("Registrando pedido en Neuromind...",false);
    try{
      const {response,data}=await post("order",payload);
      if(!response.ok || !data.ok || !data.order?.id){
        if(response.status===400||response.status===404||response.status===422||response.status===429){
          status("Pedido no aceptado: "+String(data.error||"revisá los datos")+" . No se registró.",true);
        } else {
          uncertain=true;
          status("No se pudo confirmar el resultado. NO repitas el pedido: consultá al personal con tu teléfono.",true);
        }
        return;
      }
      confirmed=true;
      status("Pedido #"+String(data.order.number||"")+" registrado. Total: $"+
        Number(data.order.totalCOP||0).toLocaleString("es-CO")+
        " COP. Pago pendiente. Cocina debe confirmar recepción: NO se ha verificado impresión en SmartPOS.",false);
    }catch(_){
      uncertain=true;
      status("La conexión se interrumpió. El pedido podría existir: no lo repitas sin consultar al personal.",true);
    }finally{sending=false;updateButton();}
  }
  button.addEventListener("click",submit,true);
  const form=button.closest("form");
  if(form)form.addEventListener("submit",submit,true);
  updateButton();
  void initialize();
})();