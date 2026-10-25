import Link from "next/link";

export default function CommercialQualityNotice() {
  return (
    <section
      className="cm-panel"
      style={{
        marginBottom: 24,
      }}
    >
      <div className="cm-panel-heading">
        <div>
          <span className="cm-eyebrow">
            CENTRO DE OPERACIONES
          </span>

          <h2>
            Inteligencia comercial
          </h2>

          <p>
            Información recuperada de conversaciones,
            tareas y expedientes comerciales.
          </p>
        </div>

        <Link
          className="cm-btn cm-btn-secondary"
          href="/crm/pendientes"
        >
          Ver pendientes de espacios
        </Link>
      </div>

      <div
        className="cm-metrics"
        style={{
          gridTemplateColumns:
            "repeat(auto-fit, minmax(170px, 1fr))",
        }}
      >
        <div className="cm-metric">
          <div className="cm-metric-label">
            Expedientes
          </div>

          <p
            style={{
              fontSize: 13,
              color: "#475569",
              marginBottom: 0,
            }}
          >
            Eventos candidatos y su historial.
          </p>
        </div>

        <div className="cm-metric">
          <div className="cm-metric-label">
            Seguimientos
          </div>

          <p
            style={{
              fontSize: 13,
              color: "#475569",
              marginBottom: 0,
            }}
          >
            Tareas comerciales para revisión.
          </p>
        </div>

        <div className="cm-metric">
          <div className="cm-metric-label">
            Relaciones
          </div>

          <p
            style={{
              fontSize: 13,
              color: "#475569",
              marginBottom: 0,
            }}
          >
            Contactos y proveedores por confirmar.
          </p>
        </div>
      </div>

      <div
        className="cm-note"
        style={{
          marginTop: 18,
        }}
      >
        Las observaciones de IA sin respaldo
        textual verificable deben permanecer
        fuera de las decisiones operativas.
        Las asociaciones todavía requieren
        confirmación humana.
      </div>
    </section>
  );
}
