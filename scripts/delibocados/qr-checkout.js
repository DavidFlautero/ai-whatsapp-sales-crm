/*
 * Delibocados: checkout QR de mesas. No cambia la UI de retiro/domicilio.
 * El backend valida token, mesa, menu, precios e idempotencia.
 * No confirma POS ni impresion; solo registro interno del pedido.
 */
(() => {
  "use strict";

  const params = new URLSearchParams(window.location.search);
  // Secure QR format: /menu#kind=table&tableId=<UUID>&token=<opaque>
  // The fragment stays in the browser and is never part of normal HTTP logs.
  const qrHash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const hashTableId = qrHash.get("kind") === "table" ? (qrHash.get("tableId") || "") : "";
  const token = hashTableId ? (qrHash.get("token") || "") : (params.get("mesa") || "");
  const tableInput = document.getElementById("table");
  const tableField = document.getElementById("table-field");
  const button = document.querySelector("button.disabled-submit");
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(token) || !tableInput || !button) return;

  const oldButtonText = button.textContent;
  let context = null;
  let kind = "table";
  let sending = false;
  let confirmed = false;

  const box = document.createElement("div");
  box.id = "deli-qr-checkout-fields";
  box.style.cssText = "display:grid;gap:12px;margin:12px 0 16px";
  const phoneLabel = document.createElement("label");
  phoneLabel.className = "field";
  const phoneTitle = document.createElement("span");
  phoneTitle.textContent = "Tu telefono (WhatsApp)";
  const phone = document.createElement("input");
  phone.type = "tel";
  phone.inputMode = "tel";
  phone.autocomplete = "tel";
  phone.placeholder = "Ej. 573001234567";
  phone.maxLength = 24;
  phone.required = true;
  phone.style.width = "100%";
  phoneLabel.append(phoneTitle, phone);

  const paymentLabel = document.createElement("label");
  paymentLabel.className = "field";
  const paymentTitle = document.createElement("span");
  paymentTitle.textContent = "Forma de pago";
  const payment = document.createElement("select");
  payment.required = true;
  payment.style.cssText = "width:100%;padding:12px;border-radius:10px;color:inherit;background:inherit;border:1px solid #916846";
  const cash = new Option("Efectivo en el local", "cash");
  const transfer = new Option("Transferencia (sujeta a verificacion)", "transfer");
  payment.add(cash, transfer);
  paymentLabel.append(paymentTitle, payment);

  const state = document.createElement("div");
  state.id = "deli-qr-checkout-status";
  state.setAttribute("role", "status");
  state.setAttribute("aria-live", "polite");
  state.style.cssText = "font-size:14px;line-height:1.45;min-height:20px";
  box.append(phoneLabel, paymentLabel, state);
  button.parentNode.insertBefore(box, button);

  function status(message, error) {
    state.textContent = message;
    state.style.color = error ? "#ffb8a8" : "#f2cb9c";
  }
  function modeIsTable() {
    return (document.querySelector('input[name="mode"]:checked') || {}).value === "mesa";
  }
  function updateButton() {
    button.disabled = !context || !modeIsTable() || sending || confirmed;
    button.textContent = confirmed ? "Pedido registrado" :
      sending ? "Registrando pedido..." :
      context && modeIsTable() ? "Confirmar pedido" : oldButtonText;
  }
  function uuid(value) {
    return typeof value === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  }
  function editorId(value) {
    return typeof value === "string" && /^mesa_[0-9a-f]{32}$/.test(value);
  }
  async function post(path, data) {
    const response = await fetch("/public/delibocados-qr/" + path, {
      method: "POST", headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify(data)
    });
    let json = {};
    try { json = await response.json(); } catch (_) { /* unexpected response */ }
    return { response, json };
  }
  function awaitTableId() {
    return new Promise(resolve => {
      let attempts = 0;
      function check() {
        const value = tableInput.dataset.mesaId;
        if (uuid(value) || editorId(value) || attempts++ >= 24) return resolve(value || "");
        window.setTimeout(check, 250);
      }
      check();
    });
  }
  function showTable(label) {
    if (!tableField) return;
    tableInput.readOnly = true;
    tableInput.hidden = true;
    const header = tableField.querySelector("span");
    if (header) header.textContent = "Mesa asignada por QR";
    let name = document.getElementById("deli-qr-verified-table");
    if (!name) {
      name = document.createElement("strong");
      name.id = "deli-qr-verified-table";
      name.style.cssText = "display:block;padding:12px;border:1px solid #93623a;border-radius:10px";
      tableField.appendChild(name);
    }
    name.textContent = label;
  }
  async function loadContext() {
    status("Validando QR y mesa con el servidor...", false);
    const tableId = hashTableId || await awaitTableId();
    if (!uuid(tableId) && !editorId(tableId)) {
      status("Esta mesa aun no esta enlazada al checkout seguro. El pedido no se puede enviar.", true);
      return;
    }
    try {
      let result = await post("context", { kind: "table", tableId, token });
      if (result.response.status === 404) {
        result = await post("context", { kind: "general", tableId, token });
        if (result.response.ok && result.json.ok) kind = "general";
      }
      if (!result.response.ok || result.json.ok !== true ||
          !uuid(result.json.table && result.json.table.id) ||
          !Array.isArray(result.json.products) ||
          !Number.isInteger(result.json.revision)) {
        status("Checkout QR no disponible o mesa no verificada. No se recibio ningun pedido.", true);
        return;
      }
      context = result.json;
      const tableMode = document.querySelector('input[name="mode"][value="mesa"]');
      if (tableMode) {
        tableMode.checked = true;
        tableMode.dispatchEvent(new Event("change", { bubbles: true }));
      }
      showTable(String(context.table.label || tableInput.value || "Mesa"));
      // Remove old "coming soon" copy only after secure server validation.
      const comingSoon = button.nextElementSibling;
      if (comingSoon && /por ahora puedes consultar|se habilitará próximamente/i.test(comingSoon.textContent || "")) {
        comingSoon.hidden = true;
      }
      status("Mesa verificada. Confirma el pedido y la forma de pago.", false);
      updateButton();
    } catch (_) {
      status("No hay conexion con el servicio de pedidos. Vuelve a intentarlo mas tarde.", true);
    }
  }
  function normalizeText(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .trim().toLowerCase().replace(/\s+/g, " ");
  }
  function readCart() {
    let data = null;
    try { data = JSON.parse(sessionStorage.getItem("delibocados-v2-cart") || "null"); }
    catch (_) { /* malformed storage */ }
    if (!data && typeof cart !== "undefined") data = cart;
    if (!data || typeof data !== "object") return [];
    const entries = Array.isArray(data) ? data.map(v => [null, v]) :
      Array.isArray(data.items) ? data.items.map(v => [null, v]) :
      Object.entries(data);
    return entries.map(([key, value]) => {
      if (value === null || value === undefined) return null;
      const entry = typeof value === "object" ? value : {};
      const qty = typeof value === "number" ? value :
        Number(entry.quantity ?? entry.qty ?? entry.count ?? 0);
      return {
        id: String(entry.productId || entry.product_id || entry.id || key || ""),
        name: String(entry.name || entry.nombre || ""),
        unitPrice: Number(entry.priceCOP ?? entry.price ?? entry.precio),
        quantity: qty,
        instructions: String(entry.instructions || "").slice(0, 500)
      };
    }).filter(Boolean);
  }
  function verifiedItems() {
    if (!context) throw new Error("Mesa no validada.");
    const cartLines = readCart();
    if (!cartLines.length) throw new Error("El carrito esta vacio.");
    const merged = new Map();
    for (const line of cartLines) {
      if (!Number.isSafeInteger(line.quantity) || line.quantity < 1 || line.quantity > 25)
        throw new Error("Cantidad de producto invalida.");
      let product = context.products.find(p => p.id === line.id);
      if (!product && line.name && Number.isSafeInteger(line.unitPrice)) {
        const matches = context.products.filter(p =>
          normalizeText(p.name) === normalizeText(line.name) &&
          p.priceCOP === line.unitPrice);
        if (matches.length === 1) product = matches[0];
      }
      if (!product) throw new Error("Hay un producto del carrito no validado en el catalogo. Actualiza el menu antes de pedir.");
      const previous = merged.get(product.id);
      const quantity = (previous ? previous.quantity : 0) + line.quantity;
      if (quantity > 25) throw new Error("Superaste la cantidad permitida por producto.");
      merged.set(product.id, {
        productId: product.id, quantity,
        instructions: line.instructions || (previous && previous.instructions) || ""
      });
    }
    if (merged.size > 60) throw new Error("Demasiados productos para un pedido.");
    return [...merged.values()];
  }
  function customerName() {
    const input = document.querySelector('#name, #customer-name, [name="customerName"]');
    if (input) return input.value.trim();
    const labels = [...document.querySelectorAll("label")];
    const label = labels.find(l => {
      const span = l.querySelector("span");
      return span && normalizeText(span.textContent) === "tu nombre";
    });
    return (label && label.querySelector("input") ? label.querySelector("input").value : "").trim();
  }
  function customerNote() {
    const field = document.querySelector("#notes, #note, #observations, textarea");
    return field ? field.value.trim().slice(0, 2000) : "";
  }
  function persistentKey(fingerprint) {
    let old = null;
    try { old = JSON.parse(sessionStorage.getItem("delibocados-qr-pending-v1") || "null"); }
    catch (_) { /* invalid stored state */ }
    if (old && old.fingerprint === fingerprint && uuid(old.sourceKey)) return old.sourceKey;
    const sourceKey = crypto.randomUUID();
    try { sessionStorage.setItem("delibocados-qr-pending-v1",
      JSON.stringify({ fingerprint, sourceKey })); } catch (_) { /* no session persistence */ }
    return sourceKey;
  }

  button.addEventListener("click", async event => {
    if (!context || !modeIsTable() || sending || confirmed) return;
    event.preventDefault();
    let payload;
    try {
      const name = customerName();
      const digits = phone.value.replace(/\D/g, "");
      if (name.length < 2 || name.length > 120) throw new Error("Ingresa tu nombre.");
      if (!/^[0-9]{8,15}$/.test(digits)) throw new Error("Ingresa tu telefono con indicativo, solo numeros.");
      const items = verifiedItems();
      payload = {
        kind, tableId: context.table.id, token,
        customerName: name, customerPhone: digits,
        items, expectedMenuRevision: context.revision,
        paymentMethod: payment.value,
        customerNote: customerNote(),
        customerConfirmed: true
      };
      payload.sourceKey = persistentKey(JSON.stringify({
        tableId: payload.tableId, kind, name, digits, items,
        payment: payload.paymentMethod, note: payload.customerNote,
        revision: payload.expectedMenuRevision
      }));
    } catch (error) {
      status(error instanceof Error ? error.message : "Revisa el pedido.", true);
      return;
    }
    sending = true;
    updateButton();
    status("Registrando el pedido en Neuromind...", false);
    try {
      const { response, json } = await post("order", payload);
      if (!response.ok || json.ok !== true || !json.order || !json.order.id) {
        status("No se confirmo el pedido. " +
          (json.error === "INVALID_INPUT" ? "Revisa los datos." :
           "Comprueba la conexion o consulta al personal. No repitas el pedido sin verificar."), true);
        return;
      }
      confirmed = true;
      const number = json.order.number != null ? "#" + json.order.number : "";
      status("Pedido " + number + " registrado en Neuromind para " +
        String(json.order.table || context.table.label) +
        ". Aun NO significa que SmartPOS o la impresora hayan recibido la comanda." +
        (payment.value === "transfer" ? " Pago pendiente de verificacion." : ""), false);
    } catch (_) {
      status("No se pudo verificar la respuesta del servidor. Consulta al personal antes de reintentar.", true);
    } finally {
      sending = false;
      updateButton();
    }
  }, true);

  document.querySelectorAll('input[name="mode"]').forEach(input =>
    input.addEventListener("change", updateButton));
  updateButton();
  void loadContext();
})();