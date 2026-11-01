"use client";
import {useEffect,useState} from "react";
import {ButtonLink, Metric, PageHeader, SectionHeading} from "./_components/PagePrimitives";

type Company={id:string;name:string;active:boolean};
export default function PlatformPage(){
  const [companies,setCompanies]=useState<Company[]>([]);
  const [error,setError]=useState("");
  useEffect(()=>{
    let mounted=true;
    fetch("/api/platform/companies",{credentials:"include",cache:"no-store"})
      .then(async r=>{const data=await r.json();if(!r.ok||!data.ok||!Array.isArray(data.data))throw new Error("FAILED");return data.data as Company[];})
      .then(data=>{if(mounted)setCompanies(data);})
      .catch(()=>{if(mounted)setError("No se pudieron obtener los datos reales de la plataforma.");});
    return ()=>{mounted=false;};
  },[]);
  return <>
    <PageHeader kicker="CENTRO DE ADMINISTRACIÓN SAAS"
      title="Control global de la plataforma"
      description="Empresas reales registradas y acceso al alta multiempresa."
      actions={<>
        <ButtonLink href="/platform/companies">Ver empresas</ButtonLink>
        <ButtonLink href="/platform/companies/new" kind="primary">+ Agregar empresa</ButtonLink>
      </>} />
    {error&&<p role="alert">{error}</p>}
    <section className="saas-metrics">
      <Metric label="Empresas registradas" value={error?"—":String(companies.length)} detail="PostgreSQL" />
      <Metric label="Empresas activas" value={error?"—":String(companies.filter(c=>c.active).length)} detail="Registro empresarial" />
    </section>
    <section className="saas-section">
      <SectionHeading title="Empresas" description="Sin estimaciones de facturación, robot ni usuarios ficticios."/>
      <div className="saas-grid two">
        {companies.map(company=><article className="saas-card" key={company.id}>
          <h3>{company.name}</h3><p>{company.id}</p>
          <div className="saas-card-actions">
            <ButtonLink href={"/platform/companies/manage/"+encodeURIComponent(company.id)}>Administrar</ButtonLink>
          </div>
        </article>)}
      </div>
    </section>
  </>;
}
