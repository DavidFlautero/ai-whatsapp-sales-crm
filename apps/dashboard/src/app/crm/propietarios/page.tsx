"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "./Propietarios.module.css";

type Provider = {
  id: string;
  name: string;
  status: string;
  whatsappRegistered: boolean;
  whatsappLast3: string | null;
  venuesCount: number;
};

export default function InvitacionesPropietarios() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selected, setSelected] = useState("");
  const [confirmedPhone, setConfirmedPhone] = useState(false);
  const [confirmedOwner, setConfirmedOwner] = useState(false);
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch(
          "/api/crm/owner-invitations/candidates",
          { credentials: "include", cache: "no-store" }
        );

        if (!response.ok) {
          throw new Error(
            response.status === 403
              ? "Tu cuenta no tiene permisos administrativos."
              : "No se pudieron cargar los proveedores."
          );
        }

        const data = await response.json();
        setProviders(data.providers ?? []);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Error de conexión."
        );
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  async function generate() {
    if (!selected || !confirmedPhone || !confirmedOwner) return;

    setCreating(true);
    setError("");
    setLink("");

    try {
      const response = await fetch(
        "/api/crm/owner-invitations",
        {
          method: "POST",
          credentials: "include",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            providerId: selected,
            confirmWhatsapp: true,
            confirmOwnership: true,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.inviteToken) {
        throw new Error(
          data.error ?? "No se pudo generar la invitación."
        );
      }

      const invitation =
        `${window.location.origin}/propietarios/acceso`
        + `#invite=${encodeURIComponent(data.inviteToken)}`;

      setLink(invitation);
      setConfirmedPhone(false);
      setConfirmedOwner(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error de conexión."
      );
    } finally {
      setCreating(false);
    }
  }

  const current = providers.find(p => p.id === selected);
  const ready = providers.filter(
    p => p.status === "active" && p.whatsappRegistered
  );


  // OWNER_PORTAL_REDESIGN_V2
  return (
    <main className={styles.page}>
      <div className={styles.container}>

        <nav className={styles.breadcrumb}>
          <Link href="/crm/proveedores">
            Proveedores
          </Link>
          <span>/</span>
          <span>Accesos de propietarios</span>
        </nav>

        <header className={styles.header}>
          <div>
            <div className={styles.eyebrow}>
              EVENTOS MEDITERRÁNEO · CRM
            </div>

            <h1 className={styles.title}>
              Portal de propietarios
            </h1>

            <p className={styles.description}>
              Gestioná los accesos privados de los propietarios
              y administradores de chalets.
            </p>
          </div>

          <div className={styles.headerBadge}>
            <span className={styles.statusDot} />
            Accesos privados
          </div>
        </header>

        <div className={styles.stats}>
          <article className={styles.statCard}>
            <div className={styles.statTop}>
              <span className={styles.statIcon}>01</span>
              <span className={styles.statTag}>CRM</span>
            </div>
            <div className={styles.statValue}>
              {providers.length}
            </div>
            <div className={styles.statLabel}>
              Proveedores vinculados
            </div>
            <div className={styles.statDescription}>
              Contactos registrados en el sistema
            </div>
          </article>

          <article className={styles.statCard}>
            <div className={styles.statTop}>
              <span className={styles.statIcon}>02</span>
              <span className={styles.statTag}>WhatsApp</span>
            </div>
            <div className={styles.statValue}>
              {ready.length}
            </div>
            <div className={styles.statLabel}>
              Contactos habilitados
            </div>
            <div className={styles.statDescription}>
              Proveedores activos con WhatsApp
            </div>
          </article>

          <article className={styles.statCardDark}>
            <div className={styles.statTop}>
              <span className={styles.statIconDark}>03</span>
              <span className={styles.statTagDark}>Seguridad</span>
            </div>
            <div className={styles.statValueDark}>
              24 h
            </div>
            <div className={styles.statLabelDark}>
              Validez de cada invitación
            </div>
            <div className={styles.statDescriptionDark}>
              Enlaces privados de un solo uso inicial
            </div>
          </article>
        </div>

        <div className={styles.grid}>

          <section className={styles.mainCard}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionNumber}>01</div>

              <div>
                <h2 className={styles.sectionTitle}>
                  Generar invitación
                </h2>
                <p className={styles.sectionDescription}>
                  Seleccioná un propietario autorizado
                  para generar su acceso privado.
                </p>
              </div>
            </div>

            {error && (
              <div className={styles.error} role="alert">
                {error}
              </div>
            )}

            <div className={styles.field}>
              <label htmlFor="owner-provider">
                Propietario o proveedor
              </label>

              <select
                id="owner-provider"
                value={selected}
                disabled={loading || creating}
                onChange={event => {
                  setSelected(event.target.value);
                  setConfirmedPhone(false);
                  setConfirmedOwner(false);
                  setLink("");
                  setError("");
                }}
                className={styles.select}
              >
                <option value="">
                  {loading
                    ? "Cargando propietarios..."
                    : "Seleccioná un propietario"}
                </option>

                {providers.map(provider => (
                  <option
                    key={provider.id}
                    value={provider.id}
                    disabled={
                      provider.status !== "active"
                      || !provider.whatsappRegistered
                      || provider.venuesCount < 1
                    }
                  >
                    {provider.name}
                    {" · "}
                    {provider.venuesCount} chalet(s)
                    {!provider.whatsappRegistered
                      ? " · Sin WhatsApp"
                      : ""}
                  </option>
                ))}
              </select>

              <p className={styles.fieldHelp}>
                Solo aparecen habilitados los proveedores
                activos, con WhatsApp y chalets vinculados.
              </p>
            </div>

            {current && (
              <div className={styles.profile}>
                <div className={styles.profileHeader}>
                  <div className={styles.avatar}>
                    {current.name.slice(0, 1).toUpperCase()}
                  </div>

                  <div>
                    <span className={styles.profileCaption}>
                      PROPIETARIO SELECCIONADO
                    </span>
                    <h3 className={styles.profileName}>
                      {current.name}
                    </h3>
                  </div>
                </div>

                <div className={styles.profileDetails}>
                  <div>
                    <span>Propiedades vinculadas</span>
                    <strong>
                      {current.venuesCount} chalet(s)
                    </strong>
                  </div>

                  <div>
                    <span>WhatsApp registrado</span>
                    <strong>
                      {current.whatsappRegistered
                        ? `•••${current.whatsappLast3 ?? ""}`
                        : "No registrado"}
                    </strong>
                  </div>
                </div>

                <div className={styles.profileWarning}>
                  Verificá el número completo y la titularidad
                  en la ficha del CRM antes de continuar.
                </div>
              </div>
            )}

            <div className={styles.confirmation}>
              <h3>Verificación de seguridad</h3>

              <p>
                Confirmá ambos requisitos antes de
                generar una credencial privada.
              </p>

              <label className={styles.checkRow}>
                <input
                  type="checkbox"
                  checked={confirmedPhone}
                  disabled={!current || creating}
                  onChange={event =>
                    setConfirmedPhone(event.target.checked)
                  }
                />
                <span>
                  Verifiqué que el WhatsApp pertenece
                  al destinatario.
                </span>
              </label>

              <label className={styles.checkRow}>
                <input
                  type="checkbox"
                  checked={confirmedOwner}
                  disabled={!current || creating}
                  onChange={event =>
                    setConfirmedOwner(event.target.checked)
                  }
                />
                <span>
                  Confirmé que está autorizado para
                  administrar los chalets asociados.
                </span>
              </label>
            </div>

            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => void generate()}
              disabled={
                !selected
                || !current
                || current.status !== "active"
                || !current.whatsappRegistered
                || current.venuesCount < 1
                || !confirmedPhone
                || !confirmedOwner
                || creating
              }
            >
              {creating
                ? "Generando invitación..."
                : "Generar enlace privado"}
              <span aria-hidden="true">→</span>
            </button>

            {link && (
              <div className={styles.success}>
                <div className={styles.successTitle}>
                  Invitación generada correctamente
                </div>

                <p>
                  El enlace caduca en 24 horas y permite
                  un único acceso inicial.
                  Compartilo solo con el destinatario autorizado.
                </p>

                <input
                  type="text"
                  value={link}
                  readOnly
                  aria-label="Enlace privado"
                  className={styles.linkInput}
                />

                <button
                  type="button"
                  className={styles.copyButton}
                  onClick={() => {
                    void navigator.clipboard.writeText(link)
                      .catch(() => {
                        setError(
                          "No se pudo copiar. Copiá el enlace manualmente."
                        );
                      });
                  }}
                >
                  Copiar enlace privado
                </button>
              </div>
            )}
          </section>

          <aside className={styles.sideCard}>
            <div className={styles.sideEyebrow}>
              PROCESO DE ACCESO
            </div>

            <h2 className={styles.sideTitle}>
              Una invitación.
              <br />
              Acceso seguro.
            </h2>

            <p className={styles.sideDescription}>
              Cada propietario recibe un acceso
              vinculado exclusivamente a su ficha
              y a las propiedades autorizadas.
            </p>

            <div className={styles.steps}>
              <div className={styles.step}>
                <span>1</span>
                <div>
                  <strong>Seleccionar propietario</strong>
                  <p>
                    Elegí un contacto activo
                    del CRM con chalet vinculado.
                  </p>
                </div>
              </div>

              <div className={styles.step}>
                <span>2</span>
                <div>
                  <strong>Verificar identidad</strong>
                  <p>
                    Confirmá WhatsApp y
                    autorización para administrar.
                  </p>
                </div>
              </div>

              <div className={styles.step}>
                <span>3</span>
                <div>
                  <strong>Compartir acceso</strong>
                  <p>
                    Generá el enlace privado
                    y envialo al propietario.
                  </p>
                </div>
              </div>
            </div>

            <div className={styles.sideFooter}>
              <strong>Protección del acceso</strong>
              <p>
                La invitación se consume al iniciar sesión.
                El portal utiliza una sesión privada
                con vencimiento independiente.
              </p>
            </div>
          </aside>

        </div>
      </div>
    </main>
  );
}
