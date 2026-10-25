"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

type Coverage = {
  totalMessages: number;
  withReadableText: number;
  eligibleForAI: number;
  eligibleWithoutReceipt: number;
  analyzedReceipts: number;
  skippedReceipts: number;
  unsupportedReceipts: number;
  observations: number;
  linkedToCases: number;
  unknownWithText: number;
};

type CoverageResponse = {
  generatedAt: string;
  coverage: Coverage;
  messageTypes: Record<string, number>;
};

function percent(
  numerator: number,
  denominator: number,
) {
  if (!denominator) return 0;

  return Math.min(
    100,
    Math.max(
      0,
      Math.round(
        numerator / denominator * 100
      ),
    ),
  );
}

function Metric({
  label,
  value,
  description,
}: {
  label: string;
  value: number;
  description?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="text-sm text-slate-500">
        {label}
      </div>

      <div className="mt-2 text-2xl font-semibold text-slate-900">
        {value.toLocaleString("es-ES")}
      </div>

      {description && (
        <p className="mt-2 text-xs text-slate-500">
          {description}
        </p>
      )}
    </div>
  );
}

export default function CommercialCoveragePanel() {
  const [data, setData] =
    useState<CoverageResponse | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        "/api/crm/commercial-memory/coverage",
        {
          credentials: "include",
          cache: "no-store",
        },
      );

      if (!response.ok) {
        throw new Error(
          `No disponible: HTTP ${response.status}`,
        );
      }

      const result =
        await response.json() as CoverageResponse;

      setData(result);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo cargar la cobertura",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <section className="rounded-xl border bg-white p-6">
        <h2 className="font-semibold">
          Cobertura histórica de WhatsApp
        </h2>

        <p className="mt-3 text-sm text-slate-500">
          Consultando mensajes y análisis de IA...
        </p>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="rounded-xl border border-amber-200 bg-amber-50 p-6">
        <h2 className="font-semibold text-amber-900">
          Cobertura histórica no disponible
        </h2>

        <p className="mt-2 text-sm text-amber-800">
          {error || "Sin datos"}
        </p>
      </section>
    );
  }

  const c = data.coverage;

  const aiCoverage = percent(
    c.analyzedReceipts,
    c.eligibleForAI,
  );

  const caseCoverage = percent(
    c.linkedToCases,
    c.totalMessages,
  );

  return (
    <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            Cobertura histórica de WhatsApp
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Estado real de los mensajes guardados,
            interpretados y asociados a expedientes.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border px-4 py-2 text-sm"
        >
          Actualizar cobertura
        </button>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Mensajes originales"
          value={c.totalMessages}
          description="Registros disponibles en la base de datos."
        />

        <Metric
          label="Mensajes con texto extraíble"
          value={c.withReadableText}
          description="Texto conversacional recuperable sin procesamiento multimedia."
        />

        <Metric
          label="Análisis de IA completados"
          value={c.analyzedReceipts}
          description="Mensajes con análisis contextual registrado."
        />

        <Metric
          label="Pendientes de análisis textual"
          value={c.eligibleWithoutReceipt}
          description="No incluye imágenes, audios y vídeos que requieren procesamiento especializado."
        />

        <Metric
          label="Observaciones comerciales"
          value={c.observations}
        />

        <Metric
          label="Vinculados a expedientes"
          value={c.linkedToCases}
        />

        <Metric
          label="Omitidos"
          value={c.skippedReceipts}
        />

        <Metric
          label="Tipo desconocido con texto"
          value={c.unknownWithText}
        />
      </div>

      <div className="space-y-5">
        <div>
          <div className="mb-2 flex justify-between text-sm">
            <span>Cobertura de análisis con IA</span>
            <strong>{aiCoverage}%</strong>
          </div>

          <div className="h-3 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-blue-600"
              style={{ width: `${aiCoverage}%` }}
            />
          </div>
        </div>

        <div>
          <div className="mb-2 flex justify-between text-sm">
            <span>
              Mensajes asociados a expedientes
            </span>

            <strong>{caseCoverage}%</strong>
          </div>

          <div className="h-3 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-emerald-600"
              style={{ width: `${caseCoverage}%` }}
            />
          </div>
        </div>
      </div>

      <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
        La cobertura de IA mide análisis registrados,
        no reservas confirmadas. Las asociaciones
        comerciales deben validarse antes de convertirse
        en asignaciones definitivas.
      </div>
    </section>
  );
}
