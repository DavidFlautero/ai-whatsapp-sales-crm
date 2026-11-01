"use client";
import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ButtonLink, PageHeader } from "../../_components/PagePrimitives";

export default function NewCompanyPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name:"", slug:"", currency:"COP", ownerName:"", ownerEmail:"", ownerPassword:"" });
  const [error,setError] = useState("");
  const [saving,setSaving] = useState(false);
  const set = (field:keyof typeof form, value:string) => setForm(old=>({...old,[field]:value}));
  async function submit(e:FormEvent) {
    e.preventDefault();
    setError(""); setSaving(true);
    try {
      const response = await fetch("/api/platform/companies",{
        method:"POST", credentials:"include", headers:{"Content-Type":"application/json"},
        body:JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok || !data.ok || !data.data?.id) {
        setError(data.error === "COMPANY_OR_EMAIL_ALREADY_EXISTS" ? "Empresa o correo ya registrado." : "No se pudo crear la empresa. Revisá los datos y la API.");
        return;
      }
      setForm(old=>({...old,ownerPassword:""}));
      router.push("/platform/companies/manage/" + encodeURIComponent(data.data.id));
    } catch { setError("La API no respondió."); }
    finally { setSaving(false); }
  }
  return <>
    <PageHeader kicker="ONBOARDING MULTIEMPRESA" title="Crear empresa"
      description="Registro real en PostgreSQL y cuenta de propietario."
      actions={<ButtonLink href="/platform/companies">Volver</ButtonLink>}/>
    <section className="saas-section">
      <article className="saas-card">
        <form className="saas-form" onSubmit={submit}>
          <div className="saas-form-grid">
            <div className="saas-field"><label>Nombre comercial</label>
              <input required minLength={2} maxLength={120} value={form.name} onChange={e=>set("name",e.target.value)}/></div>
            <div className="saas-field"><label>Identificador / subdominio</label>
              <input required maxLength={63} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={form.slug} onChange={e=>set("slug",e.target.value.toLowerCase())}/></div>
            <div className="saas-field"><label>Moneda</label>
              <select value={form.currency} onChange={e=>set("currency",e.target.value)}>
                <option value="COP">COP</option><option value="EUR">EUR</option>
                <option value="USD">USD</option><option value="ARS">ARS</option>
              </select></div>
            <div className="saas-field"><label>Nombre del propietario</label>
              <input required minLength={2} value={form.ownerName} onChange={e=>set("ownerName",e.target.value)}/></div>
            <div className="saas-field full"><label>Correo del propietario</label>
              <input type="email" required value={form.ownerEmail} onChange={e=>set("ownerEmail",e.target.value)}/></div>
            <div className="saas-field full"><label>Contraseña inicial (12 caracteres mínimo)</label>
              <input type="password" autoComplete="new-password" required minLength={12} value={form.ownerPassword} onChange={e=>set("ownerPassword",e.target.value)}/></div>
          </div>
          {error && <p role="alert">{error}</p>}
          <button className="saas-button primary" disabled={saving} type="submit">{saving?"Creando…":"Crear empresa y propietario"}</button>
        </form>
      </article>
    </section>
  </>;
}
