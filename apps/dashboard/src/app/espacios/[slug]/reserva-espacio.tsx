"use client";

import { useState, type FormEvent } from "react";
import styles from "./reserva-espacio.module.css";

type Props = {
  venue: {
    id: string;
    name: string;
    slug: string;
    city?: string | null;
    province?: string | null;
    capacity_max?: number | null;
  };
  services: Array<{ id: string; name: string }>;
};

export default function ReservaEspacio({ venue, services }: Props) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [extras, setExtras] = useState<string[]>([]);

  const [f, setF] = useState({
    fechaEntrada: "",
    horaEntrada: "",
    fechaSalida: "",
    horaSalida: "",
    adultos: "1",
    ninos: "0",
    duermen: "0",
    tipo: "cumpleanos",
    presupuesto: "",
    nombre: "",
    telefono: "",
    email: "",
    notas: "",
  });

  const set = (key: keyof typeof f, value: string) => {
    setF(previous => ({ ...previous, [key]: value }));
  };

  const total = Number(f.adultos) + Number(f.ninos);
  const maximo = Number(venue.capacity_max) || null;

  const toggleService = (name: string) => {
    setExtras(previous =>
      previous.includes(name)
        ? previous.filter(item => item !== name)
        : [...previous, name]
    );
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;

    setError("");

    const entrada = new Date(
      `${f.fechaEntrada}T${f.horaEntrada}:00`
    );
    const salida = new Date(
      `${f.fechaSalida}T${f.horaSalida}:00`
    );

    if (
      Number.isNaN(entrada.getTime()) ||
      Number.isNaN(salida.getTime()) ||
      salida <= entrada
    ) {
      setError("La salida debe ser posterior a la entrada.");
      return;
    }

    if (entrada.getTime() < Date.now() - 60000) {
      setError("Seleccioná una fecha y hora futuras.");
      return;
    }

    if (total < 1 || (maximo && total > maximo)) {
      setError(
        maximo
          ? `El máximo registrado es de ${maximo} personas.`
          : "Indicá la cantidad de asistentes."
      );
      return;
    }

    if (
      Number(f.duermen) < 0 ||
      Number(f.duermen) > total
    ) {
      setError("Revisá la cantidad de personas que dormirían.");
      return;
    }

    setSending(true);

    try {
      const resumen = [
        `PROPIEDAD: ${venue.name}`,
        `VENUE_ID: ${venue.id}`,
        `VENUE_SLUG: ${venue.slug}`,
        `ENTRADA: ${f.fechaEntrada} ${f.horaEntrada}`,
        `SALIDA: ${f.fechaSalida} ${f.horaSalida}`,
        `ADULTOS: ${f.adultos}`,
        `NIÑOS: ${f.ninos}`,
        `PERSONAS QUE NECESITAN DORMIR: ${f.duermen}`,
        "Pernoctación sujeta a normas y autorización del espacio.",
        `SERVICIOS ADICIONALES: ${extras.join(", ") || "Ninguno"}`,
        `COMENTARIOS: ${f.notas || "Sin comentarios"}`,
      ].join("\n");

      const response = await fetch(
        "/api/public/lead-requests",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerName: f.nombre.trim(),
            whatsapp: f.telefono.trim(),
            email: f.email.trim() || null,
            eventType: f.tipo,
            serviceMode: null,
            eventDate: f.fechaEntrada,
            eventStartTime: f.horaEntrada,
            eventEndTime: f.horaSalida,
            dateFlexible: false,
            alternativeDate: null,
            autonomousCommunity: null,
            province: venue.province || null,
            municipality: venue.city || null,
            postalCode: null,
            guestCount: total,
            budgetInitial: null,
            budgetMax: f.presupuesto
              ? Number(f.presupuesto)
              : null,
            requestedServices: extras,
            customerMessage: resumen,
            preferredMunicipalityId: null,
            locationFlexibility: null,
            venueId: venue.id,
          }),
        }
      );

      const result = await response.json().catch(() => ({}));

      if (!response.ok || result.ok === false) {
        throw new Error(
          typeof result.error === "string"
            ? result.error
            : `No se pudo enviar la solicitud (${response.status}).`
        );
      }

      setSent(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al enviar."
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => {
          setError("");
          setOpen(true);
        }}
      >
        Consultar disponibilidad y reservar
      </button>

      {open && (
        <div
          className={styles.backdrop}
          onMouseDown={event => {
            if (event.target === event.currentTarget) {
              setOpen(false);
            }
          }}
        >
          <section
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-label={`Solicitar ${venue.name}`}
          >
            <div className={styles.header}>
              <div>
                <span className={styles.eyebrow}>
                  EVENTOS MEDITERRÁNEO
                </span>
                <h2>Planificá tu reserva</h2>
                <p>{venue.name} · {venue.city || "Valencia"}</p>
              </div>
              <button
                type="button"
                className={styles.close}
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>

            {sent ? (
              <div className={styles.success}>
                <h3>Solicitud recibida</h3>
                <p>
                  Registramos tu consulta para {venue.name}.
                  Confirmaremos disponibilidad y condiciones
                  antes de formalizar la reserva.
                </p>
                <button
                  type="button"
                  className={styles.submit}
                  onClick={() => setOpen(false)}
                >
                  Volver al espacio
                </button>
              </div>
            ) : (
              <form onSubmit={submit} className={styles.form}>
                <h3>1. Fechas y horarios</h3>
                <div className={styles.grid}>
                  <label>
                    Fecha de entrada
                    <input
                      type="date"
                      required
                      value={f.fechaEntrada}
                      onChange={e => set("fechaEntrada", e.target.value)}
                    />
                  </label>
                  <label>
                    Hora de entrada
                    <input
                      type="time"
                      required
                      value={f.horaEntrada}
                      onChange={e => set("horaEntrada", e.target.value)}
                    />
                  </label>
                  <label>
                    Fecha de salida
                    <input
                      type="date"
                      required
                      value={f.fechaSalida}
                      onChange={e => set("fechaSalida", e.target.value)}
                    />
                  </label>
                  <label>
                    Hora de salida
                    <input
                      type="time"
                      required
                      value={f.horaSalida}
                      onChange={e => set("horaSalida", e.target.value)}
                    />
                  </label>
                </div>

                <h3>2. Invitados y alojamiento</h3>
                <div className={styles.grid}>
                  <label>
                    Adultos
                    <input
                      type="number"
                      min="1"
                      max={maximo ?? undefined}
                      required
                      value={f.adultos}
                      onChange={e => set("adultos", e.target.value)}
                    />
                  </label>
                  <label>
                    Niños
                    <input
                      type="number"
                      min="0"
                      value={f.ninos}
                      onChange={e => set("ninos", e.target.value)}
                    />
                  </label>
                  <label>
                    Personas que necesitan dormir
                    <input
                      type="number"
                      min="0"
                      value={f.duermen}
                      onChange={e => set("duermen", e.target.value)}
                    />
                  </label>
                  <label>
                    Tipo de evento
                    <select
                      value={f.tipo}
                      onChange={e => set("tipo", e.target.value)}
                    >
                      <option value="cumpleanos">Cumpleaños</option>
                      <option value="boda">Boda</option>
                      <option value="empresa">Evento empresarial</option>
                      <option value="reunion">Reunión privada</option>
                      <option value="otro">Otro evento</option>
                    </select>
                  </label>
                </div>

                <p className={styles.note}>
                  {total} asistentes.
                  {maximo ? ` Aforo máximo registrado: ${maximo}.` : ""}
                  {" "}La pernoctación y los horarios deben ser
                  autorizados por el propietario.
                </p>

                <h3>3. Servicios adicionales</h3>
                <div className={styles.extras}>
                  {services.map(service => (
                    <label key={service.id} className={styles.extra}>
                      <input
                        type="checkbox"
                        checked={extras.includes(service.name)}
                        onChange={() => toggleService(service.name)}
                      />
                      {service.name}
                    </label>
                  ))}
                </div>

                <h3>4. Datos de contacto</h3>
                <div className={styles.grid}>
                  <label>
                    Nombre y apellido
                    <input
                      required
                      value={f.nombre}
                      onChange={e => set("nombre", e.target.value)}
                      placeholder="Tu nombre"
                    />
                  </label>
                  <label>
                    WhatsApp
                    <input
                      type="tel"
                      required
                      value={f.telefono}
                      onChange={e => set("telefono", e.target.value)}
                      placeholder="+34 600 000 000"
                    />
                  </label>
                  <label>
                    Correo electrónico
                    <input
                      type="email"
                      value={f.email}
                      onChange={e => set("email", e.target.value)}
                      placeholder="correo@ejemplo.com"
                    />
                  </label>
                  <label>
                    Presupuesto máximo (€)
                    <input
                      type="number"
                      min="0"
                      value={f.presupuesto}
                      onChange={e => set("presupuesto", e.target.value)}
                      placeholder="Opcional"
                    />
                  </label>
                </div>

                <label className={styles.full}>
                  Información adicional
                  <textarea
                    rows={3}
                    value={f.notas}
                    onChange={e => set("notas", e.target.value)}
                    placeholder="Contanos qué necesitás para tu evento."
                  />
                </label>

                {error && <p className={styles.error}>{error}</p>}

                <div className={styles.footer}>
                  <p>
                    Enviar esta solicitud no confirma una reserva
                    ni implica un cobro.
                  </p>
                  <button
                    className={styles.submit}
                    type="submit"
                    disabled={sending}
                  >
                    {sending
                      ? "Enviando solicitud..."
                      : "Solicitar disponibilidad"}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}
    </>
  );
}
