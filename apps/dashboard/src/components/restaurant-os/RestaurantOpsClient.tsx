"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import "./restaurant-ops.css";

type Status = "confirmed" | "preparing" | "ready" | "out_for_delivery" | "completed" | "cancelled";
type Tab = "orders" | "kitchen" | "dispatch" | "zones" | "incidents" | "reports";
type Item = { id: string; product_id: string; product_name: string; quantity: number;
  unit_price_cop: number; line_total_cop: number; instructions: string };
type Order = { id: string; number: number; customer_name: string; customer_phone: string;
  fulfillment_mode: "pickup" | "delivery"; status: Status; payment_status: string;
  version: number; created_at: string; preparing_at?: string; ready_at?: string;
  customer_note?: string; address?: string; zone_id?: string; courier_id?: string;
  total_cop: number; subtotal_cop: number; delivery_fee_cop: number;
  restaurant_ops_order_items?: Item[] };
type Courier = { id: string; name: string; phone: string; vehicle: "bike" | "motorbike";
  availability: "offline" | "available" | "busy"; active: boolean };
type Zone = { id: string; name: string; fee_cop: number; eta_minutes: number;
  active: boolean; priority: number };
type Incident = { id: string; order_id: string; description: string; category: string;
  severity: string; status: string; resolution?: string; created_at: string };
type Product = { id: string; name: string; priceCOP: number; available?: boolean;
  priceNeedsReview?: boolean; category: string };
type Report = { days: number; truncated: boolean; customers: number;
  orders: Record<string, number>; kitchen: { commandsGenerated: number; printed: number; started: number;
  ready: number; averagePrepMinutes: number | null; overdue: number };
  incidents: { total: number; open: number; resolved: number; critical: number };
  couriers: Array<{ id: string; name: string; vehicle: string; completed: number; assigned: number }> };

const root = "/dashboard-api/restaurant-ops";
const money = (n: number) => new Intl.NumberFormat("es-CO", {
  style: "currency", currency: "COP", maximumFractionDigits: 0
}).format(n);
const relative = (iso: string) => {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  return Number.isFinite(minutes) ? (minutes < 60 ? minutes + " min" : Math.floor(minutes / 60) + " h " + minutes % 60 + " min") : "—";
};
const names: Record<string, string> = {
  confirmed: "Nuevo / confirmado", preparing: "En preparación",
  ready: "Listo", out_for_delivery: "En reparto", completed: "Entregado",
  cancelled: "Cancelado", pending: "Pago pendiente", proof_submitted: "Comprobante por revisar",
  verified: "Pago verificado", cash_on_delivery: "Cobro al entregar", refunded: "Reembolsado"
};
const tabs: Array<{ key: Tab; label: string }> = [
  { key: "orders", label: "Pedidos" }, { key: "kitchen", label: "Cocina" },
  { key: "dispatch", label: "Reparto" }, { key: "zones", label: "Zonas" },
  { key: "incidents", label: "Incidencias" }, { key: "reports", label: "Informes" }
];
async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(root + "/" + path, {
    method: body === undefined ? "GET" : "POST", credentials: "same-origin",
    cache: "no-store", headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  const json = await response.json().catch(() => ({ ok: false, error: "INVALID_RESPONSE" }));
  if (!response.ok || !json.ok) throw new Error(json.error || "REQUEST_FAILED");
  return json as T;
}
function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: string }) {
  return <span className={"rops-pill rops-" + tone}>{children}</span>;
}
function StatusLabel({ status }: { status: string }) {
  return <Pill tone={status === "completed" || status === "verified" ? "ok" :
    status === "cancelled" || status === "refunded" ? "danger" :
    status === "preparing" || status === "proof_submitted" ? "warning" : "neutral"}>
    {names[status] || status}
  </Pill>;
}
function OrderLines({ order }: { order: Order }) {
  return <div className="rops-lines">{(order.restaurant_ops_order_items || []).map(x =>
    <div key={x.id}><strong>{x.quantity} × {x.product_name}</strong>
      <span>{money(x.line_total_cop)}</span>
      {x.instructions && <small>Nota: {x.instructions}</small>}
    </div>)}</div>;
}
export default function RestaurantOpsClient({ initialTab = "orders" }: { initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [orders, setOrders] = useState<Order[]>([]);
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [filter, setFilter] = useState("active");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [phone, setPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [fulfillment, setFulfillment] = useState<"pickup" | "delivery">("pickup");
  const [zoneId, setZoneId] = useState("");
  const [address, setAddress] = useState("");
  const [instructions, setInstructions] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [confirmed, setConfirmed] = useState(false);
  const idempotencyKey = useRef<string>("");
  const [courierName, setCourierName] = useState("");
  const [courierPhone, setCourierPhone] = useState("");
  const [courierVehicle, setCourierVehicle] = useState<"bike" | "motorbike">("bike");
  const [zoneName, setZoneName] = useState("");
  const [zoneFee, setZoneFee] = useState("");
  const [zoneETA, setZoneETA] = useState("30");
  const [zoneVerified, setZoneVerified] = useState(false);
  const [zoneActive, setZoneActive] = useState(false);
  const [incidentOrderId, setIncidentOrderId] = useState("");
  const [incidentType, setIncidentType] = useState("late");
  const [incidentDetail, setIncidentDetail] = useState("");

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [o, c, z, i, r] = await Promise.all([
        api<{ orders: Order[] }>("orders"),
        api<{ couriers: Courier[] }>("couriers"),
        api<{ zones: Zone[] }>("zones"),
        api<{ incidents: Incident[] }>("incidents"),
        api<{ report: Report }>("report?days=7")
      ]);
      setOrders(o.orders); setCouriers(c.couriers); setZones(z.zones);
      setIncidents(i.incidents); setReport(r.report); setError("");
    } catch (e) {
      if (!silent) setError(e instanceof Error ? e.message : "Error de conexión");
    } finally { if (!silent) setLoading(false); }
  }, []);
  useEffect(() => {
    void refresh(); const interval = setInterval(() => void refresh(true), 10000);
    return () => clearInterval(interval);
  }, [refresh]);
  useEffect(() => {
    if (!showNew) return;
    fetch("/panel/menu/api", { credentials: "same-origin", cache: "no-store" })
      .then(async r => { if (!r.ok) throw new Error("No se pudo consultar el menú"); return r.json(); })
      .then(x => setProducts(Array.isArray(x.payload?.products) ? x.payload.products : []))
      .catch(e => setError(String(e.message || e)));
  }, [showNew]);

  const active = orders.filter(o => !["completed", "cancelled"].includes(o.status));
  const visible = orders.filter(o => filter === "all" || (filter === "active" ?
    !["completed", "cancelled"].includes(o.status) : o.status === filter));
  const readyZones = zones.filter(z => z.active);
  const lineProducts = useMemo(() => products.filter(p => p.available !== false &&
    p.priceNeedsReview !== true && Number.isSafeInteger(Number(p.priceCOP)) &&
    Number(p.priceCOP) >= 0), [products]);
  const subtotal = Object.entries(cart).reduce((sum, [id, qty]) => {
    const product = lineProducts.find(p => p.id === id);
    return sum + (product ? Number(product.priceCOP) * qty : 0);
  }, 0);
  const selectedZone = zones.find(z => z.id === zoneId);
  const fee = fulfillment === "delivery" ? selectedZone?.fee_cop || 0 : 0;
  async function act(path: string, body: unknown, success: string) {
    setBusy(true); setNotice(""); setError("");
    try { await api(path, body); setNotice(success); await refresh(true); return true; }
    catch (e) { setError(e instanceof Error ? e.message : "Operación fallida"); return false; }
    finally { setBusy(false); }
  }
  function next(order: Order): Status | null {
    if (order.status === "confirmed") return "preparing";
    if (order.status === "preparing") return "ready";
    if (order.status === "ready") return order.fulfillment_mode === "pickup" ? "completed" : "out_for_delivery";
    if (order.status === "out_for_delivery") return "completed";
    return null;
  }
  async function move(order: Order) {
    const status = next(order); if (!status) return;
    if (status === "out_for_delivery" && !order.courier_id) {
      setError("Asigná un repartidor antes de marcar salida a domicilio."); return;
    }
    await act("orders/" + order.id + "/transition",
      { version: order.version, nextStatus: status },
      "Pedido #" + order.number + " actualizado: " + names[status]);
  }
  async function cancel(order: Order) {
    const reason = window.prompt("Motivo obligatorio de cancelación (mínimo 5 caracteres)");
    if (!reason || reason.trim().length < 5) return;
    await act("orders/" + order.id + "/transition",
      { version: order.version, nextStatus: "cancelled", reason },
      "Pedido cancelado con registro de auditoría.");
  }
  async function assign(order: Order, courierId: string) {
    if (!courierId) return;
    await act("orders/" + order.id + "/assign",
      { version: order.version, courierId }, "Repartidor asignado.");
  }
  async function verifyPayment(order: Order) {
    if (!window.confirm("¿Verificaste el pago fuera del sistema? Nunca marques como pagado solo por una foto."))
      return;
    await act("orders/" + order.id + "/payment",
      { version: order.version, status: "verified", method: "manual" }, "Pago validado por el encargado.");
  }
  async function create(event: FormEvent) {
    event.preventDefault();
    if (!confirmed) { setError("Se requiere confirmación expresa del cliente."); return; }
    if (!idempotencyKey.current) idempotencyKey.current = crypto.randomUUID();
    const ok = await act("orders", {
      source: "panel", sourceKey: idempotencyKey.current,
      customerPhone: phone.replace(/\D/g, ""), customerName: customerName.trim(),
      fulfillmentMode: fulfillment, zoneId: fulfillment === "delivery" ? zoneId : null,
      address: fulfillment === "delivery" ? address : null,
      customerNote: instructions, customerConfirmed: true,
      items: Object.entries(cart).filter(([, qty]) => qty > 0).map(([productId, quantity]) => ({
        productId, quantity
      }))
    }, "Pedido registrado en la cola de cocina.");
    if (ok) {
      idempotencyKey.current = ""; setCart({}); setConfirmed(false);
      setShowNew(false); setPhone(""); setCustomerName(""); setInstructions("");
    }
  }
  function OrderCard({ order, kitchen = false }: { order: Order; kitchen?: boolean }) {
    const courier = couriers.find(c => c.id === order.courier_id);
    const current = next(order);
    const needsPayment = current === "preparing" && !["verified","cash_on_delivery"].includes(order.payment_status);
    return <article className="rops-order" key={order.id}>
      <div className="rops-order-head">
        <div><strong>#{order.number} · {order.customer_name}</strong>
          <small>{order.fulfillment_mode === "pickup" ? "Retiro en el local" : "Domicilio"} · Hace {relative(order.created_at)}</small>
        </div>
        <StatusLabel status={order.status}/>
      </div>
      <div className="rops-order-body">
        <OrderLines order={order}/>
        <p><b>Total:</b> {money(order.total_cop)} · <StatusLabel status={order.payment_status}/></p>
        {order.address && <p><b>Dirección:</b> {order.address}</p>}
        {needsPayment && <p><b>Atención:</b> comprobar el pago antes de pasar a cocina.</p>}
        {order.customer_note && <p><b>Observaciones:</b> {order.customer_note}</p>}
        {courier && <p><b>Repartidor:</b> {courier.name} ({courier.vehicle === "bike" ? "bicicleta" : "moto"})</p>}
        {kitchen && <p><b>Tiempo:</b> {relative(order.preparing_at || order.created_at)}</p>}
      </div>
      <div className="rops-actions">
        {current && <button disabled={busy || needsPayment} title={needsPayment ? "Verificar pago antes de cocinar" : ""} onClick={() => void move(order)}>
          {current === "preparing" ? "Iniciar cocina" : current === "ready" ? "Marcar listo" :
            current === "out_for_delivery" ? "Sale a domicilio" :
            order.fulfillment_mode === "pickup" ? "Entregado en local" : "Domicilio entregado"}
        </button>}
        {order.fulfillment_mode === "delivery" && !order.courier_id &&
          ["confirmed","preparing","ready"].includes(order.status) &&
          <select aria-label={"Asignar repartidor a pedido " + order.number} disabled={busy} defaultValue=""
            onChange={e => void assign(order, e.target.value)}>
            <option value="">Asignar repartidor…</option>
            {couriers.filter(c => c.active && c.availability === "available").map(c =>
              <option key={c.id} value={c.id}>{c.name} · {c.vehicle === "bike" ? "Bici" : "Moto"}</option>)}
          </select>}
        {order.payment_status !== "verified" && order.payment_status !== "refunded" &&
          <button disabled={busy} className="rops-secondary" onClick={() => void verifyPayment(order)}>Verificar pago</button>}
        {!kitchen && ["confirmed","preparing"].includes(order.status) &&
          <button disabled={busy} className="rops-danger-btn" onClick={() => void cancel(order)}>Cancelar</button>}
        <a href={"/panel/operador"}>Conversación</a>
      </div>
    </article>;
  }
  return <div className="rops">
    <header className="rops-heading">
      <div><span className="rops-eyebrow">DELIBOCADOS / CENTRO DE OPERACIONES</span>
        <h1>Pedidos, cocina y domicilios</h1>
        <p>Una operación continua desde WhatsApp hasta la entrega, con trazabilidad por pedido.</p>
      </div>
      <div className="rops-header-actions">
        <button type="button" onClick={() => void refresh()} disabled={busy}>Actualizar</button>
        <button type="button" className="rops-primary" onClick={() => { setTab("orders"); setShowNew(true); }}>+ Nuevo pedido</button>
      </div>
    </header>
    {error && <div className="rops-error" role="alert">{error}</div>}
    {notice && <div className="rops-notice" role="status">{notice}</div>}
    <nav className="rops-tabs" aria-label="Operación gastronómica">
      {tabs.map(t => <button key={t.key} className={tab === t.key ? "selected" : ""}
        onClick={() => setTab(t.key)}>{t.label}</button>)}
    </nav>
    <div className="rops-metrics">
      <div><span>Activos</span><strong>{active.length}</strong></div>
      <div><span>En cocina</span><strong>{orders.filter(o => o.status === "preparing").length}</strong></div>
      <div><span>Listos</span><strong>{orders.filter(o => o.status === "ready").length}</strong></div>
      <div><span>En reparto</span><strong>{orders.filter(o => o.status === "out_for_delivery").length}</strong></div>
      <div><span>Incidencias abiertas</span><strong>{incidents.filter(i => i.status === "open").length}</strong></div>
    </div>
    {loading && <p className="rops-muted">Consultando datos operativos…</p>}

    {showNew && tab === "orders" && <section className="rops-card rops-create">
      <div className="rops-row"><h2>Crear pedido confirmado</h2>
        <button type="button" className="rops-secondary" onClick={() => setShowNew(false)}>Cerrar</button></div>
      <p>El precio se verifica contra el menú publicado. Este formulario no factura ni envía pedidos a Toteat/POS360.</p>
      <form onSubmit={e => void create(e)}>
        <div className="rops-form-grid">
          <label>Nombre del cliente<input value={customerName} onChange={e => setCustomerName(e.target.value)} minLength={2} required/></label>
          <label>WhatsApp (indicativo incluido)<input value={phone} onChange={e => setPhone(e.target.value)} pattern="[0-9]{8,15}" required/></label>
          <label>Modalidad<select value={fulfillment} onChange={e => setFulfillment(e.target.value as "pickup" | "delivery")}>
            <option value="pickup">Pasa a buscar al local</option><option value="delivery">Envío a domicilio</option>
          </select></label>
          {fulfillment === "delivery" && <>
            <label>Zona verificada<select value={zoneId} onChange={e => setZoneId(e.target.value)} required>
              <option value="">Seleccionar zona</option>{readyZones.map(z =>
                <option value={z.id} key={z.id}>{z.name} · {money(z.fee_cop)} · {z.eta_minutes} min</option>)}
            </select></label>
            <label className="rops-wide">Dirección de entrega<input value={address} onChange={e => setAddress(e.target.value)} minLength={8} required/></label>
          </>}
          <label className="rops-wide">Observaciones<textarea value={instructions} onChange={e => setInstructions(e.target.value)} rows={2}/></label>
        </div>
        <h3>Seleccionar productos del menú</h3>
        <div className="rops-product-list">{lineProducts.map(p => <label key={p.id} className="rops-product">
          <span>{p.name}<small>{p.category} · {money(Number(p.priceCOP))}</small></span>
          <input aria-label={"Cantidad de " + p.name} type="number" min={0} max={25}
            value={cart[p.id] || 0} onChange={e => setCart(old => ({ ...old, [p.id]: Number(e.target.value) || 0 }))}/>
        </label>)}</div>
        <div className="rops-row"><strong>Subtotal {money(subtotal)} + Domicilio {money(fee)} = {money(subtotal + fee)}</strong></div>
        <label className="rops-check"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}/>
          El cliente confirmó productos, modalidad, total y condiciones.</label>
        <button className="rops-primary" disabled={busy || !confirmed || subtotal < 0 ||
          !Object.values(cart).some(x => x > 0)}>Confirmar y enviar a cocina</button>
      </form>
    </section>}

    {tab === "orders" && <section className="rops-card">
      <div className="rops-row"><h2>Pedidos</h2><select value={filter} onChange={e => setFilter(e.target.value)}>
        <option value="active">Activos</option><option value="all">Todos</option>
        {(["confirmed","preparing","ready","out_for_delivery","completed","cancelled"] as Status[]).map(s =>
          <option key={s} value={s}>{names[s]}</option>)}
      </select></div>
      <div className="rops-cards">{visible.map(o => <OrderCard key={o.id} order={o}/>)}</div>
      {!visible.length && <p className="rops-empty">No hay pedidos en esta categoría.</p>}
    </section>}

    {tab === "kitchen" && <section className="rops-card">
      <div className="rops-row"><h2>Pantalla de cocina (KDS)</h2>
        <Pill>{report?.kitchen.commandsGenerated || 0} comandas generadas · 7 días</Pill></div>
      <p>Las comandas ingresan al confirmarse un pedido. Tiempo desde preparación y notas visibles.</p>
      <div className="rops-cards">{orders.filter(o =>
        ["confirmed","preparing","ready"].includes(o.status)).map(o =>
          <OrderCard key={o.id} order={o} kitchen/>)}</div>
      {!orders.some(o => ["confirmed","preparing","ready"].includes(o.status)) &&
        <p className="rops-empty">Sin comandas activas.</p>}
    </section>}

    {tab === "dispatch" && <section className="rops-card">
      <h2>Despacho y repartidores</h2>
      <p>Asignación manual con control de disponibilidad; los pedidos de retiro no utilizan repartidor.</p>
      <div className="rops-couriers">{couriers.map(c => <div key={c.id} className="rops-courier">
        <div><strong>{c.name}</strong><small>{c.phone} · {c.vehicle === "bike" ? "Bicicleta" : "Moto"}</small></div>
        <StatusLabel status={c.availability}/>
        {(c.availability === "offline" || c.availability === "available") &&
          <button className="rops-secondary" disabled={busy} onClick={() => void act(
            "couriers/" + c.id + "/availability",
            { availability: c.availability === "offline" ? "available" : "offline" },
            "Disponibilidad actualizada.")}>Cambiar estado</button>}
      </div>)}</div>
      <form className="rops-mini-form" onSubmit={e => { e.preventDefault(); void act("couriers",
        { name: courierName, phone: courierPhone, vehicle: courierVehicle },
        "Perfil registrado.").then(ok => { if(ok) { setCourierName(""); setCourierPhone(""); } }); }}>
        <h3>Alta de repartidor</h3><input placeholder="Nombre" aria-label="Nombre repartidor" value={courierName} onChange={e => setCourierName(e.target.value)} required/>
        <input placeholder="Teléfono con indicativo" aria-label="Teléfono repartidor" value={courierPhone}
          onChange={e => setCourierPhone(e.target.value)} pattern="[0-9]{8,15}" required/>
        <select aria-label="Vehículo" value={courierVehicle} onChange={e => setCourierVehicle(e.target.value as "bike"|"motorbike")}>
          <option value="bike">Bicicleta</option><option value="motorbike">Moto</option>
        </select><button disabled={busy}>Registrar</button>
      </form>
      <h3>Domicilios pendientes y activos</h3>
      <div className="rops-cards">{orders.filter(o => o.fulfillment_mode === "delivery" &&
        !["completed","cancelled"].includes(o.status)).map(o => <OrderCard key={o.id} order={o}/>)}</div>
    </section>}

    {tab === "zones" && <section className="rops-card">
      <h2>Zonas de domicilio</h2>
      <p>Las tarifas importadas inicialmente están inactivas. Hay que verificar sus límites geográficos antes de habilitar cobros automáticos.</p>
      <div className="rops-table-wrap"><table><thead><tr><th>Zona</th><th>Tarifa</th><th>Estimado</th><th>Estado</th></tr></thead>
        <tbody>{zones.map(z => <tr key={z.id}><td>{z.name}</td><td>{money(z.fee_cop)}</td>
          <td>{z.eta_minutes} min</td><td><Pill tone={z.active ? "ok" : "warning"}>{z.active ? "Verificada" : "Sin verificar"}</Pill></td></tr>)}</tbody>
      </table></div>
      <form className="rops-mini-form" onSubmit={e => { e.preventDefault();
        void act("zones", { name: zoneName, feeCOP: Number(zoneFee), etaMinutes: Number(zoneETA),
          active: zoneActive, coverageVerified: zoneVerified },
          "Zona guardada.").then(ok => { if(ok) { setZoneName(""); setZoneFee(""); setZoneVerified(false); setZoneActive(false); } }); }}>
        <h3>Crear / actualizar zona por nombre</h3>
        <input placeholder="Nombre exacto" aria-label="Nombre de zona" value={zoneName}
          onChange={e => setZoneName(e.target.value)} required minLength={2}/>
        <input placeholder="Tarifa COP" aria-label="Tarifa en COP" type="number" min={0}
          value={zoneFee} onChange={e => setZoneFee(e.target.value)} required/>
        <input placeholder="Minutos estimados" aria-label="Tiempo de entrega" type="number" min={1}
          value={zoneETA} onChange={e => setZoneETA(e.target.value)} required/>
        <label className="rops-check"><input type="checkbox" checked={zoneVerified}
          onChange={e => setZoneVerified(e.target.checked)}/> Cobertura y tarifa verificadas manualmente</label>
        <label className="rops-check"><input type="checkbox" checked={zoneActive}
          onChange={e => setZoneActive(e.target.checked)}/> Activar zona</label>
        <button disabled={busy || (zoneActive && !zoneVerified)}>Guardar zona</button>
      </form>
    </section>}

    {tab === "incidents" && <section className="rops-card">
      <h2>Incidencias, errores y reclamaciones</h2>
      <p>Toda incidencia queda asociada al pedido y exige un motivo de resolución.</p>
      <div className="rops-cards">{incidents.map(i => <article key={i.id} className="rops-order">
        <div className="rops-row"><strong>{i.category} · {i.severity}</strong><StatusLabel status={i.status}/></div>
        <p>{i.description}</p><small>Pedido: {i.order_id.slice(0, 8)} · {new Date(i.created_at).toLocaleString("es-CO")}</small>
        {i.status === "open" && <button className="rops-secondary" disabled={busy} onClick={() => {
          const resolution = window.prompt("¿Cómo se solucionó? (mínimo 5 caracteres)");
          if(resolution && resolution.trim().length >= 5)void act(
            "incidents/" + i.id + "/resolve",{resolution},"Incidencia resuelta.");
        }}>Resolver</button>}
      </article>)}</div>
      <form className="rops-mini-form" onSubmit={e => { e.preventDefault(); void act("incidents",
        { orderId: incidentOrderId, category: incidentType, description: incidentDetail },
        "Incidencia registrada.").then(ok => { if(ok) setIncidentDetail(""); }); }}>
        <h3>Registrar incidencia</h3>
        <select aria-label="Pedido afectado" value={incidentOrderId}
          onChange={e => setIncidentOrderId(e.target.value)} required>
          <option value="">Elegí un pedido</option>{orders.map(o =>
            <option value={o.id} key={o.id}>#{o.number} · {o.customer_name}</option>)}
        </select>
        <select aria-label="Tipo de incidencia" value={incidentType} onChange={e => setIncidentType(e.target.value)}>
          {["late","wrong_item","missing_item","allergy","payment","address","courier","technical","other"].map(s =>
            <option key={s} value={s}>{s}</option>)}
        </select>
        <textarea placeholder="Descripción del error" aria-label="Descripción" value={incidentDetail}
          onChange={e => setIncidentDetail(e.target.value)} minLength={5} required rows={2}/>
        <button disabled={busy}>Registrar incidencia</button>
      </form>
    </section>}

    {tab === "reports" && <section className="rops-card">
      <h2>Informe operativo · Últimos 7 días</h2>
      {report?.truncated && <div className="rops-error">Volumen superior al límite del reporte: resultados parciales. Requiere agregación SQL.</div>}
      <div className="rops-report-grid">
        {[
          ["Pedidos",report?.orders.total],["Completados",report?.orders.completed],
          ["Cancelados",report?.orders.cancelled],["Retiro en local",report?.orders.pickup],
          ["Domicilios",report?.orders.delivery],["Clientes distintos",report?.customers],
          ["Comandas generadas",report?.kitchen.commandsGenerated],["Comandas impresas",report?.kitchen.printed],
          ["Comandas iniciadas",report?.kitchen.started],
          ["Comandas listas",report?.kitchen.ready],
          ["Minutos promedio en cocina",report?.kitchen.averagePrepMinutes],
          ["Comandas demoradas",report?.kitchen.overdue],
          ["Incidencias abiertas",report?.incidents.open]
        ].map(([label,value]) => <div key={String(label)}><span>{label}</span><strong>{value ?? "—"}</strong></div>)}
      </div>
      <h3>Rendimiento de repartidores</h3>
      <div className="rops-table-wrap"><table><thead><tr><th>Repartidor</th><th>Vehículo</th><th>Asignados</th><th>Entregados</th></tr></thead>
        <tbody>{report?.couriers.map(c => <tr key={c.id}><td>{c.name}</td><td>{c.vehicle}</td>
          <td>{c.assigned}</td><td>{c.completed}</td></tr>)}</tbody>
      </table></div>
    </section>}
    <p className="rops-footnote">Actualización cada 10 segundos. El envío de notificaciones WhatsApp y la sincronización con POS
      requieren activar y verificar integraciones externas por separado. No se hacen cobros automáticos.</p>
  </div>;
}
