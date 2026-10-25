"use client";

import {
  useEffect,
  useState,
} from "react";

import Link from "next/link";

import styles from "./commercial-dashboard.module.css";


type EventItem = {
  id: string;
  title?: string | null;
  event_date?: string | null;
  status?: string | null;
  target_budget?: number | string | null;
  city?: string | null;
  guest_count?: number | null;
  next_action?: string | null;

  readiness?: {
    readiness_percent?: number | string | null;
    critical_pending?: number | string | null;
    without_provider?: number | string | null;
    payments_pending?: number | string | null;
  } | null;

  attention?: {
    critical: number;
    providers: number;
    payments: number;
    readinessPercent: number;
    score: number;
    daysUntilEvent?: number | null;
    severity?:
      | "critical"
      | "high"
      | "medium"
      | "low";
  };

  actions?: Array<{
    type: string;
    priority: "high" | "medium" | "low";
    title: string;
    description: string;
  }>;
};


type DashboardData = {
  ok: boolean;
  generatedAt?: string;

  urgency?: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };

  counters: {
    activeEvents: number;
    upcomingEvents: number;
    attentionEvents: number;
    criticalServices: number;
    withoutProvider: number;
    paymentsPending: number;
  };

  upcomingEvents: EventItem[];
  attentionEvents: EventItem[];

  criticalServices: Array<{
    event_id?: string | null;
    service_name?: string | null;
    service_status?: string | null;
  }>;

  withoutProvider: Array<{
    event_id?: string | null;
    service_name?: string | null;
  }>;

  paymentsPending: Array<{
    event_id?: string | null;
    service_name?: string | null;
    deposit_required?: number | string | null;
    deposit_paid?: number | string | null;
  }>;
};


type ProviderOperationRow = {
  id?: string;
  event_id?: string | null;
  requirement_id?: string | null;
  provider_id?: string | null;
  status?: string | null;
  checked_at?: string | null;

  provider?: {
    id?: string;
    name?: string | null;
  } | null;

  requirement?: {
    id?: string;
    service_name?: string | null;
  } | null;
};

type ProviderOperationsData = {
  counters: {
    total: number;
    requested: number;
    available: number;
    tentative: number;
    unavailable: number;
    reserved: number;
    unknown: number;
    overdue: number;
  };

  overdue: ProviderOperationRow[];
  requested: ProviderOperationRow[];
  available: ProviderOperationRow[];
};

type Props = {
  events?: EventItem[];
};


function dateLabel(
  value?: string | null,
) {
  if (!value) {
    return "Sin fecha";
  }

  const date =
    new Date(
      `${value.slice(
        0,
        10,
      )}T12:00:00`,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "es-ES",
    {
      day:
        "2-digit",

      month:
        "short",
    },
  ).format(
    date,
  );
}


function eventTitle(
  event: EventItem,
) {
  return (
    event.title
    ?? "Evento sin título"
  );
}


export function CommercialDashboard({
  events = [],
}: Props) {
  const [
    data,
    setData,
  ] =
    useState<
      DashboardData
      | null
    >(
      null,
    );

  const [
    loading,
    setLoading,
  ] =
    useState(
      true,
    );

  const [
    error,
    setError,
  ] =
    useState<
      string
      | null
    >(
      null,
    );

  const [
    newLeadRequests,
    setNewLeadRequests,
  ] =
    useState(0);

  const [
    providerOperations,
    setProviderOperations,
  ] =
    useState<
      ProviderOperationsData
      | null
    >(null);


  useEffect(
    () => {
      let active =
        true;

      async function load() {
        try {
          setLoading(
            true,
          );

          setError(
            null,
          );

          const response =
            await fetch(
              "/api/crm/operations/dashboard",
              {
                credentials:
                  "include",

                cache:
                  "no-store",
              },
            );

          const body =
            await response
              .json()
              .catch(
                () => ({}),
              );

          if (
            !response.ok
          ) {
            throw new Error(
              body?.error
              ?? `HTTP_${response.status}`,
            );
          }

          if (
            active
          ) {
            setData(
              body,
            );
          }

          try {
            const providerResponse =
              await fetch(
                "/api/crm/operations/providers",
                {
                  credentials:
                    "include",
                  cache:
                    "no-store",
                },
              );

            const providerBody =
              await providerResponse
                .json()
                .catch(() => ({}));

            if (
              active
              && providerResponse.ok
            ) {
              setProviderOperations(
                providerBody,
              );
            }
          } catch {
            // El dashboard principal continúa operativo.
          }

          try {
            const leadResponse =
              await fetch(
                "/api/crm/lead-requests",
                {
                  credentials:
                    "include",
                  cache:
                    "no-store",
                },
              );

            const leadBody =
              await leadResponse
                .json()
                .catch(() => ({}));

            if (
              active
              && leadResponse.ok
            ) {
              const requests =
                Array.isArray(
                  leadBody?.requests,
                )
                  ? leadBody.requests
                  : [];

              setNewLeadRequests(
                requests.filter(
                  (
                    item:
                      {
                        status?: string;
                      },
                  ) =>
                    item.status
                    === "new",
                ).length,
              );
            }
          } catch {
            // No bloquea el dashboard operativo.
          }
        } catch (
          caught
        ) {
          if (
            active
          ) {
            setError(
              caught
                instanceof Error
                ? caught.message
                : "No se pudo cargar el control operativo.",
            );
          }
        } finally {
          if (
            active
          ) {
            setLoading(
              false,
            );
          }
        }
      }

      void load();

      const timer =
        window.setInterval(
          () => {
            void load();
          },
          60000,
        );

      return () => {
        active =
          false;

        window.clearInterval(
          timer,
        );
      };
    },
    [],
  );


  const upcoming =
    data
      ?.upcomingEvents
    ?? events.slice(
      0,
      8,
    );

  const attention =
    data
      ?.attentionEvents
    ?? [];

  const counters =
    data
      ?.counters
    ?? {
      activeEvents:
        events.length,

      upcomingEvents:
        upcoming.length,

      attentionEvents:
        0,

      criticalServices:
        0,

      withoutProvider:
        0,

      paymentsPending:
        0,
    };


  return (
    <section
      className={
        styles.root
      }
    >
      <header
        className={
          styles.header
        }
      >
        <div>
          <span>
            CENTRO OPERATIVO
          </span>

          <h1>
            Qué requiere atención
          </h1>

          <p>
            Eventos, servicios,
            proveedores y pagos que
            necesitan una acción.
          </p>
        </div>

        <div>
          {data?.generatedAt ? (
            <small>
              Actualizado{" "}
              {new Intl.DateTimeFormat(
                "es-ES",
                {
                  hour: "2-digit",
                  minute: "2-digit",
                },
              ).format(
                new Date(
                  data.generatedAt,
                ),
              )}
            </small>
          ) : null}

          <button
            type="button"
            className={
              styles.primary
            }
            disabled={loading}
            onClick={() => {
              window.location.reload();
            }}
          >
            {loading
              ? "Actualizando…"
              : "Actualizar"}
          </button>
        </div>
      </header>


      {error ? (
        <div
          style={{
            padding:
              12,

            marginBottom:
              12,

            border:
              "1px solid #fecaca",

            borderRadius:
              10,
          }}
        >
          {error}
        </div>
      ) : null}


      {data?.urgency ? (
        <div className={styles.metrics}>
          <article data-severity="critical">
            <span>Críticos</span>
            <strong>{data.urgency.critical}</strong>
            <small>Atención inmediata</small>
          </article>

          <article data-severity="high">
            <span>Prioridad alta</span>
            <strong>{data.urgency.high}</strong>
            <small>Resolver hoy</small>
          </article>

          <article data-severity="medium">
            <span>Prioridad media</span>
            <strong>{data.urgency.medium}</strong>
            <small>Seguimiento</small>
          </article>
        </div>
      ) : null}

      <div
        className={
          styles.metrics
        }
      >
        <article>
          <span>
            Solicitudes nuevas
          </span>

          <strong>
            {newLeadRequests}
          </strong>

          <small>
            Leads sin revisar
          </small>
        </article>
        <article>
          <span>
            Eventos activos
          </span>

          <strong>
            {
              counters
                .activeEvents
            }
          </strong>

          <small>
            Operaciones abiertas
          </small>
        </article>


        <article>
          <span>
            Requieren atención
          </span>

          <strong>
            {
              counters
                .attentionEvents
            }
          </strong>

          <small>
            Eventos con pendientes
          </small>
        </article>


        <article>
          <span>
            Servicios críticos
          </span>

          <strong>
            {
              counters
                .criticalServices
            }
          </strong>

          <small>
            Sin resolver
          </small>
        </article>


        <article>
          <span>
            Sin proveedor
          </span>

          <strong>
            {
              counters
                .withoutProvider
            }
          </strong>

          <small>
            Servicios pendientes
          </small>
        </article>


        <article>
          <span>
            Pagos pendientes
          </span>

          <strong>
            {
              counters
                .paymentsPending
            }
          </strong>

          <small>
            Anticipos por revisar
          </small>
        </article>
      </div>


      <div
        className={
          styles.layout
        }
      >
        <section
          className={
            styles.card
          }
        >
          <div
            className={
              styles.cardHeader
            }
          >
            <div>
              <span>
                ATENCIÓN
              </span>

              <h2>
                Eventos que requieren acción
              </h2>
            </div>
          </div>


          <div
            className={
              styles.eventList
            }
          >
            {loading
              && !data ? (
                <div
                  className={
                    styles.empty
                  }
                >
                  Cargando operación…
                </div>
              ) : null}


            {attention.map(
              event => (
                <Link
                  key={
                    event.id
                  }
                  href={
                    `/crm/eventos/${event.id}`
                  }
                  className={
                    styles.event
                  }
                >
                  <div
                    className={
                      styles.dateBox
                    }
                  >
                    {
                      dateLabel(
                        event
                          .event_date,
                      )
                    }
                  </div>


                  <div
                    className={
                      styles.eventMain
                    }
                  >
                    <strong>
                      {
                        eventTitle(
                          event,
                        )
                      }
                    </strong>

                    <small>
                      {
                        event.city
                        ?? "Sin ciudad"
                      }
                      {" · "}
                      {
                        event
                          .guest_count
                        ?? 0
                      }
                      {" invitados"}
                    </small>

                    <div>
                      {(event.actions ?? [])
                        .slice(0, 3)
                        .map((action) => (
                          <p
                            key={`${event.id}-${action.type}`}
                            data-priority={action.priority}
                          >
                            <strong>{action.title}</strong>
                            {" — "}
                            {action.description}
                          </p>
                        ))}

                      {!event.actions?.length ? (
                        <p>
                          Revisar preparación del evento.
                        </p>
                      ) : null}
                    </div>
                  </div>


                  <div
                    className={
                      styles.eventRight
                    }
                  >
                    <span
                      data-severity={
                        event.attention?.severity
                        ?? "low"
                      }
                    >
                      {
                        event.attention?.severity
                        === "critical"
                          ? "CRÍTICO"
                          : event.attention?.severity
                            === "high"
                              ? "ALTA"
                              : event.attention?.severity
                                === "medium"
                                  ? "MEDIA"
                                  : "BAJA"
                      }
                    </span>

                    <strong>
                      {
                        event
                          .attention
                          ?.readinessPercent
                        ?? 0
                      }
                      %
                    </strong>

                    <small>
                      {
                        event.attention?.daysUntilEvent
                        !== null
                        && event.attention?.daysUntilEvent
                        !== undefined
                          ? `${event.attention.daysUntilEvent} días`
                          : "Sin fecha"
                      }
                    </small>
                  </div>
                </Link>
              ),
            )}


            {!loading
            && !attention.length ? (
              <div
                className={
                  styles.empty
                }
              >
                <strong>
                  No hay alertas operativas.
                </strong>

                <p>
                  Los eventos activos no
                  tienen riesgos detectados.
                </p>
              </div>
            ) : null}
          </div>
        </section>


        <aside
          className={
            styles.side
          }
        >
          <section
            className={
              styles.card
            }
          >
            <div
              className={
                styles.cardHeader
              }
            >
              <div>
                <span>
                  PRÓXIMOS 30 DÍAS
                </span>

                <h2>
                  Próximos eventos
                </h2>
              </div>
            </div>


            <div
              className={
                styles.eventList
              }
            >
              {upcoming.map(
                event => (
                  <Link
                    key={
                      event.id
                    }
                    href={
                      `/crm/eventos/${event.id}`
                    }
                    className={
                      styles.event
                    }
                  >
                    <div
                      className={
                        styles.dateBox
                      }
                    >
                      {
                        dateLabel(
                          event
                            .event_date,
                        )
                      }
                    </div>

                    <div
                      className={
                        styles.eventMain
                      }
                    >
                      <strong>
                        {
                          eventTitle(
                            event,
                          )
                        }
                      </strong>

                      <small>
                        {
                          event.status
                          ?? "Sin estado"
                        }
                      </small>
                    </div>
                  </Link>
                ),
              )}


              {!upcoming.length ? (
                <div
                  className={
                    styles.empty
                  }
                >
                  No hay eventos próximos.
                </div>
              ) : null}
            </div>
          </section>
        </aside>
      </div>

      {data ? (
        <div className={styles.layout}>
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <span>COLA OPERATIVA</span>
                <h2>Servicios críticos</h2>
              </div>
            </div>

            <div className={styles.tasks}>
              {data.criticalServices.slice(0, 8).map(
                (item, index) => (
                  <Link
                    key={`${item.event_id}-${index}`}
                    href={`/crm/eventos/${item.event_id ?? ""}`}
                  >
                    {item.service_name ?? "Servicio"}
                    {" · "}
                    {item.service_status ?? "Pendiente"}
                  </Link>
                ),
              )}

              {!data.criticalServices.length ? (
                <span>Sin servicios críticos pendientes.</span>
              ) : null}
            </div>
          </section>

          <aside className={styles.side}>
            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <span>PROVEEDORES</span>
                  <h2>Sin asignar</h2>
                </div>
              </div>

              <div className={styles.tasks}>
                {data.withoutProvider.slice(0, 6).map(
                  (item, index) => (
                    <Link
                      key={`${item.event_id}-${index}`}
                      href={`/crm/eventos/${item.event_id ?? ""}`}
                    >
                      {item.service_name ?? "Servicio pendiente"}
                    </Link>
                  ),
                )}

                {!data.withoutProvider.length ? (
                  <span>Todos los servicios tienen proveedor.</span>
                ) : null}
              </div>
            </section>
          </aside>
        </div>
      ) : null}
      {providerOperations ? (
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <span>PROVEEDORES</span>
              <h2>Disponibilidad operativa</h2>
            </div>
          </div>

          <div className={styles.metrics}>
            <article>
              <span>Esperando respuesta</span>
              <strong>
                {providerOperations.counters.requested}
              </strong>
            </article>

            <article>
              <span>Disponibles</span>
              <strong>
                {providerOperations.counters.available}
              </strong>
            </article>

            <article>
              <span>Sin respuesta +24 h</span>
              <strong>
                {providerOperations.counters.overdue}
              </strong>
            </article>

            <article>
              <span>Reservados</span>
              <strong>
                {providerOperations.counters.reserved}
              </strong>
            </article>
          </div>

          <div className={styles.tasks}>
            {providerOperations.overdue
              .slice(0, 8)
              .map(
                (item, index) => (
                  <Link
                    key={`${item.provider_id}-${item.requirement_id}-${index}`}
                    href={`/crm/eventos/${item.event_id ?? ""}`}
                  >
                    <strong>
                      {item.provider?.name ?? "Proveedor"}
                    </strong>
                    {" · "}
                    {item.requirement?.service_name ?? "Servicio"}
                    {" · sin respuesta"}
                  </Link>
                ),
              )}

            {!providerOperations.overdue.length ? (
              <span>
                No hay proveedores vencidos.
              </span>
            ) : null}
          </div>
        </section>
      ) : null}

    </section>
  );
}
