"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  intervalMs?: number;
  label?: string;
};

export function LiveRefresh({
  intervalMs = 2000,
  label = "Datos en vivo",
}: Props) {
  const router = useRouter();
  const [lastUpdated, setLastUpdated] = useState(new Date());

  useEffect(() => {
    let running = false;

    function refresh() {
      if (
        running
        || document.visibilityState !== "visible"
      ) {
        return;
      }

      running = true;
      router.refresh();
      setLastUpdated(new Date());

      window.setTimeout(() => {
        running = false;
      }, 500);
    }

    const timer = window.setInterval(
      refresh,
      intervalMs,
    );

    window.addEventListener(
      "focus",
      refresh,
    );

    document.addEventListener(
      "visibilitychange",
      refresh,
    );

    return () => {
      window.clearInterval(timer);

      window.removeEventListener(
        "focus",
        refresh,
      );

      document.removeEventListener(
        "visibilitychange",
        refresh,
      );
    };
  }, [intervalMs, router]);

  return (
    <div
      title={`Última actualización: ${lastUpdated.toLocaleTimeString("es-AR")}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        color: "#047857",
        background: "#ecfdf5",
        border: "1px solid rgba(16,185,129,.2)",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 850,
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: "#22c55e",
          boxShadow:
            "0 0 0 4px rgba(34,197,94,.12)",
        }}
      />

      {label}
    </div>
  );
}
