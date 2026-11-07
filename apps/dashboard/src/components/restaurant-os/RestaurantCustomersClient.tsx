"use client";
import { useEffect, useMemo, useState } from "react";
import "./restaurant-ops.css";

type Customer = {
  phone: string; name: string | null; profileName: string | null;
  nameConfirmed: boolean; nameSource: string;
  status: string; lastSeen: string | null; lastOrder: string | null;
  orderCount: number; completed: number; spentCOP: number;
};
type CustomerProfile={
  confirmed_name:string;order_count:number;completed_orders:number;
  completed_spend_cop:number|null;last_confirmed_delivery_address:string|null;
  last_payment_method:string|null;last_order_number:number;
};
type OrderDetail={
  id:string;number:number;customer_name:string;status:string;
  payment_status:string;payment_method:string|null;
  address:string|null;fulfillment_mode:"pickup"|"delivery";
  created_at:string;total_cop:number;
};
type OrderLine={order_id:string;product_name:string;quantity:number;unit_price_cop:number};
type Claim={id:string;order_id:string;category:string;status:string;
  description:string;reported_item_name:string|null;received_item_description:string|null};
type CustomerHistory={
  ok:true;profile:CustomerProfile|null;orders:OrderDetail[];
  lines:OrderLine[];incidents:Claim[];
};
const money = (v: number) => new Intl.NumberFormat("es-CO", {
  style: "currency", currency: "COP", maximumFractionDigits: 0
}).format(v || 0);

export default function RestaurantCustomersClient() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [partial, setPartial] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selected,setSelected]=useState<string|null>(null);
  const [details,setDetails]=useState<CustomerHistory|null>(null);
  const [loadingDetails,setLoadingDetails]=useState(false);
  const [detailsError,setDetailsError]=useState("");
  async function showHistory(customerPhone:string){
    if(selected===customerPhone){setSelected(null);setDetails(null);return;}
    setSelected(customerPhone);setDetails(null);setLoadingDetails(true);setDetailsError("");
    try{
      const response=await fetch("/dashboard-api/restaurant-ops/customers/"+
        encodeURIComponent(customerPhone)+"/history",{
          credentials:"same-origin",cache:"no-store"
        });
      const data=await response.json() as CustomerHistory&{error?:string};
      if(!response.ok||!data.ok)throw new Error(data.error||"HISTORIAL_NO_DISPONIBLE");
      setDetails(data);
    }catch(error){setDetailsError(error instanceof Error?error.message:"Error consultando historial");}
    finally{setLoadingDetails(false);}
  }


  useEffect(() => {
    const controller = new AbortController();
    fetch("/dashboard-api/restaurant-ops/customers", {
      credentials: "same-origin", cache: "no-store", signal: controller.signal
    }).then(async response => {
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.error || "CRM_UNAVAILABLE");
      return json as { customers: Customer[]; partial?: boolean };
    }).then(data => {
      setCustomers(data.customers);
      setPartial(Boolean(data.partial));
      setError("");
    }).catch(err => {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "No disponible");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);
  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("es-CO");
    return q ? customers.filter(c =>
      [c.name, c.profileName, c.phone, c.status].some(x => String(x || "")
        .toLocaleLowerCase("es-CO").includes(q))) : customers;
  }, [customers, search]);
  const identified = customers.filter(c => c.name).length;
  const returning = customers.filter(c => c.orderCount > 1).length;
  return <section className="rops">
    <header className="rops-heading">
      <div><span className="rops-eyebrow">DELIBOCADOS / CRM</span>
        <h1>Clientes y conversaciones</h1>
        <p>Perfiles capturados desde WhatsApp con historial comercial real.</p>
      </div>
      <a href="/panel/operador">Abrir bandeja de conversaciones</a>
    </header>
    {error && <p className="rops-error" role="alert">{error}</p>}
    {partial && <p className="rops-error">Reporte parcial: se alcanzó el límite de pedidos analizados.</p>}
    <div className="rops-metrics">
      <div><span>Contactos</span><strong>{customers.length}</strong></div>
      <div><span>Identificados</span><strong>{identified}</strong></div>
      <div><span>Clientes recurrentes</span><strong>{returning}</strong></div>
      <div><span>Pedidos asociados</span><strong>{customers.reduce((s,c) => s+c.orderCount,0)}</strong></div>
      <div><span>Entregas completadas</span><strong>{customers.reduce((s,c) => s+c.completed,0)}</strong></div>
    </div>
    <div className="rops-card">
      <div className="rops-row"><h2>Directorio CRM</h2>
        <input type="search" placeholder="Buscar nombre o teléfono" aria-label="Buscar clientes"
          value={search} onChange={e => setSearch(e.target.value)}/></div>
      {loading && <p className="rops-muted">Consultando contactos…</p>}
      <div className="rops-table-wrap"><table>
        <thead><tr><th>Cliente</th><th>WhatsApp</th><th>Pedidos</th><th>Entregados</th>
          <th>Total entregado</th><th>Última compra</th><th>Identidad</th><th>Perfil</th></tr></thead>
        <tbody>{filtered.map(c => <tr key={c.phone}>
          <td><strong>{c.name || c.profileName || "Cliente sin identificar"}</strong></td>
          <td>{c.phone}</td><td>{c.orderCount}</td><td>{c.completed}</td>
          <td>{money(c.spentCOP)}</td>
          <td>{c.lastOrder ? new Date(c.lastOrder).toLocaleDateString("es-CO") : "—"}</td>
          <td>{c.nameConfirmed ? "Confirmada" : c.name ? "Provisional" : "Pendiente"}</td>
          <td><button type="button" onClick={()=>void showHistory(c.phone)}>
            {selected===c.phone?"Cerrar":"Ver historial"}
          </button></td>
        </tr>)}</tbody>
      </table></div>
      {!filtered.length && !loading && <p className="rops-empty">No se encontraron clientes.</p>}
    </div>
    {selected&&<section className="rops-card">
      <div className="rops-row"><h2>Historial verificado del cliente</h2>
        <button onClick={()=>{setSelected(null);setDetails(null);}}>Cerrar historial</button></div>
      <p><b>WhatsApp:</b> {selected}. Solo se muestran pedidos que pertenecen a este número.</p>
      {loadingDetails&&<p className="rops-muted">Consultando pedidos y reclamaciones…</p>}
      {detailsError&&<p className="rops-error">{detailsError}</p>}
      {details&&<>
        <div className="rops-settings-metrics">
          <div><b>{details.profile?.order_count??0}</b><span>Pedidos históricos</span></div>
          <div><b>{details.profile?.completed_orders??0}</b><span>Entregas finalizadas</span></div>
          <div><b>{money(details.profile?.completed_spend_cop??0)}</b><span>Total de pedidos completados</span></div>
        </div>
        <p><b>Nombre del último pedido:</b> {details.profile?.confirmed_name??"No confirmado"}</p>
        <p><b>Última dirección utilizada:</b> {details.profile?.last_confirmed_delivery_address??"Sin domicilio confirmado"}</p>
        <p><b>Última forma de pago:</b> {details.profile?.last_payment_method??"No registrada"}</p>
        <div className="rops-cards">{details.orders.map(order=><article className="rops-order" key={order.id}>
          <div className="rops-order-head"><strong>Pedido #{order.number}</strong>
            <span className="rops-pill rops-neutral">{order.status}</span></div>
          <small>{new Date(order.created_at).toLocaleString("es-CO")}</small>
          <p><b>Total:</b> {money(order.total_cop)}</p>
          <p><b>Pago:</b> {order.payment_method??"Sin especificar"} · {order.payment_status}</p>
          <p><b>Modalidad:</b> {order.fulfillment_mode==="delivery"?"Domicilio":"Retiro"}</p>
          {order.address&&<p><b>Dirección:</b> {order.address}</p>}
          <div className="rops-lines">{details.lines.filter(x=>x.order_id===order.id)
            .map((line,i)=><div key={i}><strong>{line.quantity} × {line.product_name}</strong>
              <span>{money(line.quantity*line.unit_price_cop)}</span></div>)}</div>
          {details.incidents.filter(i=>i.order_id===order.id).map(i=>
            <p key={i.id}><b>Reclamo:</b> {i.status} · {i.reported_item_name??i.category} — {i.description}</p>)}
        </article>)}</div>
      </>}
    </section>}
    <p className="rops-footnote">El nombre de WhatsApp es provisional y no equivale a la identidad verificada.
      El importe acumulado utiliza pedidos marcados como entregados, no constituye un extracto contable.</p>
  </section>;
}
