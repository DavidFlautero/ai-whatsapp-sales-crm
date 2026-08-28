"use client";

import "./subscription.css";
import { useState } from "react";
import { CompanyTabs, Metric, PageHeader, SectionHeading, StatusBadge } from "../../../_components/PagePrimitives";

const plan = {
  name: "Cliente inicial",
  monthlyPrice: 50,
  aiBudget: 20,
  aiUsed: 0,
  renewalLabel: "30 de agosto de 2026",
  billingPeriod: "30 jul — 30 ago",
};

export default function CompanySubscriptionPage() {
  const [showBlock, setShowBlock] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [panelBlocked, setPanelBlocked] = useState(false);
  const [paymentRegistered, setPaymentRegistered] = useState(false);

  const aiRemaining = Math.max(plan.aiBudget - plan.aiUsed, 0);
  const usagePercent = plan.aiBudget > 0 ? Math.min((plan.aiUsed / plan.aiBudget) * 100, 100) : 0;

  return (
    <>
      <PageHeader
        kicker="FULANITAS / FACTURACIÓN"
        title="Plan, pagos y consumo de IA"
        description="Centro comercial de la cuenta: cuota mensual, saldo de inteligencia artificial, próxima renovación y continuidad del servicio."
        actions={
          <div className="saas-inline-actions">
            <button type="button" className="saas-button" onClick={() => setShowPayment(true)}>Registrar pago</button>
            <button type="button" className="saas-button primary">Editar condiciones</button>
          </div>
        }
      />

      <CompanyTabs active="Suscripción" />

      <section className="saas-metrics">
        <Metric label="Plan mensual" value={`USD ${plan.monthlyPrice}`} detail={plan.name} />
        <Metric label="Saldo IA disponible" value={`USD ${aiRemaining}`} detail="Presupuesto del ciclo" tone="success" />
        <Metric label="Consumo IA" value={`USD ${plan.aiUsed}`} detail="Sin consumo registrado" />
        <Metric label="Estado de pago" value={paymentRegistered ? "Registrado" : "Al día"} detail="Servicio habilitado" tone="success" />
        <Metric label="Próxima renovación" value="30 AGO" detail="Ciclo mensual" />
      </section>

      <section className="saas-section billing-hero-grid">
        <article className="billing-plan-card">
          <div className="billing-plan-top">
            <div>
              <span className="saas-kicker">PLAN ACTUAL</span>
              <h2>{plan.name}</h2>
              <p>Operación comercial completa para Fulanitas Fábrica.</p>
            </div>
            <StatusBadge>Activo</StatusBadge>
          </div>

          <div className="billing-price">
            <strong>USD {plan.monthlyPrice}</strong>
            <span>/ mes</span>
          </div>

          <div className="billing-plan-features">
            <span>✓ Panel empresarial completo</span>
            <span>✓ CRM, conversaciones y catálogo</span>
            <span>✓ Robot comercial con IA</span>
            <span>✓ 3 usuarios empresariales</span>
            <span>✓ Recovery, analytics y campañas</span>
            <span>✓ Soporte y mantenimiento</span>
          </div>

          <div className="billing-renewal-line">
            <span>Próxima renovación</span>
            <strong>{plan.renewalLabel}</strong>
          </div>
        </article>

        <article className="ai-wallet-card">
          <div className="ai-wallet-head">
            <div>
              <span className="saas-kicker">BILLETERA DE INTELIGENCIA ARTIFICIAL</span>
              <h2>Consumo mensual de IA</h2>
            </div>
            <span className="ai-wallet-icon">AI</span>
          </div>

          <p className="ai-wallet-description">
            Presupuesto incluido para respuestas, análisis, clasificación de leads, memoria y generación comercial.
          </p>

          <div className="ai-wallet-balance">
            <span>Saldo restante</span>
            <strong>USD {aiRemaining.toFixed(2)}</strong>
            <small>de USD {plan.aiBudget.toFixed(2)} disponibles</small>
          </div>

          <div className="ai-usage-track" aria-label={`Consumo ${usagePercent}%`}>
            <span style={{ width: `${usagePercent}%` }} />
          </div>

          <div className="ai-usage-legend">
            <div><span>Consumido</span><strong>USD {plan.aiUsed.toFixed(2)}</strong></div>
            <div><span>Disponible</span><strong>USD {aiRemaining.toFixed(2)}</strong></div>
            <div><span>Uso</span><strong>{usagePercent.toFixed(0)}%</strong></div>
          </div>

          <div className="billing-info-note">
            Todavía no existe medición automática de tokens. Hasta conectar el proveedor, el panel muestra el presupuesto configurado y consumo registrado.
          </div>
        </article>
      </section>

      <section className="saas-section">
        <SectionHeading
          title="Resumen del ciclo"
          description={`Periodo comercial ${plan.billingPeriod}.`}
          aside={<StatusBadge>{panelBlocked ? "Acceso bloqueado" : "Empresa activa"}</StatusBadge>}
        />

        <div className="billing-cycle-grid">
          <article className="billing-cycle-card">
            <span>Cuota de plataforma</span>
            <strong>USD {plan.monthlyPrice.toFixed(2)}</strong>
            <small>Panel, CRM, robot y mantenimiento</small>
          </article>
          <article className="billing-cycle-card">
            <span>Presupuesto IA</span>
            <strong>USD {plan.aiBudget.toFixed(2)}</strong>
            <small>Saldo operativo configurado</small>
          </article>
          <article className="billing-cycle-card">
            <span>Consumo adicional</span>
            <strong>USD 0.00</strong>
            <small>No existen excedentes registrados</small>
          </article>
          <article className="billing-cycle-card total">
            <span>Total mensual previsto</span>
            <strong>USD {(plan.monthlyPrice + plan.aiBudget).toFixed(2)}</strong>
            <small>Plataforma más presupuesto IA</small>
          </article>
        </div>
      </section>

      <section className="saas-section">
        <SectionHeading
          title="Control de continuidad"
          description="El acceso al panel y el robot se administran por separado para preservar datos y conversaciones."
        />

        <div className="saas-grid two">
          <article className="saas-card">
            <h3>Estado de servicios</h3>
            <div className="saas-list">
              <div className="saas-list-row"><span>Panel empresarial</span><strong className={panelBlocked ? "saas-danger" : "saas-success"}>{panelBlocked ? "Bloqueado" : "Habilitado"}</strong></div>
              <div className="saas-list-row"><span>Robot WhatsApp</span><strong className="saas-warning">Pendiente de token válido</strong></div>
              <div className="saas-list-row"><span>Datos y CRM</span><strong>Se conservan</strong></div>
              <div className="saas-list-row"><span>Acceso superadmin</span><strong className="saas-success">Disponible</strong></div>
              <div className="saas-list-row"><span>Suspensión automática</span><strong>No configurada</strong></div>
            </div>
          </article>

          <article className="saas-card saas-danger-card">
            <span className="saas-kicker">CONTROL ADMINISTRATIVO</span>
            <h3>{panelBlocked ? "Panel empresarial bloqueado" : "Bloqueo por falta de pago"}</h3>
            <p>
              {panelBlocked
                ? "Los usuarios empresariales no pueden ingresar. Toda la información permanece intacta y el superadmin conserva control total."
                : "Suspendé el acceso por pago vencido, solicitud del cliente o revisión administrativa sin borrar ningún dato."}
            </p>
            <div className="saas-list compact">
              <div className="saas-list-row"><span>Clientes y conversaciones</span><strong>Se conservan</strong></div>
              <div className="saas-list-row"><span>Catálogo y configuración</span><strong>Se conservan</strong></div>
              <div className="saas-list-row"><span>Robot</span><strong>Control independiente</strong></div>
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
        <SectionHeading title="Historial de facturación" description="Pagos, renovaciones y consumos registrados para la empresa." />
        <div className="saas-table-wrap">
          <table className="saas-table">
            <thead><tr><th>Periodo</th><th>Concepto</th><th>Importe</th><th>Estado</th><th>Referencia</th></tr></thead>
            <tbody>
              <tr><td>30 jul — 30 ago</td><td>Plan {plan.name}</td><td>USD {plan.monthlyPrice}</td><td><StatusBadge>{paymentRegistered ? "Pagado" : "Activo"}</StatusBadge></td><td>{paymentRegistered ? "Pago manual" : "Ciclo vigente"}</td></tr>
              <tr><td>30 jul — 30 ago</td><td>Presupuesto IA</td><td>USD {plan.aiBudget}</td><td><StatusBadge>Disponible</StatusBadge></td><td>Consumo: USD {plan.aiUsed}</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      {showPayment ? (
        <div className="saas-modal-backdrop" onClick={() => setShowPayment(false)}>
          <section className="saas-confirm-modal" onClick={(event) => event.stopPropagation()}>
            <span className="saas-kicker">REGISTRO COMERCIAL</span>
            <h2>Registrar pago mensual</h2>
            <p>Esta acción es visual por ahora. Deja preparado el flujo para guardar comprobante, periodo, moneda y referencia.</p>
            <div className="payment-summary-box">
              <div><span>Empresa</span><strong>Fulanitas Fábrica</strong></div>
              <div><span>Plan</span><strong>{plan.name}</strong></div>
              <div><span>Importe</span><strong>USD {plan.monthlyPrice}</strong></div>
              <div><span>Periodo</span><strong>{plan.billingPeriod}</strong></div>
            </div>
            <label className="saas-field"><span>Referencia o comprobante</span><input placeholder="Ej. transferencia julio 2026" /></label>
            <div className="saas-modal-actions">
              <button type="button" className="saas-button" onClick={() => setShowPayment(false)}>Cancelar</button>
              <button type="button" className="saas-button primary" onClick={() => { setPaymentRegistered(true); setShowPayment(false); }}>Confirmar registro</button>
            </div>
          </section>
        </div>
      ) : null}

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
