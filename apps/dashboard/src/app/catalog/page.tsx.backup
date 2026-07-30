import { getAdminOverview } from "../../lib/api";
import { AppShell } from "../../components/app-shell/AppShell";
import { Header } from "../../components/ui/Header";

export default async function CatalogPage() {
  const data = await getAdminOverview();
  const catalogProducts = data.catalogProducts ?? [];
  const knowledgeItems = data.knowledgeItems ?? [];

  return (
    <AppShell>
      <Header kicker="CATALOG INTELLIGENCE" title="Catálogo Inteligente" description="Productos, stock, talles, colores y base de conocimiento para la IA." action={<button className="btn">Agregar producto</button>} />

      <section className="section card panel">
        <table className="table">
          <thead><tr><th>Producto</th><th>Categoría</th><th>Color</th><th>Talle</th><th>Stock</th></tr></thead>
          <tbody>
            {catalogProducts.length === 0 ? <tr><td colSpan={5}>Sin productos cargados.</td></tr> :
              catalogProducts.map((p: any, i: number) => (
                <tr key={p.id ?? i}>
                  <td><strong>{p.name}</strong><br /><span className="muted small">{p.sku}</span></td>
                  <td>{p.category ?? "-"}</td>
                  <td>{p.color ?? "-"}</td>
                  <td>{p.size ?? "-"}</td>
                  <td>{p.stock ?? 0}</td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </section>

      <section className="section card panel">
        <div className="panel-title">Knowledge Base</div>
        <div className="chat-list" style={{ marginTop: 18 }}>
          {knowledgeItems.length === 0 ? <div className="muted">Sin conocimiento cargado.</div> :
            knowledgeItems.map((k: any) => (
              <div className="chat-item" key={k.id ?? k.title}>
                <div className="avatar">K</div>
                <div>
                  <strong>{k.title}</strong>
                  <div className="muted small">{k.type} · {(k.tags ?? []).join(", ")}</div>
                  <div style={{ marginTop: 6 }}>{String(k.content).slice(0, 160)}...</div>
                </div>
                <span className="temperature warm">active</span>
              </div>
            ))
          }
        </div>
      </section>
    </AppShell>
  );
}
