import { AppShell } from "../../components/app-shell/AppShell";
import { Header } from "../../components/ui/Header";

const agents = [
  {
    name: "Sales Agent",
    location: "services/agent",
    role: "Atiende clientes por WhatsApp, entiende intención comercial y genera respuestas humanas.",
    result: "Convierte conversaciones en oportunidades comerciales."
  },
  {
    name: "Memory Agent",
    location: "services/memory",
    role: "Guarda preferencias, productos, objeciones y señales del cliente.",
    result: "Permite respuestas personalizadas y continuidad comercial."
  },
  {
    name: "Recovery Agent",
    location: "services/recovery",
    role: "Detecta clientes antiguos o fríos y genera mensajes de recontactación.",
    result: "Recupera clientes dormidos y oportunidades perdidas."
  },
  {
    name: "Predictive Agent",
    location: "services/predictive",
    role: "Calcula probabilidad de compra, valor estimado y riesgo de abandono.",
    result: "Prioriza los leads con más posibilidad de venta."
  },
  {
    name: "Semantic Agent",
    location: "services/semantic",
    role: "Detecta urgencia, intención, sensibilidad a precio y tipo de cliente.",
    result: "Clasifica señales comerciales automáticamente."
  },
  {
    name: "Catalog Agent",
    location: "services/catalog",
    role: "Busca productos, talles, colores, stock y contexto de catálogo.",
    result: "Respuestas más precisas sobre productos."
  },
  {
    name: "Governance Agent",
    location: "services/governance",
    role: "Audita respuestas, detecta mensajes débiles o riesgosos.",
    result: "Control operacional y trazabilidad del comportamiento IA."
  },
  {
    name: "Quality Agent",
    location: "services/quality",
    role: "Evalúa claridad, empatía, persuasión y avance comercial.",
    result: "Mejora continua de la calidad conversacional."
  }
];

export default function SettingsPage() {
  return (
    <AppShell>
      <Header
        kicker="PROGRAM INTELLIGENCE PROFILE"
        title="Settings & System Profile"
        description="Descripción técnica y operativa del sistema, agentes IA, ubicación lógica y resultados esperados."
      />

      <section className="section card panel">
        <div className="panel-title">Perfil del programa</div>
        <div className="muted" style={{ marginTop: 16, lineHeight: 1.8 }}>
          <strong>Neuromind Commerce OS</strong> es una plataforma comercial con IA para WhatsApp.
          Su objetivo es centralizar conversaciones, CRM, memoria comercial, catálogo,
          seguimiento, recuperación de clientes, campañas y analítica predictiva.
          <br /><br />
          El sistema actúa como un conjunto coordinado de agentes IA. Cada agente cumple una función
          específica y todos alimentan el resultado final: atención comercial más humana,
          seguimiento más preciso y más oportunidades de venta.
        </div>
      </section>

      <section className="section card panel">
        <div className="panel-head">
          <div>
            <div className="panel-title">Mapa de agentes IA</div>
            <div className="muted small" style={{ marginTop: 6 }}>
              Qué hace cada agente, dónde vive y qué resultado entrega.
            </div>
          </div>
          <span className="pill">agent map</span>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>Agente</th>
              <th>Ubicación</th>
              <th>Actúa en</th>
              <th>Resultado</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((agent) => (
              <tr key={agent.name}>
                <td><strong>{agent.name}</strong></td>
                <td>{agent.location}</td>
                <td>{agent.role}</td>
                <td>{agent.result}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="section grid-main">
        <div className="card panel">
          <div className="panel-title">Configuración comercial</div>
          <div className="form-grid" style={{ marginTop: 18 }}>
            <input className="input" defaultValue="Empresa: Fulanitas" />
            <input className="input" defaultValue="Modo IA: automático" />
            <input className="input" defaultValue="Canal principal: WhatsApp Cloud API" />
            <input className="input" defaultValue="Base de datos: Supabase PostgreSQL" />
            <button className="btn">Guardar settings</button>
          </div>
        </div>

        <div className="card panel">
          <div className="panel-title">Resultado esperado</div>
          <div className="muted" style={{ marginTop: 16, lineHeight: 1.8 }}>
            • Menos tiempo respondiendo WhatsApp.<br />
            • Más seguimiento comercial.<br />
            • Mejor recuperación de clientes antiguos.<br />
            • CRM ordenado automáticamente.<br />
            • Respuestas más humanas con contexto.<br />
            • Priorización de leads calientes.<br />
            • Control y auditoría del comportamiento IA.<br />
            • Base para operar múltiples empresas desde Neuromind.
          </div>
        </div>
      </section>
    </AppShell>
  );
}
