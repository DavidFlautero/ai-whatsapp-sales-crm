"use client";

import "./subscription.css";
import { useState } from "react";
import { CompanyTabs, Metric, PageHeader, SectionHeading, StatusBadge } from "../../../_components/PagePrimitives";

export default function CompanySubscriptionPage() {
  const [showBlock, setShowBlock] = useState(false);
  const [panelBlocked, setPanelBlocked] = useState(false);

  return (
    <>
      <PageHeader
        kicker="FULANITAS / SUSCRIPCIÓN"
        title="Plan, pagos y continuidad"
        description="Control comercial del servicio, estado mensual, accesos y continuidad operativa de Fulanitas Fábrica."
        actions={
          <div className="saas-inline-actions">
            <button type="button" className="saas-button">Registrar pago</button>
            <button type="button" className="saas-button primary">Cambiar plan</button>
          </div>
        }
      />

      <CompanyTabs active="Suscripción" />

      <section className="saas-metrics">
        <Metric label="Plan" value="Inicial" detail="Cliente activo" />
        <Metric label="Precio" value="USD 50" detail="Mensual" />
        <Metric label="Estado de pago" value="Al día" detail="Servicio habilitado" tone="success" />
        <Metric label="Panel empresarial" value={panelBlocked ? "Bloqueado" : "Activo"} detail={panelBlocked ? "Acceso suspendido" : "Usuarios habilitados"} tone={panelBlocked ? undefined : "success"} />
        <Metric label="Robot WhatsApp" value="Activo" detail="No se bloquea automáticamente" tone="success" />
      </section>

      <section className="saas-section">
        <SectionHeading
          title="Estado comercial"
          description="El bloqueo del panel y el estado del robot se administran de forma independiente para evitar perder conversaciones."
          aside={<StatusBadge>{panelBlocked ? "Acceso bloqueado" : "Empresa activa"}</StatusBadge>}
        />

        <div className="saas-grid two">
          <article className="saas-card">
            <h3>Condiciones actuales</h3>
            <div className="saas-list">
              <div className="saas-list-row"><span>Nombre del plan</span><strong>Cliente inicial</strong></div>
              <div className="saas-list-row"><span>Precio mensual</span><strong>USD 50</strong></div>
              <div className="saas-list-row"><span>Estado de pago</span><strong className="saas-success">Activo</strong></div>
              <div className="saas-list-row"><span>Ciclo</span><strong>Mensual</strong></div>
              <div className="saas-list-row"><span>Acceso de usuarios</span><strong>{panelBlocked ? "Suspendido" : "Habilitado"}</strong></div>
            </div>
          </article>

          <article className="saas-card saas-danger-card">
            <span className="saas-kicker">CONTROL DE CONTINUIDAD</span>
            <h3>{panelBlocked ? "Panel empresarial bloqueado" : "Bloqueo administrativo"}</h3>
            <p>
              {panelBlocked
                ? "Los usuarios de Fulanitas no podrán acceder al panel hasta que el superadmin reactive el servicio. Los datos permanecen intactos."
                : "Suspendé el acceso por pago vencido, solicitud del cliente o revisión administrativa sin borrar información."}
            </p>
            <div className="saas-list compact">
              <div className="saas-list-row"><span>Clientes y CRM</span><strong>Se conservan</strong></div>
              <div className="saas-list-row"><span>Conversaciones</span><strong>Se conservan</strong></div>
              <div className="saas-list-row"><span>Robot WhatsApp</span><strong className="saas-success">Permanece activo</strong></div>
              <div className="saas-list-row"><span>Acceso superadmin</span><strong className="saas-success">Disponible</strong></div>
            </div>
            <button
              type="button"
              className={panelBlocked ? "saas-button primary" : "saas-button danger"}
              onClick={() => panelBlocked ? setPanelBlocked(false) : setShowBlock(true)}
            >
              {panelBlocked ? "Reactivar panel" : "Bloquear acceso de la empresa"}
            </button>
          </article>
        </div>
      </section>

      <section className="saas-section">
        <SectionHeading title="Servicios incluidos" description="Alcance visual del plan actualmente asignado." />
        <div className="saas-grid">
          {[
            ["WhatsApp", "1 número comercial conectado"],
            ["Usuarios", "3 cuentas empresariales configuradas"],
            ["CRM", "Clientes, memoria y seguimiento"],
            ["Robot comercial", "IA, scoring y respuestas"],
            ["Recovery", "Recuperación de clientes perdidos"],
            ["Analytics", "Métricas operativas y comerciales"],
          ].map(([title, detail]) => (
            <article className="saas-card" key={title}><h3>{title}</h3><p>{detail}</p><StatusBadge>Incluido</StatusBadge></article>
          ))}
        </div>
      </section>

      <section className="saas-section">
        <SectionHeading title="Historial comercial" description="Registros confirmados y futuros comprobantes de la suscripción." />
        <div className="saas-table-wrap">
          <table className="saas-table">
            <thead><tr><th>Periodo</th><th>Concepto</th><th>Importe</th><th>Estado</th></tr></thead>
            <tbody>
              <tr><td>Ciclo actual</td><td>Plan Cliente inicial</td><td>USD 50</td><td><StatusBadge>Registrado</StatusBadge></td></tr>
            </tbody>
          </table>
        </div>
      </section>

      {showBlock ? (
        <div className="saas-modal-backdrop" onClick={() => setShowBlock(false)}>
          <section className="saas-confirm-modal" onClick={(event) => event.stopPropagation()}>
            <span className="saas-kicker">ACCIÓN ADMINISTRATIVA</span>
            <h2>Bloquear Fulanitas Fábrica</h2>
            <p>Los usuarios perderán acceso al panel. El superadmin conservará acceso y ningún dato será eliminado.</p>
            <label className="saas-field"><span>Motivo del bloqueo</span><select defaultValue="payment"><option value="payment">Pago vencido</option><option value="client">Solicitud del cliente</option><option value="review">Revisión administrativa</option><option value="plan">Incumplimiento del plan</option></select></label>
            <label className="saas-check"><input type="checkbox" defaultChecked /><span>Mantener el robot de WhatsApp activo</span></label>
            <div className="saas-modal-actions">
              <button type="button" className="saas-button" onClick={() => setShowBlock(false)}>Cancelar</button>
              <button type="button" className="saas-button danger" onClick={() => { setPanelBlocked(true); setShowBlock(false); }}>Confirmar bloqueo</button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
