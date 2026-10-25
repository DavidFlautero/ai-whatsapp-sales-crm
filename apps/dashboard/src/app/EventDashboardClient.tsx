"use client";

import Link from "next/link";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";


type Customer = {
  id: string;
  name: string;
};

type CRMEvent = {
  id: string;
  customer_id: string;
  title: string;
  event_type: string;
  status: string;
  event_date?: string | null;
  guest_count?: number | null;
  city?: string | null;
  next_action?: string | null;
  next_action_at?: string | null;
};

type Quote = {
  id: string;
  event_id: string;
  status: string;
  final_price?: number | string;
  subtotal_price?: number | string;
};

type Provider = {
  id: string;
  name: string;
};

type LeadRequest = {
  id: string;
  status: string;
  customer_name?: string | null;
  event_type?: string | null;
  municipality?: string | null;
  province?: string | null;
  created_at?: string | null;
};

type CRMMe = {
  admin: boolean;
  role: string;
  crmRole: string;
  member: {
    id: string;
    name: string;
  };
};

const API = "/api";

const closedEventStatuses =
  new Set([
    "completed",
    "lost",
    "cancelled",
  ]);

const closedQuoteStatuses =
  new Set([
    "accepted",
    "rejected",
    "expired",
    "cancelled",
  ]);


async function api<T>(
  pathname: string,
  init: RequestInit = {},
): Promise<T> {
  const response =
    await fetch(
      `${API}${pathname}`,
      {
        ...init,
        credentials: "include",
        cache: "no-store",
        headers: {
          Accept:
            "application/json",
          "Content-Type":
            "application/json",
          ...init.headers,
        },
      },
    );

  const body =
    await response
      .json()
      .catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      body?.error
      ?? `HTTP_${response.status}`,
    );
  }

  return body as T;
}


function money(
  value:
    | number
    | string
    | null
    | undefined,
) {
  const amount =
    Number(value ?? 0);

  return new Intl.NumberFormat(
    "es-ES",
    {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    },
  ).format(
    Number.isFinite(amount)
      ? amount
      : 0,
  );
}


function eventDate(
  value?: string | null,
) {
  if (!value) {
    return "Fecha por definir";
  }

  const date =
    new Date(
      value.includes("T")
        ? value
        : `${value}T12:00:00`,
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
      day: "2-digit",
      month: "short",
      year: "numeric",
    },
  ).format(date);
}


export function EventDashboardClient() {
  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  const [
    me,
    setMe,
  ] =
    useState<CRMMe | null>(
      null,
    );

  const [
    customers,
    setCustomers,
  ] =
    useState<Customer[]>([]);

  const [
    events,
    setEvents,
  ] =
    useState<CRMEvent[]>([]);

  const [
    providers,
    setProviders,
  ] =
    useState<Provider[]>([]);

  const [
    quotes,
    setQuotes,
  ] =
    useState<Quote[]>([]);

  const [
    leadRequests,
    setLeadRequests,
  ] =
    useState<LeadRequest[]>([]);


  const load =
    useCallback(
      async () => {
        setError(null);

        try {
          await api(
            "/crm/bootstrap",
            {
              method:
                "POST",
            },
          );

          const [
            meBody,
            customerBody,
            eventBody,
            providerBody,
          ] =
            await Promise.all([
              api<CRMMe>(
                "/crm/me",
              ),

              api<{
                customers:
                  Customer[];
              }>(
                "/crm/customers",
              ),

              api<{
                events:
                  CRMEvent[];
              }>(
                "/crm/events",
              ),

              api<{
                providers:
                  Provider[];
              }>(
                "/crm/providers",
              ),

              api<{
                requests:
                  LeadRequest[];
              }>(
                "/crm/lead-requests",
              ),
            ]);

          setMe(meBody);

          setCustomers(
            customerBody.customers
            ?? [],
          );

          setEvents(
            eventBody.events
            ?? [],
          );

          setProviders(
            providerBody.providers
            ?? [],
          );

          const quoteSets =
            await Promise.all(
              (
                eventBody.events
                ?? []
              ).map(
                async (event) => {
                  try {
                    const result =
                      await api<{
                        quotes:
                          Quote[];
                      }>(
                        `/crm/events/${event.id}/quotes`,
                      );

                    return (
                      result.quotes
                      ?? []
                    );
                  } catch {
                    return [];
                  }
                },
              ),
            );

          setQuotes(
            quoteSets.flat(),
          );
        } catch (
          loadError
        ) {
          setError(
            loadError
              instanceof Error
              ? loadError.message
              : "No se pudo cargar el panel.",
          );
        } finally {
          setLoading(false);
        }
      },
      [],
    );


  useEffect(
    () => {
      void load();
    },
    [load],
  );


  const customerMap =
    useMemo(
      () =>
        new Map(
          customers.map(
            (customer) => [
              customer.id,
              customer,
            ],
          ),
        ),
      [customers],
    );


  const activeEvents =
    useMemo(
      () =>
        events.filter(
          (event) =>
            !closedEventStatuses
              .has(
                event.status,
              ),
        ),
      [events],
    );


  const openQuotes =
    useMemo(
      () =>
        quotes.filter(
          (quote) =>
            !closedQuoteStatuses
              .has(
                quote.status,
              ),
        ),
      [quotes],
    );


  const acceptedRevenue =
    useMemo(
      () =>
        quotes
          .filter(
            (quote) =>
              quote.status
              === "accepted",
          )
          .reduce(
            (
              total,
              quote,
            ) =>
              total
              + Number(
                quote.final_price
                ?? quote.subtotal_price
                ?? 0,
              ),
            0,
          ),
      [quotes],
    );


  const newLeadRequests =
    useMemo(
      () =>
        leadRequests.filter(
          (request) =>
            request.status
            === "new",
        ),
      [leadRequests],
    );


  const pendingActions =
    useMemo(
      () =>
        activeEvents.filter(
          (event) =>
            Boolean(
              event.next_action,
            ),
        ),
      [activeEvents],
    );


  const upcomingEvents =
    useMemo(
      () =>
        [...activeEvents]
          .sort(
            (
              left,
              right,
            ) => {
              const a =
                left.event_date
                  ? new Date(
                      left.event_date,
                    ).getTime()
                  : Number
                      .MAX_SAFE_INTEGER;

              const b =
                right.event_date
                  ? new Date(
                      right.event_date,
                    ).getTime()
                  : Number
                      .MAX_SAFE_INTEGER;

              return a - b;
            },
          )
          .slice(
            0,
            6,
          ),
      [activeEvents],
    );


  if (loading) {
    return (
      <div
        className="company-dashboard-card"
      >
        Preparando operación de Eventos Mediterráneo…
      </div>
    );
  }


  return (
    <>
      <section
        className="company-hero"
      >
        <div
          className="company-hero-copy"
        >
          <span
            className="company-eyebrow"
          >
            EVENTOS MEDITERRÁNEO · CENTRO OPERATIVO
          </span>

          <h1>
            Cada evento, desde el primer mensaje hasta la liquidación.
          </h1>

          <p>
            Clientes, proveedores, presupuestos, coordinación,
            seguimiento comercial y comisiones desde una única operación.
          </p>

          <div
            className="company-hero-actions"
          >
            <Link
              className="company-primary-action"
              href="/crm"
            >
              + Nuevo evento
            </Link>

            <Link
              className="company-secondary-action"
              href="/crm"
            >
              Abrir Centro de Eventos
            </Link>
          </div>

          {error ? (
            <p
              style={{
                marginTop: 18,
                color: "#b42318",
                fontWeight: 700,
              }}
            >
              Atención: {error}
            </p>
          ) : null}
        </div>


        <div
          className="company-hero-visual"
          aria-label="Operación de Eventos Mediterráneo"
        >
          <article
            className="company-dashboard-card company-operation-card"
            style={{
              width: "100%",
              height: "100%",
            }}
          >
            <header>
              <div>
                <span
                  className="company-eyebrow"
                >
                  OPERACIÓN ACTUAL
                </span>

                <h2>
                  {me?.admin
                    ? "Vista administrativa"
                    : "Mi operación"}
                </h2>
              </div>
            </header>

            <div
              className="company-operation-list"
            >
              <div>
                <span>
                  Eventos activos
                </span>

                <strong>
                  {
                    activeEvents.length
                  }
                </strong>
              </div>

              <div>
                <span>
                  Acciones pendientes
                </span>

                <strong>
                  {
                    pendingActions.length
                  }
                </strong>
              </div>

              <div>
                <span>
                  Proveedores cargados
                </span>

                <strong>
                  {
                    providers.length
                  }
                </strong>
              </div>

              <div>
                <span>
                  Presupuestos abiertos
                </span>

                <strong>
                  {
                    openQuotes.length
                  }
                </strong>
              </div>
            </div>
          </article>
        </div>
      </section>


      <section
        className="company-live-metrics"
      >
        <article>
          <span>
            Eventos activos
          </span>

          <strong>
            {
              activeEvents.length
            }
          </strong>

          <small>
            En captación, presupuesto o coordinación
          </small>
        </article>

        <article>
          <span>
            Clientes
          </span>

          <strong>
            {
              customers.length
            }
          </strong>

          <small>
            Base comercial de Eventos Mediterráneo
          </small>
        </article>

        <article>
          <span>
            Presupuestos abiertos
          </span>

          <strong>
            {
              openQuotes.length
            }
          </strong>

          <small>
            Pendientes de cierre o respuesta
          </small>
        </article>

        <article>
          <span>
            Ventas confirmadas
          </span>

          <strong>
            {
              money(
                acceptedRevenue,
              )
            }
          </strong>

          <small>
            Presupuestos aceptados
          </small>
        </article>
      </section>


      <section
        className="company-dashboard-grid"
      >
        <article
          className="company-dashboard-card company-leads-card"
        >
          <header>
            <div>
              <span
                className="company-eyebrow"
              >
                SIGUIENTE ACCIÓN
              </span>

              <h2>
                Qué requiere atención
              </h2>
            </div>

            <Link href="/crm/eventos">
              Ver todos
            </Link>
          </header>

          <div
            className="company-lead-list"
          >
            {pendingActions.length
              === 0
              ? (
                <div
                  className="company-empty-state"
                >
                  <strong>
                    No hay acciones pendientes
                  </strong>

                  <span>
                    Cuando un evento necesite seguimiento aparecerá aquí.
                  </span>

                  <Link
                    className="company-primary-action"
                    href="/crm"
                  >
                    Crear evento
                  </Link>
                </div>
              )
              : pendingActions
                  .slice(
                    0,
                    6,
                  )
                  .map(
                    (event) => (
                      <div
                        className="company-lead-row"
                        key={
                          event.id
                        }
                        role="link"
                        tabIndex={0}
                        style={{
                          cursor: "pointer",
                        }}
                        onClick={() => {
                          window.location.assign(
                            `/crm/eventos/${event.id}`,
                          );
                        }}
                        onKeyDown={(keyboardEvent) => {
                          if (
                            keyboardEvent.key === "Enter"
                            ||
                            keyboardEvent.key === " "
                          ) {
                            keyboardEvent.preventDefault();

                            window.location.assign(
                              `/crm/eventos/${event.id}`,
                            );
                          }
                        }}
                      >
                        <span
                          className="company-score"
                        >
                          !
                        </span>

                        <div>
                          <strong>
                            {
                              event.next_action
                            }
                          </strong>

                          <small>
                            {
                              event.title
                            }
                            {" · "}
                            {
                              customerMap
                                .get(
                                  event.customer_id,
                                )
                                ?.name
                              ?? "Cliente"
                            }
                          </small>

                          <p>
                            {
                              eventDate(
                                event.next_action_at
                                ?? event.event_date,
                              )
                            }
                          </p>
                        </div>
                      </div>
                    ),
                  )}
          </div>
        </article>


        <article
          className="company-dashboard-card company-operation-card"
        >
          <header>
            <div>
              <span
                className="company-eyebrow"
              >
                AGENDA OPERATIVA
              </span>

              <h2>
                Próximos eventos
              </h2>
            </div>

            <Link href="/crm/eventos">
              Abrir eventos
            </Link>
          </header>

          <div
            className="company-operation-list"
          >
            {upcomingEvents.length
              === 0
              ? (
                <div>
                  <span>
                    Sin eventos programados
                  </span>

                  <strong>
                    —
                  </strong>
                </div>
              )
              : upcomingEvents.map(
                  (event) => (
                    <div
                      key={
                        event.id
                      }
                    >
                      <span>
                        <strong>
                          {
                            event.title
                          }
                        </strong>
                        <br />

                        {
                          eventDate(
                            event.event_date,
                          )
                        }
                        {" · "}
                        {
                          event.city
                          ?? "Ubicación pendiente"
                        }
                      </span>

                      <strong>
                        {
                          event.guest_count
                          ? `${event.guest_count} pax`
                          : event.event_type
                        }
                      </strong>
                    </div>
                  ),
                )}
          </div>

          <div
            className="company-operation-actions"
          >
            <Link href="/crm/eventos">
                Gestionar eventos
              </Link>

            <Link href="/conversations">
              Ver conversaciones
            </Link>
          </div>
        </article>
      </section>


      <section
        className="company-quick-section company-quick-section--compact"
      >
        <header
          className="company-quick-compact-header"
        >
          <div>
            <span
              className="company-eyebrow"
            >
              ACCESOS RÁPIDOS
            </span>

            <h2>
              Herramientas principales
            </h2>

            <p>
              Entrá directo a lo que usás durante la operación.
            </p>
          </div>
        </header>


        <div
          className="company-quick-compact-grid"
        >
          {[
            {
              title:
                "Nuevo evento",

              description:
                "Crear solicitud y comenzar una nueva operación.",

              meta:
                "Crear ahora",

              href:
                "/crm",

              icon:
                "+",

              featured:
                true,
            },

            {
              title:
                "Agenda",

              description:
                "Fechas, próximos eventos y Google Calendar.",

              meta:
                `${activeEvents.length} eventos activos`,

              href:
                "/agenda",

              icon:
                "AG",

              featured:
                false,
            },

            {
              title:
                "Presupuestos",

              description:
                "Propuestas pendientes de preparar o cerrar.",

              meta:
                `${openQuotes.length} abiertos`,

              href:
                "/crm",

              icon:
                "€",

              featured:
                false,
            },

            {
              title:
                "Proveedores",

              description:
                "Red operativa disponible para cada servicio.",

              meta:
                `${providers.length} cargados`,

              href:
                "/crm",

              icon:
                "PV",

              featured:
                false,
            },

            {
              title:
                "Conversaciones",

              description:
                "WhatsApp, clientes y seguimiento comercial.",

              meta:
                "Abrir bandeja",

              href:
                "/conversations",

              icon:
                "WA",

              featured:
                false,
            },

            {
              title:
                "Integraciones",

              description:
                "Calendar, WhatsApp, IA y servicios conectados.",

              meta:
                "Configurar",

              href:
                "/integrations",

              icon:
                "IN",

              featured:
                false,
            },
          ].map(
            (item) => (
              <Link
                key={
                  item.title
                }
                href={
                  item.href
                }
                className={
                  item.featured
                    ? "company-quick-compact-card is-featured"
                    : "company-quick-compact-card"
                }
              >
                <span
                  className="company-quick-compact-icon"
                >
                  {
                    item.icon
                  }
                </span>

                <span
                  className="company-quick-compact-copy"
                >
                  <strong>
                    {
                      item.title
                    }
                  </strong>

                  <small>
                    {
                      item.description
                    }
                  </small>

                  <em>
                    {
                      item.meta
                    }
                  </em>
                </span>

                <span
                  className="company-quick-compact-arrow"
                >
                  →
                </span>
              </Link>
            ),
          )}
        </div>
      </section>
    </>
  );
}
