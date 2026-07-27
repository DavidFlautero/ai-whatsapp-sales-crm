export function MetricGrid({ items }: { items: Array<[string, string | number, string]> }) {
  return (
    <section className="metrics">
      {items.map(([title, value, trend]) => (
        <div className="card metric" key={title}>
          <div className="metric-label">{title}</div>
          <div className="metric-value">{value}</div>
          <div className="metric-trend">{trend}</div>
        </div>
      ))}
    </section>
  );
}
