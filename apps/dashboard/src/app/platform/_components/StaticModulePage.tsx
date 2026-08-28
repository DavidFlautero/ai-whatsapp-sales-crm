import { Metric, PageHeader, SectionHeading, StatusBadge } from "./PagePrimitives";

type Card = {
  title: string;
  description: string;
  status?: string;
};

type Row = {
  name: string;
  detail: string;
  status: string;
};

export function StaticModulePage({
  kicker,
  title,
  description,
  metrics,
  cards,
  rows,
}: {
  kicker: string;
  title: string;
  description: string;
  metrics: Array<[string, string, string, "success" | "warning" | "danger" | undefined]>;
  cards: Card[];
  rows: Row[];
}) {
  return (
    <>
      <PageHeader kicker={kicker} title={title} description={description} />
      <section className="saas-metrics">
        {metrics.map(([label, value, detail, tone]) => (
          <Metric key={label} label={label} value={value} detail={detail} tone={tone} />
        ))}
      </section>
      <section className="saas-section">
        <SectionHeading title="Vista ejecutiva" description="Información organizada para administración, presentación y seguimiento comercial." />
        <div className="saas-grid">
          {cards.map((card) => (
            <article className="saas-card" key={card.title}>
              <div className="saas-card-top"><h3>{card.title}</h3>{card.status ? <StatusBadge tone="neutral">{card.status}</StatusBadge> : null}</div>
              <p>{card.description}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="saas-section">
        <SectionHeading title="Detalle operativo" description="Vista preparada para recibir información real del backend de la plataforma." />
        <div className="saas-table-wrap">
          <table className="saas-table">
            <thead><tr><th>Elemento</th><th>Detalle</th><th>Estado</th></tr></thead>
            <tbody>{rows.map((row) => <tr key={row.name}><td><strong>{row.name}</strong></td><td>{row.detail}</td><td><StatusBadge tone={row.status === "Operativo" || row.status === "Activo" ? "success" : "neutral"}>{row.status}</StatusBadge></td></tr>)}</tbody>
          </table>
        </div>
      </section>
    </>
  );
}
