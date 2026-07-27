export function StatusPill({ status }: { status: string }) {
  const isOk = ["online", "configured", "ok"].includes(status);

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        borderRadius: 999,
        padding: "6px 10px",
        fontSize: 12,
        background: isOk ? "rgba(22,163,74,.15)" : "rgba(245,158,11,.15)",
        color: isOk ? "#86efac" : "#fcd34d",
        border: `1px solid ${isOk ? "rgba(134,239,172,.25)" : "rgba(252,211,77,.25)"}`
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: isOk ? "#22c55e" : "#f59e0b",
          boxShadow: `0 0 18px ${isOk ? "#22c55e" : "#f59e0b"}`
        }}
      />
      {status}
    </span>
  );
}
