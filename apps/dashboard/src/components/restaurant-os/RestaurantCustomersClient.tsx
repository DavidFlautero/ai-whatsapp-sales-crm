"use client";
import { useEffect, useMemo, useState } from "react";
import "./restaurant-ops.css";

type Customer = {
  phone: string; name: string | null; profileName: string | null;
  nameConfirmed: boolean; nameSource: string;
  status: string; lastSeen: string | null; lastOrder: string | null;
  orderCount: number; completed: number; spentCOP: number;
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
          <th>Total entregado</th><th>Última compra</th><th>Identidad</th></tr></thead>
        <tbody>{filtered.map(c => <tr key={c.phone}>
          <td><strong>{c.name || c.profileName || "Cliente sin identificar"}</strong></td>
          <td>{c.phone}</td><td>{c.orderCount}</td><td>{c.completed}</td>
          <td>{money(c.spentCOP)}</td>
          <td>{c.lastOrder ? new Date(c.lastOrder).toLocaleDateString("es-CO") : "—"}</td>
          <td>{c.nameConfirmed ? "Confirmada" : c.name ? "Provisional" : "Pendiente"}</td>
        </tr>)}</tbody>
      </table></div>
      {!filtered.length && !loading && <p className="rops-empty">No se encontraron clientes.</p>}
    </div>
    <p className="rops-footnote">El nombre de WhatsApp es provisional y no equivale a la identidad verificada.
      El importe acumulado utiliza pedidos marcados como entregados, no constituye un extracto contable.</p>
  </section>;
}
