"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ButtonLink, PageHeader, SectionHeading } from "../../_components/PagePrimitives";

const apiUrl = (
  process.env.NEXT_PUBLIC_API_URL ||
  "https://panel.fulanitasfabrica.site/api"
).replace(/\/+$/, "");

function makeSlug(value: string) {
  return value.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export default function NewCompanyPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [legalName, setLegalName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [sector, setSector] = useState("restaurant");
  const [plan, setPlan] = useState("starter");
  const [currency, setCurrency] = useState("EUR");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`${apiUrl}/platform/companies`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: slug,
          name,
          legalName: legalName.trim() || name,
          ownerEmail,
          sector,
          plan,
          currency,
        }),
      });
      if (!response.ok) {
        const responseBody = await response.json().catch(() => null);
        const serverCode = responseBody?.error;
        if (response.status === 409) {
          throw new Error("El identificador ya pertenece a una empresa.");
        }
        throw new Error(
          serverCode === "VALIDATION_ERROR"
            ? "Revisá los datos del formulario."
            : "No se pudo crear la empresa. Podés reintentar sin duplicarla."
        );
      }
      router.push("/platform/companies");
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        kicker="ONBOARDING MULTIEMPRESA"
        title="Agregar una nueva empresa"
        description="Alta real en PostgreSQL con configuración inicial aislada. El propietario y WhatsApp quedan pendientes de activación."
        actions={<ButtonLink href="/platform/companies">Volver a empresas</ButtonLink>}
      />
      <section className="saas-section">
        <SectionHeading title="Datos de la empresa" description="Se creará sin acceso operativo hasta completar las autorizaciones." />
        <div className="saas-grid two">
          <article className="saas-card">
            <form className="saas-form" onSubmit={submit}>
              <div className="saas-form-grid">
                <div className="saas-field"><label htmlFor="company-name">Nombre comercial</label><input id="company-name" required maxLength={120} value={name} onChange={(e) => { setName(e.target.value); if (!slugEdited) setSlug(makeSlug(e.target.value)); }} /></div>
                <div className="saas-field"><label htmlFor="company-id">Identificador</label><input id="company-id" required maxLength={64} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={slug} onChange={(e) => { setSlugEdited(true); setSlug(e.target.value); }} /></div>
                <div className="saas-field"><label htmlFor="company-legal">Razón social (opcional)</label><input id="company-legal" maxLength={180} value={legalName} onChange={(e) => setLegalName(e.target.value)} /></div>
                <div className="saas-field"><label htmlFor="owner-email">Correo del propietario</label><input id="owner-email" type="email" required maxLength={200} value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} /></div>
                <div className="saas-field"><label htmlFor="company-sector">Sector</label><select id="company-sector" value={sector} onChange={(e) => setSector(e.target.value)}><option value="restaurant">Restaurante</option><option value="events">Eventos</option><option value="services">Servicios</option><option value="retail">Comercio</option><option value="other">Otro</option></select></div>
                <div className="saas-field"><label htmlFor="company-plan">Plan</label><select id="company-plan" value={plan} onChange={(e) => setPlan(e.target.value)}><option value="starter">Starter</option><option value="professional">Professional</option><option value="enterprise">Enterprise</option></select></div>
                <div className="saas-field"><label htmlFor="company-currency">Moneda</label><select id="company-currency" value={currency} onChange={(e) => setCurrency(e.target.value)}><option value="EUR">EUR</option><option value="COP">COP</option><option value="USD">USD</option><option value="ARS">ARS</option></select></div>
              </div>
              {error ? <p role="alert" style={{ color: "#b91c1c" }}>{error}</p> : null}
              <button className="saas-button primary" type="submit" disabled={saving}>{saving ? "Creando…" : "Crear empresa"}</button>
            </form>
          </article>
          <article className="saas-card">
            <h3>Configuración automática inicial</h3>
            <div className="saas-list">
              <div className="saas-list-row"><span>Registro empresarial</span><strong>PostgreSQL</strong></div>
              <div className="saas-list-row"><span>CRM y ajustes comerciales</span><strong>Aislados por empresa</strong></div>
              <div className="saas-list-row"><span>Owner</span><strong>Pendiente de invitación</strong></div>
              <div className="saas-list-row"><span>WhatsApp e IA</span><strong>Pendientes de conectar</strong></div>
              <div className="saas-list-row"><span>Estado</span><strong>Sin activar</strong></div>
            </div>
          </article>
        </div>
      </section>
    </>
  );
}
