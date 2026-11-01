"use client";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ButtonLink, PageHeader, SectionHeading, StatusBadge } from "../../../_components/PagePrimitives";

type Company = {id:string;name:string;active:boolean;currency:string|null;usersCount:number;domain:string|null};

export default function ManageCompanyPage(){
  const {companyId} = useParams<{companyId:string}>();
  const [company,setCompany]=useState<Company|null>(null);
  const [error,setError]=useState("");
  useEffect(()=>{
    let mounted=true;
    fetch("/api/platform/companies/"+encodeURIComponent(companyId),{credentials:"include",cache:"no-store"})
      .then(async r=>{const data=await r.json();if(!r.ok||!data.ok)throw new Error("NOT_FOUND");return data.data as Company;})
      .then(data=>{if(mounted)setCompany(data);})
      .catch(()=>{if(mounted)setError("No se pudo consultar la empresa.");});
    return ()=>{mounted=false;};
  },[companyId]);
  return <>
    <PageHeader kicker="ADMINISTRACIÓN DE EMPRESAS" title={company?.name??"Empresa"}
      description="Datos del registro empresarial y estado del acceso."
      actions={<ButtonLink href="/platform/companies">Volver al listado</ButtonLink>} />
    {error&&<p role="alert">{error}</p>}
    {company&&<section className="saas-section">
      <SectionHeading title="Cuenta empresarial" description="El propietario puede iniciar sesión con las credenciales creadas."/>
      <article className="saas-card">
        <div className="saas-list">
          <div className="saas-list-row"><span>Identificador</span><strong>{company.id}</strong></div>
          <div className="saas-list-row"><span>Estado</span><StatusBadge>{company.active?"Activa":"Inactiva"}</StatusBadge></div>
          <div className="saas-list-row"><span>Moneda</span><strong>{company.currency??"Sin configurar"}</strong></div>
          <div className="saas-list-row"><span>Usuarios gestionados</span><strong>{company.usersCount}</strong></div>
          <div className="saas-list-row"><span>Subdominio previsto</span><strong>{company.domain??"Requiere dominio base"}</strong></div>
          <div className="saas-list-row"><span>DNS y certificado HTTPS</span><strong>Verificar antes de habilitar acceso público</strong></div>
          <div className="saas-list-row"><span>WhatsApp y automatización</span><strong>Pendientes de configuración</strong></div>
        </div>
      </article>
    </section>}
  </>;
}
