import Link from "next/link";
import { AppShell } from "../../components/app-shell/AppShell";
import { Header } from "../../components/ui/Header";
import styles from "./Settings.module.css";

const agents = [
  {
    name: "Sales Agent",
    category: "Ventas",
    location: "services/agent",
    role: "Atiende conversaciones, interpreta intención comercial y prepara respuestas con contexto.",
    result: "Convierte consultas en oportunidades y próximos pasos concretos."
  },
  {
    name: "Memory Agent",
    category: "Contexto",
    location: "services/memory",
    role: "Conserva preferencias, productos consultados, objeciones y señales relevantes del cliente.",
    result: "Da continuidad comercial sin obligar al cliente a repetir información."
  },
  {
    name: "Recovery Agent",
    category: "Seguimiento",
    location: "services/recovery",
    role: "Detecta clientes inactivos y prepara recontactaciones según historial e interés.",
    result: "Recupera conversaciones dormidas y oportunidades que quedaron abiertas."
  },
  {
    name: "Predictive Agent",
    category: "Prioridad",
    location: "services/predictive",
    role: "Estima probabilidad de compra, valor potencial y riesgo de abandono.",
    result: "Ordena el trabajo comercial según oportunidad y urgencia."
  },
  {
    name: "Semantic Agent",
    category: "Análisis",
    location: "services/semantic",
    role: "Identifica urgencia, intención, sensibilidad al precio y tipo de cliente.",
    result: "Clasifica señales comerciales para orientar la respuesta."
  },
  {
    name: "Catalog Agent",
    category: "Producto",
    location: "services/catalog",
    role: "Consulta productos, variantes, disponibilidad, precio y contexto de catálogo.",
    result: "Entrega respuestas precisas sobre lo que realmente puede venderse."
  },
  {
    name: "Governance Agent",
    category: "Control",
    location: "services/governance",
    role: "Audita decisiones, detecta riesgos y registra el comportamiento operativo del sistema.",
    result: "Aporta trazabilidad y límites claros para la automatización."
  },
  {
    name: "Quality Agent",
    category: "Calidad",
    location: "services/quality",
    role: "Evalúa claridad, empatía, persuasión y avance comercial de cada conversación.",
    result: "Permite corregir respuestas débiles y mejorar el desempeño del agente."
  }
];

const summary = [
  ["Empresa", "Fulanitas", "Operación comercial principal"],
  ["Canal", "WhatsApp Cloud API", "Recepción y respuesta de mensajes"],
  ["Motor", "Claude", "Razonamiento y generación de respuestas"],
  ["Datos", "Supabase PostgreSQL", "Persistencia pendiente de credenciales"]
];

const outcomes = [
  "Reducir el tiempo dedicado a respuestas repetitivas.",
  "Mantener seguimiento comercial con contexto.",
  "Recuperar clientes y conversaciones inactivas.",
  "Ordenar automáticamente contactos, mensajes y oportunidades.",
  "Priorizar leads con mayor probabilidad de compra.",
  "Auditar la operación y el comportamiento del agente."
];

export default function SettingsPage() {
  return (
    <AppShell>
      <main className={styles.page}>
        <Header
          kicker="OPERACIÓN Y CONTROL"
          title="Configuración del sistema"
          description="Perfil operativo de Neuromind Commerce OS: alcance, responsabilidades de cada agente y estado de la arquitectura comercial."
        />

        <section className={styles.summaryGrid} aria-label="Resumen del sistema">
          {summary.map(([label, value, meta]) => (
            <article className={styles.summaryCard} key={label}>
              <div className={styles.summaryLabel}>{label}</div>
              <div className={styles.summaryValue}>{value}</div>
              <div className={styles.summaryMeta}>{meta}</div>
            </article>
          ))}
        </section>

        <section className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div>
              <div className={styles.eyebrow}>Perfil operativo</div>
              <h2 className={styles.sectionTitle}>Qué es y cómo trabaja el sistema</h2>
              <p className={styles.sectionDescription}>
                Una definición útil para operación, soporte y futuras ampliaciones del producto.
              </p>
            </div>
            <span className={styles.statusBadge}>Arquitectura activa</span>
          </div>

          <div className={styles.profileText}>
            <div className={styles.profileCopy}>
              <strong>Neuromind Commerce OS</strong> centraliza atención por WhatsApp, memoria comercial,
              catálogo, seguimiento, recuperación de clientes y analítica. El sistema no funciona como
              un único bot: coordina responsabilidades especializadas y reúne sus resultados antes de
              ejecutar una acción comercial.
              <br /><br />
              La prioridad es mantener una operación comprensible, auditable y útil para el equipo:
              menos automatización decorativa y más decisiones que puedan revisarse, medirse y corregirse.
            </div>

            <div className={styles.principles}>
              <div className={styles.principle}>Cada agente tiene una responsabilidad definida.</div>
              <div className={styles.principle}>Las decisiones relevantes dejan trazabilidad.</div>
              <div className={styles.principle}>El contexto del cliente se conserva entre conversaciones.</div>
              <div className={styles.principle}>La automatización puede derivar casos a una persona.</div>
            </div>
          </div>
        </section>

        <section className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div>
              <div className={styles.eyebrow}>Arquitectura funcional</div>
              <h2 className={styles.sectionTitle}>Responsabilidades de los agentes</h2>
              <p className={styles.sectionDescription}>
                La tabla muestra qué hace cada módulo, dónde vive y qué entrega a la operación comercial.
              </p>
            </div>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.agentTable}>
              <thead>
                <tr>
                  <th className={styles.tableHead}>Agente</th>
                  <th className={styles.tableHead}>Implementación</th>
                  <th className={styles.tableHead}>Responsabilidad</th>
                  <th className={styles.tableHead}>Resultado operativo</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((agent) => (
                  <tr key={agent.name}>
                    <td>
                      <div className={styles.agentName}>
                        {agent.name}
                        <span className={styles.categoryBadge}>{agent.category}</span>
                      </div>
                    </td>
                    <td><span className={styles.codeBadge}>{agent.location}</span></td>
                    <td>{agent.role}</td>
                    <td>{agent.result}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={styles.bottomGrid}>
          <article className={styles.sectionCard} style={{ marginTop: 0 }}>
            <div className={styles.eyebrow}>Configuración comercial</div>
            <h2 className={styles.sectionTitle}>Parámetros principales</h2>

            <div className={styles.configList}>
              <div className={styles.configRow}>
                <span className={styles.configKey}>Empresa</span>
                <span className={styles.configValue}>Fulanitas</span>
                <span className={styles.configState}>Definida</span>
              </div>
              <div className={styles.configRow}>
                <span className={styles.configKey}>Modo operativo</span>
                <span className={styles.configValue}>Automático con control humano</span>
                <span className={styles.configState}>Activo</span>
              </div>
              <div className={styles.configRow}>
                <span className={styles.configKey}>Canal principal</span>
                <span className={styles.configValue}>WhatsApp Cloud API</span>
                <span className={styles.configState}>Token pendiente</span>
              </div>
              <div className={styles.configRow}>
                <span className={styles.configKey}>Base de datos</span>
                <span className={styles.configValue}>Supabase PostgreSQL</span>
                <span className={styles.configState}>Credenciales pendientes</span>
              </div>
              <div className={styles.configRow}>
                <span className={styles.configKey}>Inventario</span>
                <span className={styles.configValue}>Ninox</span>
                <span className={styles.configState}>API key pendiente</span>
              </div>
            </div>

            <Link className={styles.linkButton} href="/integrations">
              Revisar conexiones
            </Link>

            <div className={styles.note}>
              Esta pantalla describe la configuración. Las credenciales se administran únicamente en el
              servidor y su validez se comprueba desde la sección Integraciones.
            </div>
          </article>

          <article className={styles.sectionCard} style={{ marginTop: 0 }}>
            <div className={styles.eyebrow}>Objetivos de operación</div>
            <h2 className={styles.sectionTitle}>Resultados esperados</h2>

            <div className={styles.outcomeList}>
              {outcomes.map((outcome, index) => (
                <div className={styles.outcomeItem} key={outcome}>
                  <span className={styles.outcomeNumber}>{String(index + 1).padStart(2, "0")}</span>
                  <span>{outcome}</span>
                </div>
              ))}
            </div>
          </article>
        </section>
      </main>
    </AppShell>
  );
}
