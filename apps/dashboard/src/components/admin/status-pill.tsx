type StatusTone = "ok" | "warning" | "error" | "neutral";

function getTone(status: string): StatusTone {
  if (["online", "configured", "ok"].includes(status)) return "ok";
  if (["degraded", "missing_config", "pending"].includes(status)) return "warning";
  if (["invalid_credentials", "invalid_config", "unreachable", "error"].includes(status)) {
    return "error";
  }
  return "neutral";
}

const statusLabels: Record<string, string> = {
  online: "Conectado",
  configured: "Configurado",
  ok: "Correcto",
  degraded: "Limitado",
  missing_config: "Falta configurar",
  pending: "Pendiente",
  invalid_credentials: "Credenciales inválidas",
  invalid_config: "Configuración inválida",
  unreachable: "Sin respuesta",
  error: "Error"
};

const palette: Record<StatusTone, { background: string; color: string; border: string; dot: string }> = {
  ok: {
    background: "rgba(22,163,74,.15)",
    color: "#86efac",
    border: "rgba(134,239,172,.25)",
    dot: "#22c55e"
  },
  warning: {
    background: "rgba(245,158,11,.15)",
    color: "#fcd34d",
    border: "rgba(252,211,77,.25)",
    dot: "#f59e0b"
  },
  error: {
    background: "rgba(239,68,68,.15)",
    color: "#fca5a5",
    border: "rgba(252,165,165,.25)",
    dot: "#ef4444"
  },
  neutral: {
    background: "rgba(100,116,139,.15)",
    color: "#cbd5e1",
    border: "rgba(203,213,225,.2)",
    dot: "#94a3b8"
  }
};

export function StatusPill({ status }: { status: string }) {
  const colors = palette[getTone(status)];

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        borderRadius: 999,
        padding: "6px 10px",
        fontSize: 12,
        background: colors.background,
        color: colors.color,
        border: `1px solid ${colors.border}`
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: colors.dot,
          boxShadow: `0 0 18px ${colors.dot}`
        }}
      />
      {statusLabels[status] ?? status}
    </span>
  );
}
