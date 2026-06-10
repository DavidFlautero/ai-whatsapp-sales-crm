import { getAdminOverview } from "../../lib/api";
import { AppShell } from "../../components/app-shell/AppShell";
import { Header } from "../../components/ui/Header";

function tempClass(value?: string) {
  if (value === "hot") return "hot";
  if (value === "cold") return "cold";
  return "warm";
}

export default async function CRMPage() {
  const data = await getAdminOverview();
  const contacts = data.contacts ?? [];

  return (
    <AppShell>
      <Header
        kicker="CUSTOMER RELATIONSHIP MANAGEMENT"
        title="CRM Comercial"
        description="Contactos, temperatura comercial, estado de lead y último mensaje recibido."
        action={<a className="btn" href="http://localhost:4000/admin/reports/contacts.csv">Exportar CSV</a>}
      />

      <section className="section card panel">
        <table className="table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Teléfono</th>
              <th>Estado</th>
              <th>Temperatura</th>
              <th>Último mensaje</th>
            </tr>
          </thead>
          <tbody>
            {contacts.length === 0 ? <tr><td colSpan={5}>Sin contactos.</td></tr> :
              contacts.map((c: any) => (
                <tr key={c.phone}>
                  <td><strong>{c.name ?? "Cliente WhatsApp"}</strong></td>
                  <td>{c.phone}</td>
                  <td>{c.status ?? "lead"}</td>
                  <td><span className={`temperature ${tempClass(c.temperature)}`}>{c.temperature ?? "warm"}</span></td>
                  <td>{c.last_message ?? "-"}</td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </section>
    </AppShell>
  );
}
