"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ButtonLink, PageHeader, SectionHeading } from "../../../_components/PagePrimitives";

const base = (process.env.NEXT_PUBLIC_API_URL || "https://panel.fulanitasfabrica.site/api").replace(/\/+$/, "");
const catalog = [
  { key: "whatsapp", label: "WhatsApp", details: "Bandeja de conversaciones y control humano" },
  { key: "ai", label: "Agente IA", details: "Memoria y respuestas inteligentes" },
  { key: "orders", label: "Pedidos", details: "Órdenes y ventas" },
  { key: "customers", label: "Clientes", details: "CRM de contactos" },
  { key: "catalog", label: "Menú digital", details: "Productos, precios y fotografías" },
  { key: "qr", label: "Códigos QR", details: "QR de menú y por mesa" },
  { key: "floorplan", label: "Plano de mesas", details: "Organización por pisos" },
  { key: "integrations", label: "Integraciones", details: "Toteat, POS360 y otros conectores" },
] as const;
type Key = (typeof catalog)[number]["key"];
type Modules = Record<Key, boolean>;
const blank = Object.fromEntries(catalog.map(item => [item.key, false])) as Modules;

export default function CompanyModulesPage() {
  const { companyId } = useParams<{companyId: string}>();
  const [modules, setModules] = useState<Modules>(blank);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const endpoint = `${base}/platform/companies/${encodeURIComponent(companyId)}/modules`;

  useEffect(() => {
    const c = new AbortController();
    setLoading(true);
    fetch(endpoint, { credentials: "include", cache: "no-store", signal: c.signal })
      .then(async r => { if (!r.ok) throw new Error(`Error cargando módulos (${r.status})`); return r.json(); })
      .then(body => setModules({ ...blank, ...body.data.modules }))
      .catch(e => { if (!c.signal.aborted) setError(String(e.message || e)); })
      .finally(() => { if (!c.signal.aborted) setLoading(false); });
    return () => c.abort();
  }, [endpoint]);

  async function save() {
    setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch(endpoint, {
        method: "PUT", credentials: "include", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modules }),
      });
      if (!response.ok) throw new Error(`No se guardaron los servicios (${response.status})`);
      setNotice("Configuración guardada en PostgreSQL.");
    } catch (e) { setError(e instanceof Error ? e.message : "Error desconocido"); }
    finally { setSaving(false); }
  }

  return <>
    <PageHeader kicker="SUPERADMIN / EMPRESAS" title={`Servicios de ${companyId}`}
      description="Activá o desactivá servicios sin eliminar sus datos."
      actions={<ButtonLink href="/platform/companies">Volver</ButtonLink>} />
    <section className="saas-section">
      <SectionHeading title="Módulos contratados" description="Solo habilitación comercial; el panel y la API aún deben respetar estas opciones." />
      {loading ? <p>Cargando configuración…</p> : null}
      {error ? <p role="alert" style={{color:"#b91c1c"}}>{error}</p> : null}
      {notice ? <p role="status">{notice}</p> : null}
      {!loading && !error ? <div className="saas-grid two">
        {catalog.map(item => <label key={item.key} className="saas-card"
          style={{display:"flex",flexDirection:"row",alignItems:"center",gap:16,cursor:"pointer"}}>
          <input type="checkbox" checked={modules[item.key]}
            onChange={e => {setModules(old => ({...old,[item.key]:e.target.checked}));setNotice("");}}
            style={{width:20,height:20,accentColor:"#b58b50"}} />
          <span><strong>{item.label}</strong><p style={{margin:"4px 0 0"}}>{item.details}</p></span>
        </label>)}
      </div> : null}
      <div className="saas-card-actions" style={{marginTop:20}}>
        <button type="button" className="saas-button primary" onClick={save} disabled={loading || saving || Boolean(error)}>
          {saving ? "Guardando…" : "Guardar servicios"}
        </button>
      </div>
    </section>
  </>;
}
