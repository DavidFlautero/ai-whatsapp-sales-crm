"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";


import {
  EventServicesPanel,
} from "./EventServicesPanel";

import {
  EventReadinessBar,
} from "./EventReadinessBar";

import type {
  EventServiceRequirement,
} from "./event-service.types";

import {
  EventExecutiveSummary,
} from "./EventExecutiveSummary";

import {
  EventProviderRecommendations,
} from "./EventProviderRecommendations";

import {
  EventCoordinationTimeline,
} from "./EventCoordinationTimeline";

import {
  EventFinanceSnapshot,
} from "./EventFinanceSnapshot";

import {
  EventActivityFeed,
} from "./EventActivityFeed";

import {
  EventQuotePreview,
} from "./EventQuotePreview";

import {
  EventResponsiblesPanel,
} from "./EventResponsiblesPanel";

import {
  EventOperationsSuite,
} from "./EventOperationsSuite";

import styles from "./event-workspace.module.css";


type CRMEventLike = {
  id: string;
  customer_id: string;
  title: string;
  event_type: string;
  status: string;

  event_date?: string | null;

  event_end_date?:
    string | null;
  start_time?: string | null;
  end_time?: string | null;

  guest_count?: number | null;

  city?: string | null;
  province?: string | null;
  venue_name?: string | null;
  venue_address?: string | null;

  drive_folder_url?:
    string | null;

  target_budget?: number | string | null;
  final_client_price?: number | string | null;
  final_provider_cost?: number | string | null;
  direct_expenses?: number | string | null;
  gross_margin?: number | string | null;

  next_action?: string | null;
  next_action_at?: string | null;

  customer_request?: string | null;
  notes?: string | null;

  google_calendar_event_id?: string | null;
  google_calendar_html_link?: string | null;
  google_calendar_sync_status?: string | null;
  google_calendar_synced_at?: string | null;
  google_calendar_sync_error?: string | null;
};


type CustomerLike = {
  id: string;
  name: string;

  whatsapp?: string | null;
  email?: string | null;
};


type CategoryLike = {
  id: string;
  code: string;
  name: string;
};


type ProviderLike = {
  id: string;
  name: string;

  contact_name?: string | null;
  whatsapp?: string | null;

  city?: string | null;
  province?: string | null;
  service_area?: string | null;

  internal_rating?: number | string | null;
  times_used?: number | null;
  incident_count?: number | null;
};


type ProviderServiceLike = {
  id: string;

  provider_id: string;
  category_id: string;

  name: string;

  description?: string | null;

  capacity_min?: number | null;
  capacity_max?: number | null;

  lead_time_days?: number | null;

  active?: boolean;
};


type TeamLike = {
  id: string;
  name: string;

  email?: string | null;
};


type Requirement = {
  id: string;

  category_id?: string | null;
  provider_service_id?: string | null;

  title?: string | null;
  description?: string | null;
  notes?: string | null;

  quantity?: number | string | null;
  priority?: number | string | null;

  status?: string | null;
};


type Assignment = {
  id: string;

  team_member_id?: string | null;
  participation_type?: string | null;

  status?: string | null;
  notes?: string | null;
};


type Quote = {
  id: string;
  event_id: string;

  version: number;
  status: string;

  subtotal_price?: number | string | null;
  final_price?: number | string | null;
  commissionable_margin?: number | string | null;

  valid_until?: string | null;
  created_at?: string | null;
};


type Commission = {
  id: string;
  event_id: string;

  participation_type: string;
  commission_amount: number | string;

  status: string;

  team_member_id?: string | null;
};


type EventDetail = {
  ok?: boolean;

  event: CRMEventLike;
  requirements: Requirement[];
  assignments: Assignment[];
};


type Props = {
  event: CRMEventLike;

  customer?: CustomerLike;

  categories: CategoryLike[];
  providers: ProviderLike[];

  providerServices:
    ProviderServiceLike[];
  team: TeamLike[];

  isAdmin: boolean;

  onClose: () => void;
};


const statusLabels:
Record<string, string> = {
  lead: "Nuevo",
  qualifying: "Calificando",
  sourcing: "Buscando proveedores",
  quote_draft: "Presupuesto en preparación",
  quote_sent: "Presupuesto enviado",
  negotiation: "Negociación",
  confirmed: "Confirmado",
  planning: "Coordinación",
  ready: "Listo",
  completed: "Finalizado",
  lost: "Perdido",
  cancelled: "Cancelado",

  draft: "Borrador",
  pending_approval: "Pendiente de aprobación",
  sent: "Enviado",
  viewed: "Visto",
  accepted: "Aceptado",
  rejected: "Rechazado",
  expired: "Vencido",

  estimated: "Estimada",
  locked: "Confirmada",
  payable: "A liquidar",
};


const participationLabels:
Record<string, string> = {
  capture: "Captación",
  closing: "Cierre",
  coordination: "Coordinación",
  onsite: "Responsable presencial",
  administration: "Administración",
};


function money(
  value:
    | number
    | string
    | null
    | undefined,
) {
  const number =
    Number(value ?? 0);

  return new Intl.NumberFormat(
    "es-ES",
    {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 2,
    },
  ).format(
    Number.isFinite(number)
      ? number
      : 0,
  );
}


function dateLabel(
  value?: string | null,
) {
  if (!value) {
    return "Pendiente";
  }

  const date =
    new Date(
      value.length <= 10
        ? `${value}T12:00:00`
        : value,
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


async function api<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response =
    await fetch(
      `/api${path}`,
      {
        credentials:
          "include",

        ...init,

        headers: {
          "Content-Type":
            "application/json",

          ...(init?.headers
            ?? {}),
        },
      },
    );

  const text =
    await response.text();

  let body:
    | Record<string, unknown>
    | null = null;

  if (text) {
    try {
      body =
        JSON.parse(text) as
          Record<
            string,
            unknown
          >;
    } catch {
      body = null;
    }
  }

  if (!response.ok) {
    throw new Error(
      typeof body?.error
        === "string"
        ? body.error
        : `HTTP ${response.status}`,
    );
  }

  return (
    body ?? {}
  ) as T;
}


type Event360Summary = {
  counters: {
    services: number;
    confirmedServices: number;
    criticalOpen: number;
    withoutProvider: number;
    providerRequests: number;
    providersAvailable: number;
    quotes: number;
  };

  readiness?: {
    readiness_percent?: number | string | null;
  } | null;
};

export function EventWorkspace({
  event,
  customer,
  categories,
  providers,
  providerServices,
  team,
  isAdmin,
  onClose,
}: Props) {

  const [
    event360,
    setEvent360,
  ] =
    useState<
      Event360Summary
      | null
    >(null);


  const [
    detail,
    setDetail,
  ] =
    useState<EventDetail | null>(
      null,
    );

  const [
    quotes,
    setQuotes,
  ] =
    useState<Quote[]>([]);

  const [
    commissions,
    setCommissions,
  ] =
    useState<Commission[]>([]);

  const [
    tab,
    setTab,
  ] =
    useState("summary");

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    syncing,
    setSyncing,
  ] =
    useState(false);

  const [
    notice,
    setNotice,
  ] =
    useState<string | null>(
      null,
    );


  const load =
    useCallback(
      async () => {
        setLoading(true);

        try {

        try {
          const summary =
            await api<
              Event360Summary
            >(
              `/crm/events/${event.id}/360`,
            );

          setEvent360(
            summary,
          );
        } catch {
          setEvent360(
            null,
          );
        }


          const detailBody =
            await api<EventDetail>(
              `/crm/events/${event.id}`,
            );

          const quoteBody =
            await api<{
              quotes?: Quote[];
            }>(
              `/crm/events/${event.id}/quotes`,
            ).catch(
              () => ({
                quotes: [],
              }),
            );

          const commissionBody =
            await api<{
              commissions?:
                Commission[];
            }>(
              `/crm/events/${event.id}/commissions`,
            ).catch(
              () => ({
                commissions: [],
              }),
            );

          setDetail(
            detailBody,
          );

          setQuotes(
            quoteBody.quotes
            ?? [],
          );

          setCommissions(
            commissionBody
              .commissions
            ?? [],
          );
        } catch (
          loadError
        ) {
          setNotice(
            loadError
              instanceof Error
              ? loadError.message
              : "No se pudo cargar el evento.",
          );
        } finally {
          setLoading(false);
        }
      },
      [
        event.id,
      ],
    );


  useEffect(
    () => {
      void load();
    },
    [
      load,
    ],
  );


  const current =
    detail?.event
    ?? event;


  const requirements =
    detail?.requirements
    ?? [];


  const assignments =
    detail?.assignments
    ?? [];


  const categoryMap =
    useMemo(
      () =>
        new Map(
          categories.map(
            (category) => [
              category.id,
              category,
            ],
          ),
        ),
      [
        categories,
      ],
    );


  const teamMap =
    useMemo(
      () =>
        new Map(
          team.map(
            (member) => [
              member.id,
              member,
            ],
          ),
        ),
      [
        team,
      ],
    );


  const topProviders =
    useMemo(
      () =>
        [...providers]
          .sort(
            (
              left,
              right,
            ) =>
              Number(
                right.internal_rating
                ?? 0,
              )
              - Number(
                left.internal_rating
                ?? 0,
              ),
          )
          .slice(
            0,
            8,
          ),
      [
        providers,
      ],
    );


  const totalCommission =
    commissions.reduce(
      (
        total,
        commission,
      ) =>
        total
        + Number(
          commission
            .commission_amount
          ?? 0,
        ),
      0,
    );


  async function syncCalendar() {
    setSyncing(true);
    setNotice(null);

    try {
      await api(
        `/admin/google-calendar/events/${event.id}/sync`,
        {
          method:
            "POST",
        },
      );

      setNotice(
        "Evento sincronizado con Google Calendar.",
      );

      await load();
    } catch (
      syncError
    ) {
      setNotice(
        syncError
          instanceof Error
          ? syncError.message
          : "No se pudo sincronizar Calendar.",
      );
    } finally {
      setSyncing(false);
    }
  }


  const whatsapp =
    customer?.whatsapp
      ?.replace(
        /\D/g,
        "",
      );


  if (loading) {
    return (
      <section
        className={
          styles.workspace
        }
      >
        <button
          className={
            styles.backButton
          }
          onClick={
            onClose
          }
          type="button"
        >
          ← Volver a eventos
        </button>

        <div
          className={
            styles.loading
          }
        >
          Cargando operación…
        </div>
      </section>
    );
  }


  return (
    <section
      className={
        styles.workspace
      }
    >
      <div
        className={
          styles.topbar
        }
      >
        <button
          className={
            styles.backButton
          }
          onClick={
            onClose
          }
          type="button"
        >
          ← Todos los eventos
        </button>

        {event360 ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(130px, 1fr))",
              gap: 10,
              marginTop: 14,
              marginBottom: 14,
            }}
          >
            <MiniMetric
              label="Preparación"
              value={`${Number(event360.readiness?.readiness_percent ?? 0)}%`}
            />

            <MiniMetric
              label="Servicios"
              value={`${event360.counters.confirmedServices}/${event360.counters.services}`}
            />

            <MiniMetric
              label="Críticos abiertos"
              value={String(event360.counters.criticalOpen)}
            />

            <MiniMetric
              label="Sin proveedor"
              value={String(event360.counters.withoutProvider)}
            />

            <MiniMetric
              label="Esperando proveedor"
              value={String(event360.counters.providerRequests)}
            />

            <MiniMetric
              label="Disponibles"
              value={String(event360.counters.providersAvailable)}
            />
          </div>
        ) : null}



        <span
          className={
            styles.operationId
          }
        >
          OPERACIÓN
          {" · "}
          {
            current.id
              .slice(
                0,
                8,
              )
              .toUpperCase()
          }
        </span>
      </div>


      <header
        className={
          styles.header
        }
      >
        <div
          className={
            styles.headerMain
          }
        >
          <div
            className={
              styles.headerLine
            }
          >
            <span
              className={
                styles.eventType
              }
            >
              {
                current
                  .event_type
              }
            </span>

            <span
              className={
                styles.status
              }
            >
              {
                statusLabels[
                  current.status
                ]
                ?? current.status
              }
            </span>
          </div>

          <h1>
            {
              current.title
            }
          </h1>

          <p>
            Cliente{" "}
            <strong>
              {
                customer?.name
                ?? "Sin cliente"
              }
            </strong>
          </p>
        </div>


        <div
          className={
            styles.headerActions
          }
        >
          {whatsapp ? (
            <a
              className={
                styles.secondaryAction
              }
              href={
                `https://wa.me/${whatsapp}`
              }
              rel="noreferrer"
              target="_blank"
            >
              WhatsApp
            </a>
          ) : null}

          {isAdmin ? (
            <button
              className={
                styles.primaryAction
              }
              disabled={
                syncing
              }
              onClick={
                () =>
                  void syncCalendar()
              }
              type="button"
            >
              {
                syncing
                  ? "Sincronizando…"
                  : current
                      .google_calendar_event_id
                    ? "Actualizar Calendar"
                    : "Enviar a Calendar"
              }
            </button>
          ) : null}
        </div>
      </header>


      {notice ? (
        <div
          className={
            styles.notice
          }
        >
          {notice}
        </div>
      ) : null}


      <div
        className={
          styles.factGrid
        }
      >
        <Fact
          label="Fecha"
          value={
            dateLabel(
              current
                .event_date,
            )
          }
        />

        <Fact
          label="Horario"
          value={
            current.start_time
              ? `${
                  current
                    .start_time
                    .slice(
                      0,
                      5,
                    )
                }${
                  current.end_time
                    ? ` – ${
                        current
                          .end_time
                          .slice(
                            0,
                            5,
                          )
                      }`
                    : ""
                }`
              : "Por definir"
          }
        />

        <Fact
          label="Invitados"
          value={
            current.guest_count
              ? `${current.guest_count} personas`
              : "Por definir"
          }
        />

        <Fact
          label="Ubicación"
          value={
            current.venue_name
            ?? current.city
            ?? "Por definir"
          }
        />

        <Fact
          label="Presupuesto objetivo"
          value={
            current.target_budget
              ? money(
                  current
                    .target_budget,
                )
              : "Por definir"
          }
        />

        <Fact
          label="Calendar"
          value={
            current
              .google_calendar_event_id
              ? "Sincronizado"
              : "No sincronizado"
          }
        />
      </div>


      <nav
        className={
          styles.tabs
        }
      >
        {[
          [
            "summary",
            "Resumen",
          ],
          [
            "services",
            "Servicios",
          ],
          [
            "providers",
            "Proveedores",
          ],
          [
            "quote",
            "Presupuesto",
          ],
          [
            "coordination",
            "Coordinación",
          ],
          [
            "team",
            "Equipo",
          ],
          [
            "documents",
            "Documentos",
          ],
          [
            "finance",
            "Finanzas",
          ],
        ].map(
          (
            [
              key,
              label,
            ],
          ) => (
            <button
              className={
                tab === key
                  ? styles
                      .activeTab
                  : ""
              }
              key={
                key
              }
              onClick={
                () =>
                  setTab(
                    key,
                  )
              }
              type="button"
            >
              {label}
            </button>
          ),
        )}
      </nav>


      <div
        className={
          styles.body
        }
      >
        {tab
            === "summary"
            ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                }}
              >
                <EventExecutiveSummary
                  title={
                    current.title
                    ?? "Evento"
                  }
                  status={
                    current.status
                  }
                  eventDate={
                    current.event_date
                  }
                  eventEndDate={
                    current.event_end_date
                  }
                  guestCount={
                    current.guest_count
                  }
                  targetBudget={
                    current.target_budget
                  }
                  finalClientPrice={
                    current.final_client_price
                  }
                  finalProviderCost={
                    current.final_provider_cost
                  }
                  nextAction={
                    current.next_action
                  }
                  nextActionAt={
                    current.next_action_at
                  }
                  servicesCount={
                    requirements.length
                  }
                  assignmentsCount={
                    assignments.length
                  }
                  quotesCount={
                    quotes.length
                  }
                />

                <Card
                  eyebrow="SOLICITUD"
                  title="Necesidad del cliente"
                >
                  <p>
                    {
                      current.customer_request
                      ?? "Sin solicitud cargada."
                    }
                  </p>
                </Card>

                <Card
                  eyebrow="ACTIVIDAD"
                  title="Últimos movimientos"
                >
                  <EventActivityFeed />
                </Card>
              </div>
            )
            : null}

          {tab
          === "services"
          ? (
            <div
              style={{
                display:
                  "flex",

                flexDirection:
                  "column",

                gap:
                  16,
              }}
            >
              <EventReadinessBar
                eventId={
                  current.id
                }
              />

              <Card
                eyebrow="OPERACIÓN"
                title="Servicios del evento"
              >
                <EventServicesPanel
                  eventId={
                    current.id
                  }
                  requirements={
                    requirements as EventServiceRequirement[]
                  }
                  providers={
                    providers
                  }

                    providerServices={
                      providerServices
                    }

                    eventDate={
                      current.event_date
                    }

                    eventCity={
                      current.city
                    }

                    eventProvince={
                      current.province
                    }

                    guestCount={
                      current.guest_count
                    }
                  team={
                    team
                  }
                  categories={
                    categories
                  }
                />
              </Card>
            </div>
          )
          : null}


        {tab
            === "providers"
            ? (
              <Card
                eyebrow="RED OPERATIVA"
                title="Proveedores recomendados"
              >
                <EventProviderRecommendations
                  providers={
                    providers
                  }

                  providerServices={
                    providerServices
                  }

                  requirements={
                    requirements
                  }

                  city={
                    current.city
                  }

                  province={
                    current.province
                  }

                  guestCount={
                    current.guest_count
                  }
                />
              </Card>
            )
            : null}

          {tab
            === "quote"
            ? (
              <Card
                eyebrow="VENTA"
                title="Presupuesto del evento"
              >
                <EventQuotePreview
                  requirements={
                    requirements
                  }
                />
              </Card>
            )
            : null}

          {tab
            === "coordination"
            ? (
              <Card
                eyebrow="PRODUCCIÓN"
                title="Coordinación del evento"
              >
                <EventCoordinationTimeline
                  startTime={
                    current.start_time
                  }
                />
              </Card>
            )
            : null}

          {tab
            === "team"
            ? (
              <Card
                eyebrow="RESPONSABILIDADES"
                title="Equipo asignado"
              >
                <EventResponsiblesPanel
                  team={team}
                  assignments={assignments}
                />
              </Card>
            )
            : null}

          {tab
          === "documents"
          ? (
            <Card
              eyebrow="DOCUMENTOS"
              title="Expediente documental"
            >
              <div
                className={
                  styles.rows
                }
              >
                <div
                  className={
                    styles.row
                  }
                >
                  <div>
                    <strong>
                      Contrato del cliente
                    </strong>

                    <small>
                      Pendiente de generar o vincular
                    </small>
                  </div>
                </div>

                <div
                  className={
                    styles.row
                  }
                >
                  <div>
                    <strong>
                      Presupuesto PDF
                    </strong>

                    <small>
                      Se generará desde la versión aprobada
                    </small>
                  </div>
                </div>

                <div
                  className={
                    styles.row
                  }
                >
                  <div>
                    <strong>
                      Documentos de proveedores
                    </strong>

                    <small>
                      Contratos, presupuestos y comprobantes
                    </small>
                  </div>
                </div>

                <div
                  className={
                    styles.row
                  }
                >
                  <div>
                    <strong>
                      Google Drive
                    </strong>

                    <small>
                      {
                        current
                          .drive_folder_url
                        ?? "Carpeta todavía no vinculada"
                      }
                    </small>
                  </div>
                </div>
              </div>
            </Card>
          )
          : null}


          {tab
            === "finance"
            ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                }}
              >
                <EventFinanceSnapshot
                  eventId={
                    current.id
                  }
                />

                <Card
                  eyebrow="CONTROL FINANCIERO"
                  title="Estado de la operación"
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(180px, 1fr))",
                      gap: 12,
                    }}
                  >
                    <div>
                      <small>
                        COBROS
                      </small>

                      <strong
                        style={{
                          display: "block",
                          marginTop: 6,
                        }}
                      >
                        Seguimiento activo
                      </strong>
                    </div>

                    <div>
                      <small>
                        PROVEEDORES
                      </small>

                      <strong
                        style={{
                          display: "block",
                          marginTop: 6,
                        }}
                      >
                        Pagos controlados
                      </strong>
                    </div>

                    <div>
                      <small>
                        COMISIONES
                      </small>

                      <strong
                        style={{
                          display: "block",
                          marginTop: 6,
                        }}
                      >
                        {money(
                          totalCommission,
                        )}
                      </strong>
                    </div>
                  </div>
                </Card>
              </div>
            )
            : null}
      </div>
    </section>
  );
}


function Fact({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      className={
        styles.fact
      }
    >
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>
    </div>
  );
}


function Card({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <article
      className={
        styles.card
      }
    >
      <header>
        <span>
          {eyebrow}
        </span>

        <h2>
          {title}
        </h2>
      </header>

      {children}
    </article>
  );
}


function MiniMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>
    </div>
  );
}


function FinanceMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <article
      className={
        styles.financeMetric
      }
    >
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>
    </article>
  );
}


function Empty({
  text,
}: {
  text: string;
}) {
  return (
    <div
      className={
        styles.empty
      }
    >
      {text}
    </div>
  );
}
