"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ButtonLink, PageHeader, SectionHeading, StatusBadge } from "../../../_components/PagePrimitives";

const api = (
  process.env.NEXT_PUBLIC_API_URL || "https://panel.fulanitasfabrica.site/api"
).replace(/\/+$/, "");

type SetupStep = {
  key: string;
  label: string;
  configured: boolean;
  recordedStatus: string;
  productionVerified: boolean;
};
type SetupView = {
  companyId: string;
  prepared: boolean;
  templateVersion: number | null;
  status: string;
  activation: { qr: boolean; posBridge: boolean; fiscal: boolean; kitchenVerified: boolean };
  steps: SetupStep[];
  modules: Record<string, boolean>;
  integrations: Record<string, { registered: boolean; enabled: boolean; status: string }>;
  menu: { products: number; revision: number | null };
  tables: { configured: number; enabled: number };
  pos360Mappings: { reviewed: number; required: number };
  blockers: string[];
  productionReady: boolean;
  productionNotice: string;
};

export default function RestaurantSetupPage() {
  const { companyId } = useParams<{companyId: string}>();
  const [view, setView] = useState<SetupView | null>(null);
  const [loading, setLoading] = useState(true);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const endpoint = api + "/platform/companies/" + encodeURIComponent(companyId) + "/restaurant-setup";
  const refresh = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch(endpoint, {
      credentials: "include", cache: "no-store", signal,
    });
    if (!response.ok) {
      if (response.status === 409) throw new Error("La empresa no está registrada como restaurante.");
      if (response.status === 404) throw new Error("Primero creá la empresa desde Super Admin.");
      throw new Error("No se pudo cargar el despliegue (" + response.status + "). Revisá la migración.");
    }
    const body: { data: SetupView } = await response.json();
    setView(body.data);
  }, [endpoint]);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    refresh(ctrl.signal)
      .catch(err => { if (!ctrl.signal.aborted) setError(String(err?.message || err)); })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
    return () => ctrl.abort();
  }, [refresh]);

  async function prepare() {
    if (preparing) return;
    setPreparing(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(endpoint + "/prepare", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!response.ok) throw new Error("No se pudo preparar la plantilla. No se activó ningún servicio.");
      await refresh();
      setNotice("Plantilla preparada. Los conectores permanecen desactivados.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setPreparing(false);
    }
  }

  const configured = view?.steps.filter(s => s.configured).length ?? 0;
  const total = view?.steps.length ?? 9;

  return (
    <>
      <PageHeader
        kicker="SUPERADMIN / DESPLIEGUE MULTIEMPRESA"
        title={"Restaurante · " + companyId}
        description="Plantilla reutilizable por empresa. Ningún paso activa pagos, POS, WhatsApp, QR o DIAN automáticamente."
        actions={<ButtonLink href="/platform/companies">Volver a empresas</ButtonLink>}
      />
      {loading ? <p>Cargando preparación del restaurante…</p> : null}
      {error ? <p role="alert" style={{color: "#b91c1c"}}>{error}</p> : null}
      {notice ? <p role="status">{notice}</p> : null}

      {view ? (
        <>
          <section className="saas-section">
            <SectionHeading
              title="Estado de aprovisionamiento"
              description="La preparación instala solo registros y opciones desactivadas; la aceptación de producción requiere pruebas verificables."
              aside={<StatusBadge tone="pending">{view.productionReady ? "Aprobado" : "Producción bloqueada"}</StatusBadge>}
            />
            <div className="saas-grid two">
              <article className="saas-card">
                <h3>Plantilla multiempresa</h3>
                <p>Versión: {view.templateVersion ?? "sin preparar"}</p>
                <p>Preparación: {view.prepared ? "registrada" : "pendiente"}</p>
                <p>Condiciones de configuración: {configured}/{total}</p>
                <p>Catálogo: {view.menu.products} productos</p>
                <p>Mesas: {view.tables.enabled}/{view.tables.configured} habilitadas</p>
                <p>Mapeos POS360 revisados: {view.pos360Mappings.reviewed}/{view.pos360Mappings.required}</p>
              </article>
              <article className="saas-card">
                <h3>Seguridad de activación</h3>
                <p>QR público: {view.activation.qr ? "Configurado como activo" : "Desactivado"}</p>
                <p>Puente POS: {view.activation.posBridge ? "Configurado como activo" : "Desactivado"}</p>
                <p>Integración fiscal: {view.activation.fiscal ? "Configurada como activa" : "Desactivada"}</p>
                <p>Cocina verificada: {view.activation.kitchenVerified ? "Sí" : "No"}</p>
                <p>{view.productionNotice}</p>
                <div className="saas-card-actions">
                  <button className="saas-button primary" type="button"
                    disabled={preparing || loading} onClick={prepare}>
                    {preparing ? "Preparando…" : view.prepared ? "Verificar y reparar plantilla" : "Preparar plantilla segura"}
                  </button>
                  <ButtonLink href={"/platform/companies/" + encodeURIComponent(companyId) + "/modules"}>
                    Configurar módulos
                  </ButtonLink>
                </div>
              </article>
            </div>
          </section>

          <section className="saas-section">
            <SectionHeading title="Lista de preparación"
              description="La configuración no equivale a certificación operativa. La aceptación final debe probarse con el equipo real." />
            <div className="saas-grid two">
              {view.steps.map(step => (
                <article className="saas-card" key={step.key}>
                  <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", gap:12}}>
                    <h3>{step.label}</h3>
                    <StatusBadge tone={step.configured ? undefined : "pending"}>
                      {step.configured ? "Configurado" : "Pendiente"}
                    </StatusBadge>
                  </div>
                  <p>Registro técnico: {step.recordedStatus}</p>
                  {step.key === "acceptance" ?
                    <p>El piloto, las impresoras y la idempotencia deben verificarse antes de producción.</p> : null}
                  {step.key === "fiscal" ?
                    <p>La DIAN requiere habilitación y pruebas con proveedor autorizado; registrar el conector no emite facturas.</p> : null}
                </article>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </>
  );
}
