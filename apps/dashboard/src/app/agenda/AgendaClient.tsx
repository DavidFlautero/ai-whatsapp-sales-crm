"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import styles
  from "./agenda.module.css";


const apiUrl = (
  process.env
    .NEXT_PUBLIC_API_URL
  || "/api"
).replace(/\/+$/, "");


type CrmEvent = {
  id: string;
  title: string;
  event_type?: string | null;
  status?: string | null;

  event_date?:
    | string
    | null;

  start_time?:
    | string
    | null;

  end_time?:
    | string
    | null;

  venue_name?:
    | string
    | null;

  venue_address?:
    | string
    | null;

  city?:
    | string
    | null;

  google_calendar_event_id?:
    | string
    | null;

  google_calendar_html_link?:
    | string
    | null;

  google_calendar_sync_status?:
    | string
    | null;

  google_calendar_synced_at?:
    | string
    | null;
};


type GoogleEvent = {
  id?: string;
  summary?: string;
  htmlLink?: string;

  location?:
    | string
    | null;

  start?: {
    date?: string;
    dateTime?: string;
  };

  end?: {
    date?: string;
    dateTime?: string;
  };

  extendedProperties?: {
    private?: {
      crm_event_id?: string;
    };
  };
};


async function request<T>(
  path: string,
  init:
    RequestInit = {},
): Promise<T> {
  const response =
    await fetch(
      `${apiUrl}${path}`,
      {
        ...init,

        credentials:
          "include",

        cache:
          "no-store",

        headers: {
          "Content-Type":
            "application/json",

          ...init.headers,
        },
      },
    );

  const body =
    await response
      .json()
      .catch(
        () => ({}),
      );

  if (!response.ok) {
    throw new Error(
      body?.message
      || body?.error
      || `HTTP ${response.status}`,
    );
  }

  return body as T;
}


function extractEvents(
  body: unknown,
): CrmEvent[] {
  if (Array.isArray(body)) {
    return body as CrmEvent[];
  }

  if (
    body
    && typeof body ===
      "object"
  ) {
    const candidate =
      body as {
        data?: unknown;
        events?: unknown;
      };

    if (
      Array.isArray(
        candidate.events,
      )
    ) {
      return candidate
        .events as CrmEvent[];
    }

    if (
      Array.isArray(
        candidate.data,
      )
    ) {
      return candidate
        .data as CrmEvent[];
    }
  }

  return [];
}


function shortDate(
  value?:
    | string
    | null,
) {
  if (!value) {
    return "Fecha pendiente";
  }

  const date =
    new Date(
      `${value}T12:00:00`,
    );

  return new Intl.DateTimeFormat(
    "es-ES",
    {
      weekday: "short",
      day: "2-digit",
      month: "short",
    },
  ).format(date);
}


function googleDate(
  event: GoogleEvent,
) {
  const value =
    event.start?.dateTime
    || event.start?.date;

  if (!value) {
    return "Sin fecha";
  }

  const parsed =
    new Date(value);

  if (
    Number.isNaN(
      parsed.getTime(),
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "es-ES",
    {
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour:
        event.start?.dateTime
          ? "2-digit"
          : undefined,
      minute:
        event.start?.dateTime
          ? "2-digit"
          : undefined,
    },
  ).format(parsed);
}


export default function AgendaClient() {
  const [
    events,
    setEvents,
  ] =
    useState<CrmEvent[]>([]);

  const [
    googleEvents,
    setGoogleEvents,
  ] =
    useState<GoogleEvent[]>([]);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    busy,
    setBusy,
  ] =
    useState<string | null>(
      null,
    );

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    googleError,
    setGoogleError,
  ] =
    useState("");


  const load =
    useCallback(
      async () => {
        setLoading(true);
        setError("");
        setGoogleError("");

        try {
          const crmBody =
            await request<unknown>(
              "/crm/events",
            );

          setEvents(
            extractEvents(
              crmBody,
            ),
          );
        } catch (
          nextError: unknown
        ) {
          setError(
            nextError
              instanceof Error
              ? nextError.message
              : "No fue posible cargar los eventos.",
          );
        }

        try {
          const google =
            await request<{
              ok: boolean;
              events:
                GoogleEvent[];
            }>(
              "/admin/google-calendar/events",
            );

          setGoogleEvents(
            google.events ?? [],
          );
        } catch {
          setGoogleEvents([]);
          setGoogleError(
            "Google Calendar todavía no está conectado.",
          );
        }

        setLoading(false);
      },
      [],
    );


  useEffect(
    () => {
      void load();
    },
    [load],
  );


  const upcoming =
    useMemo(
      () =>
        [...events]
          .filter(
            (event) =>
              Boolean(
                event.event_date,
              ),
          )
          .sort(
            (a, b) =>
              String(
                a.event_date,
              ).localeCompare(
                String(
                  b.event_date,
                ),
              ),
          ),
      [events],
    );


  async function sync(
    event: CrmEvent,
  ) {
    setBusy(
      event.id,
    );

    setError("");

    try {
      await request(
        `/admin/google-calendar/events/${event.id}/sync`,
        {
          method:
            "POST",

          body:
            JSON.stringify({}),
        },
      );

      await load();
    } catch (
      nextError: unknown
    ) {
      setError(
        nextError
          instanceof Error
          ? nextError.message
          : "No fue posible sincronizar el evento.",
      );
    } finally {
      setBusy(null);
    }
  }


  return (
    <div
      className={
        styles.page
      }
    >
      <section
        className={
          styles.hero
        }
      >
        <div>
          <span>
            OPERACIÓN · AGENDA
          </span>

          <h1>
            Agenda de eventos
          </h1>

          <p>
            Fechas del CRM y Google Calendar en un mismo centro de coordinación.
          </p>
        </div>

        <div
          className={
            styles.heroMetrics
          }
        >
          <article>
            <strong>
              {
                upcoming.length
              }
            </strong>

            <span>
              eventos CRM
            </span>
          </article>

          <article>
            <strong>
              {
                googleEvents.length
              }
            </strong>

            <span>
              en Google
            </span>
          </article>
        </div>
      </section>


      {error ? (
        <div
          className={
            styles.error
          }
        >
          {error}
        </div>
      ) : null}


      <section
        className={
          styles.columns
        }
      >
        <div
          className={
            styles.panel
          }
        >
          <header>
            <div>
              <span>
                CRM
              </span>

              <h2>
                Próximos eventos
              </h2>
            </div>

            <strong>
              {
                upcoming.length
              }
            </strong>
          </header>


          {loading ? (
            <div
              className={
                styles.empty
              }
            >
              Cargando agenda…
            </div>
          ) : upcoming.length ? (
            <div
              className={
                styles.list
              }
            >
              {upcoming.map(
                (event) => {
                  const synced =
                    event
                      .google_calendar_sync_status
                    === "synced";

                  return (
                    <article
                      className={
                        styles.eventCard
                      }
                      key={
                        event.id
                      }
                    >
                      <div
                        className={
                          styles.dateBox
                        }
                      >
                        {
                          shortDate(
                            event
                              .event_date,
                          )
                        }
                      </div>

                      <div
                        className={
                          styles.eventInfo
                        }
                      >
                        <div
                          className={
                            styles.eventTop
                          }
                        >
                          <div>
                            <h3>
                              {
                                event.title
                              }
                            </h3>

                            <p>
                              {
                                event.venue_name
                                || event.city
                                || "Ubicación pendiente"
                              }

                              {event.start_time
                                ? ` · ${event.start_time.slice(0, 5)}`
                                : ""}
                            </p>
                          </div>

                          <span
                            className={
                              synced
                                ? styles.synced
                                : styles.pending
                            }
                          >
                            {synced
                              ? "Sincronizado"
                              : "Pendiente"}
                          </span>
                        </div>


                        <div
                          className={
                            styles.actions
                          }
                        >
                          <button
                            type="button"
                            onClick={() =>
                              void sync(
                                event,
                              )
                            }
                            disabled={
                              busy ===
                              event.id
                            }
                          >
                            {busy ===
                            event.id
                              ? "Sincronizando…"
                              : synced
                                ? "Actualizar Google"
                                : "Sincronizar → Google"}
                          </button>

                          {event
                            .google_calendar_html_link ? (
                            <a
                              href={
                                event
                                  .google_calendar_html_link
                              }
                              target="_blank"
                              rel="noreferrer"
                            >
                              Abrir en Calendar ↗
                            </a>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  );
                },
              )}
            </div>
          ) : (
            <div
              className={
                styles.empty
              }
            >
              Todavía no hay eventos con fecha asignada.
            </div>
          )}
        </div>


        <div
          className={
            styles.panel
          }
        >
          <header>
            <div>
              <span>
                GOOGLE CALENDAR
              </span>

              <h2>
                Calendario conectado
              </h2>
            </div>

            <strong>
              {
                googleEvents.length
              }
            </strong>
          </header>


          {googleError ? (
            <div
              className={
                styles.calendarEmpty
              }
            >
              <strong>
                Calendar no conectado
              </strong>

              <p>
                Configuralo desde Robot e integraciones.
              </p>

              <a
                href="/integrations"
              >
                Ir a integraciones →
              </a>
            </div>
          ) : googleEvents.length ? (
            <div
              className={
                styles.googleList
              }
            >
              {googleEvents
                .slice(
                  0,
                  12,
                )
                .map(
                  (
                    event,
                    index,
                  ) => (
                    <article
                      key={
                        event.id
                        ?? index
                      }
                    >
                      <span
                        className={
                          styles.googleDot
                        }
                      />

                      <div>
                        <strong>
                          {
                            event.summary
                            || "Evento"
                          }
                        </strong>

                        <small>
                          {
                            googleDate(
                              event,
                            )
                          }
                        </small>

                        {event.location ? (
                          <small>
                            {
                              event.location
                            }
                          </small>
                        ) : null}
                      </div>

                      {event.htmlLink ? (
                        <a
                          href={
                            event.htmlLink
                          }
                          target="_blank"
                          rel="noreferrer"
                        >
                          ↗
                        </a>
                      ) : null}
                    </article>
                  ),
                )}
            </div>
          ) : (
            <div
              className={
                styles.empty
              }
            >
              No hay eventos próximos en Google Calendar.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
