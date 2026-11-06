"use client";

import { useEffect, useState } from "react";
import { ButtonLink, PageHeader, SectionHeading, StatusBadge } from "../_components/PagePrimitives";

const apiUrl = (process.env.NEXT_PUBLIC_API_URL || "https://panel.fulanitasfabrica.site/api").replace(/\/+$/, "");

type Company = { id: string; name: string; active: boolean; robot?: { status?: string }; subscription?: { plan?: string; currency?: string; monthlyPrice?: number } };

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${apiUrl}/platform/companies`, { credentials: "include", cache: "no-store", signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error("No se pudo cargar el listado de empresas.");
        const body = await res.json();
        setCompanies(Array.isArray(body.data) ? body.data : []);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Error inesperado");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  return (
    <>
      <PageHeader kicker="EMPRESAS ASOCIADAS" title="Clientes y operaciones" description="Empresas registradas y estado real de activación." actions={<ButtonLink href="/platform/companies/new" kind="primary">+ Agregar empresa</ButtonLink>} />
      <section className="saas-section" style={{ marginTop: 0 }}>
        <SectionHeading title="Empresas registradas" description="Datos cargados desde el servicio de plataforma." aside={<StatusBadge>{`${companies.length} registradas`}</StatusBadge>} />
        {loading ? <p>Cargando empresas…</p> : null}
        {error ? <p role="alert">{error}</p> : null}
        {!loading && !error ? (
          <div className="saas-grid two">
            {companies.map((company) => (
              <article className="saas-card saas-company-card" key={company.id}>
                <div className="saas-company-head">
                  <span className="saas-company-logo">{company.name.slice(0, 1).toUpperCase()}</span>
                  <div><StatusBadge tone={company.active ? undefined : "pending"}>{company.active ? "Activa" : "Pendiente"}</StatusBadge><h3>{company.name}</h3><p>{company.id}</p></div>
                </div>
                <div className="saas-list">
                  <div className="saas-list-row"><span>Robot</span><strong>{company.robot?.status || "pending"}</strong></div>
                  <div className="saas-list-row"><span>Plan</span><strong>{company.subscription?.plan || "Sin plan"}</strong></div>
                </div>
                <div className="saas-card-actions"><ButtonLink href={`/platform/companies/${encodeURIComponent(company.id)}/modules`} kind="primary">Servicios y módulos</ButtonLink></div>
                {company.id === "fulanitas" ? <div className="saas-card-actions"><ButtonLink href="/platform/companies/fulanitas" kind="primary">Abrir empresa</ButtonLink></div> : <p>Configuración y acceso del propietario pendientes de activación.</p>}
              </article>
            ))}
            <article className="saas-empty"><div><strong>Nueva empresa</strong><p>Crear un registro independiente en PostgreSQL.</p><div className="saas-card-actions"><ButtonLink href="/platform/companies/new">Agregar empresa</ButtonLink></div></div></article>
          </div>
        ) : null}
      </section>
    </>
  );
}
