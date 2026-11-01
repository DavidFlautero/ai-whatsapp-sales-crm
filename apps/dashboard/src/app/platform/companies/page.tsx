"use client";
import { useEffect, useState } from "react";
import { ButtonLink, PageHeader, SectionHeading, StatusBadge } from "../_components/PagePrimitives";

type Company = {id:string;name:string;active:boolean;currency:string|null;usersCount:number;domain:string|null};

export default function CompaniesPage(){
  const [companies,setCompanies] = useState<Company[]>([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");
  useEffect(()=>{
    let mounted=true;
    fetch("/api/platform/companies",{credentials:"include",cache:"no-store"})
      .then(async r=>{const body=await r.json(); if(!r.ok||!body.ok||!Array.isArray(body.data))throw new Error("READ_FAILED");return body.data as Company[];})
      .then(rows=>{if(mounted)setCompanies(rows);})
      .catch(()=>{if(mounted)setError("No se pudieron leer las empresas. Comprobá la API y las migraciones.");})
      .finally(()=>{if(mounted)setLoading(false);});
    return ()=>{mounted=false;};
  },[]);
  return <>
    <PageHeader kicker="EMPRESAS ASOCIADAS" title="Clientes y operaciones"
      description="Datos reales de PostgreSQL. Sin tarjetas de demostración."
      actions={<ButtonLink href="/platform/companies/new" kind="primary">+ Agregar empresa</ButtonLink>}/>
    <section className="saas-section" style={{marginTop:0}}>
      <SectionHeading title="Empresas registradas" description="Usuarios gestionados mediante el nuevo sistema."
        aside={<StatusBadge>{loading?"Consultando…":companies.length+" registradas"}</StatusBadge>}/>
      {error && <p role="alert">{error}</p>}
      {!loading&&!error&&companies.length===0&&<p>No hay empresas registradas.</p>}
      <div className="saas-grid two">
        {companies.map(c=><article className="saas-card saas-company-card" key={c.id}>
          <div className="saas-company-head">
            <span className="saas-company-logo">{c.name.charAt(0).toUpperCase()}</span>
            <div><StatusBadge tone={c.active?"success":"pending"}>{c.active?"Activa":"Inactiva"}</StatusBadge>
              <h3>{c.name}</h3><p>{c.id}</p></div>
          </div>
          <div className="saas-list">
            <div className="saas-list-row"><span>Moneda</span><strong>{c.currency??"Sin configurar"}</strong></div>
            <div className="saas-list-row"><span>Usuarios gestionados</span><strong>{c.usersCount}</strong></div>
            <div className="saas-list-row"><span>Subdominio previsto</span><strong>{c.domain??"Sin dominio base"}</strong></div>
          </div>
          <div className="saas-card-actions">
            <ButtonLink href={"/platform/companies/manage/"+encodeURIComponent(c.id)} kind="primary">Administrar empresa</ButtonLink>
          </div>
        </article>)}
      </div>
    </section>
  </>;
}
