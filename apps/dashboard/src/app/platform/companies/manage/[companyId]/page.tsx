"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ButtonLink, PageHeader, SectionHeading, StatusBadge } from "../../../_components/PagePrimitives";

type Domain = {
  company_id: string;
  purpose: "menu" | "panel";
  kind: "custom" | "subdomain";
  hostname: string;
  status: "pending_dns" | "dns_verified" | "active" | "error";
  verified_at: string | null;
};
type Company = {
  id: string;
  name: string;
  active: boolean;
  currency: string | null;
  usersCount: number;
  domain: string | null;
  ownerEmail?: string | null;
  domains?: Domain[];
};

export default function ManageCompanyPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const [company, setCompany] = useState<Company | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [hostname, setHostname] = useState("");
  const [kind, setKind] = useState<"custom" | "subdomain">("custom");
  const [purpose, setPurpose] = useState<"menu" | "panel">("menu");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");

  const base = "/api/platform/companies/" + encodeURIComponent(companyId);
  const load = useCallback(async () => {
    const response = await fetch(base, { credentials: "include", cache: "no-store" });
    const body = await response.json();
    if (!response.ok || !body.ok || !body.data) throw new Error("No se pudo consultar la empresa.");
    const data = body.data as Company;
    setCompany(data);
    setOwnerEmail(data.ownerEmail ?? "");
    const saved = data.domains?.find(d => d.purpose === "menu");
    if (saved) { setHostname(saved.hostname); setKind(saved.kind); setPurpose(saved.purpose); }
  }, [base]);

  useEffect(() => {
    let alive = true;
    load().catch(() => { if (alive) setError("No se pudo consultar la empresa."); });
    return () => { alive = false; };
  }, [load]);

  async function request(url: string, method: "PUT" | "POST", payload?: unknown) {
    const response = await fetch(url, {
      method, credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: payload ? JSON.stringify(payload) : undefined,
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.ok) throw new Error(body?.error || "Error al guardar.");
    return body.data;
  }

  async function saveDomain(event: FormEvent) {
    event.preventDefault();
    setNotice(""); setBusy("domain");
    try {
      await request(base + "/domain", "PUT", { hostname: hostname.trim().toLowerCase(), kind, purpose });
      await load();
      setNotice("Dominio registrado. Está pendiente de comprobar DNS y activar HTTPS.");
    } catch (e) { setNotice(e instanceof Error ? e.message : "No se pudo registrar el dominio."); }
    finally { setBusy(""); }
  }

  async function verifyDns() {
    setNotice(""); setBusy("dns");
    try {
      const result = await request(base + "/domain/" + encodeURIComponent(purpose) + "/verify", "POST");
      await load();
      setNotice(result.verified
        ? "DNS correcto. Falta configurar y validar HTTPS antes de activar el dominio."
        : "DNS pendiente. Agregá o corregí el registro A que apunte a " + result.expectedIp + ".");
    } catch (e) { setNotice(e instanceof Error ? e.message : "No se pudo comprobar DNS."); }
    finally { setBusy(""); }
  }

  async function saveOwner(event: FormEvent) {
    event.preventDefault();
    setNotice(""); setBusy("owner");
    try {
      await request(base + "/owner", "PUT", {
        email: ownerEmail.trim().toLowerCase(),
        ...(ownerPassword ? { password: ownerPassword } : {}),
      });
      setOwnerPassword("");
      await load();
      setNotice("Acceso del propietario actualizado. El superadmin no fue modificado.");
    } catch (e) { setNotice(e instanceof Error ? e.message : "No se pudo actualizar el propietario."); }
    finally { setBusy(""); }
  }

  const statusText: Record<Domain["status"], string> = {
    pending_dns: "Pendiente de DNS",
    dns_verified: "DNS correcto · HTTPS pendiente",
    active: "Activo",
    error: "Error de configuración",
  };
  return <>
    <PageHeader kicker="ADMINISTRACIÓN DE EMPRESAS" title={company?.name ?? "Empresa"}
      description="Propietario, dominios y acceso desde el superadmin."
      actions={<ButtonLink href="/platform/companies">Volver a empresas</ButtonLink>} />

    {error && <p role="alert">{error}</p>}
    {notice && <p role="status" className="saas-callout">{notice}</p>}

    {company && <>
      <section className="saas-section">
        <SectionHeading title="Empresa registrada" description="Datos independientes por cliente." />
        <article className="saas-card">
          <div className="saas-list">
            <div className="saas-list-row"><span>Identificador</span><strong>{company.id}</strong></div>
            <div className="saas-list-row"><span>Estado</span><StatusBadge>{company.active ? "Activa" : "Inactiva"}</StatusBadge></div>
            <div className="saas-list-row"><span>Moneda</span><strong>{company.currency ?? "Sin configurar"}</strong></div>
            <div className="saas-list-row"><span>Usuarios</span><strong>{company.usersCount}</strong></div>
          </div>
        </article>
      </section>

      <section className="saas-section">
        <SectionHeading title="Acceso del propietario"
          description="Correo y contraseña exclusivos de esta empresa; nunca utilizar el correo del superadmin." />
        <article className="saas-card">
          <form className="saas-form" onSubmit={saveOwner}>
            <div className="saas-form-grid">
              <div className="saas-field full">
                <label htmlFor="ownerEmail">Correo del propietario</label>
                <input id="ownerEmail" type="email" autoComplete="off" required maxLength={200}
                  value={ownerEmail} onChange={e => setOwnerEmail(e.target.value)} />
              </div>
              <div className="saas-field full">
                <label htmlFor="ownerPassword">Nueva contraseña (opcional, 12 caracteres mínimo)</label>
                <input id="ownerPassword" type="password" autoComplete="new-password"
                  value={ownerPassword} minLength={12} onChange={e => setOwnerPassword(e.target.value)} />
              </div>
            </div>
            <button className="saas-button primary" type="submit" disabled={!!busy}>
              {busy === "owner" ? "Guardando…" : "Guardar acceso del propietario"}
            </button>
          </form>
        </article>
      </section>

      <section className="saas-section">
        <SectionHeading title="Dominio y subdominio"
          description="Registrá el dominio del cliente. La publicación y el certificado HTTPS se activan solo después de verificarlos." />
        <article className="saas-card">
          <form className="saas-form" onSubmit={saveDomain}>
            <div className="saas-form-grid">
              <div className="saas-field">
                <label htmlFor="domainKind">Tipo de dominio</label>
                <select id="domainKind" value={kind} onChange={e => setKind(e.target.value as typeof kind)}>
                  <option value="custom">Dominio propio</option><option value="subdomain">Subdominio de la plataforma</option>
                </select>
              </div>
              <div className="saas-field">
                <label htmlFor="domainPurpose">¿Para qué se utilizará?</label>
                <select id="domainPurpose" value={purpose} onChange={e => {
                  const p = e.target.value as "menu" | "panel";
                  setPurpose(p);
                  const saved = company.domains?.find(d => d.purpose === p);
                  setHostname(saved?.hostname ?? "");
                  setKind(saved?.kind ?? "custom");
                }}>
                  <option value="menu">Menú público</option><option value="panel">Panel privado</option>
                </select>
              </div>
              <div className="saas-field full">
                <label htmlFor="domainHost">Dominio completo, sin https://</label>
                <input id="domainHost" required placeholder="delibocadosfunza.com"
                  maxLength={253} value={hostname} autoCapitalize="none"
                  onChange={e => setHostname(e.target.value.toLowerCase())} />
              </div>
            </div>
            <p>Estado: <strong>{statusText[company.domains?.find(d => d.purpose === purpose)?.status ?? "pending_dns"]}</strong></p>
            <div className="saas-card-actions">
              <button className="saas-button primary" type="submit" disabled={!!busy}>
                {busy === "domain" ? "Guardando…" : "Guardar dominio"}
              </button>
              <button className="saas-button" type="button" disabled={!!busy || !company.domains?.some(d => d.purpose === purpose)}
                onClick={verifyDns}>{busy === "dns" ? "Comprobando…" : "Comprobar DNS"}</button>
            </div>
            <p>Guardar o verificar DNS no activa el sitio por sí solo. Falta configurar Nginx, emitir TLS y comprobar que el dominio sirva la empresa correcta.</p>
          </form>
        </article>
      </section>
    </>}
  </>;
}
