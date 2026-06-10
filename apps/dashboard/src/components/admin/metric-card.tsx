export function MetricCard({
  title,
  value,
  subtitle
}: {
  title: string;
  value: string | number;
  subtitle?: string;
}) {
  return (
    <div
      style={{
        background: "linear-gradient(180deg, rgba(255,255,255,.08), rgba(255,255,255,.03))",
        border: "1px solid rgba(255,255,255,.12)",
        borderRadius: 20,
        padding: 20,
        boxShadow: "0 20px 80px rgba(0,0,0,.35)"
      }}
    >
      <div style={{ color: "#94a3b8", fontSize: 13 }}>{title}</div>
      <div style={{ color: "white", fontSize: 34, fontWeight: 700, marginTop: 10 }}>{value}</div>
      {subtitle ? <div style={{ color: "#64748b", fontSize: 12, marginTop: 8 }}>{subtitle}</div> : null}
    </div>
  );
}
