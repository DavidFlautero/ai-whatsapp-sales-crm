"use client";

import {
  useRouter,
  useSearchParams,
} from "next/navigation";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import styles from "./event-crm.module.css";

import {
  TeamAccessManager,
} from "./TeamAccessManager";

import {
  EventWorkspace,
} from "./EventWorkspace";

import {
  CustomersManager,
} from "./CustomersManager";

import {
  OperationsAdminPanel,
} from "./OperationsAdminPanel";


type DbId = string;

type CRMMe = {
  admin: boolean;
  role: string;
  crmRole: string;
  views?: string[];
  actions?: string[];
  member: {
    id: string;
    name: string;
    email?: string | null;
    access_role: "admin" | "seller";
  };
  settings: {
    currency?: string;
    commission_pool_limit_percent?: number | string;
  };
};

type Customer = {
  id: DbId;
  name: string;
  whatsapp?: string | null;
  email?: string | null;
  city?: string | null;
  province?: string | null;
  notes?: string | null;
  created_at?: string;
};

type CRMEvent = {
  id: DbId;
  customer_id: DbId;
  title: string;
  event_type: string;
  status: string;
  event_date?: string | null;
  event_end_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  venue_name?: string | null;
  venue_address?: string | null;
  guest_count?: number | null;
  city?: string | null;
  province?: string | null;

  target_budget?: number | string | null;
  final_client_price?: number | string;
  gross_margin?: number | string;
  next_action?: string | null;
  next_action_at?: string | null;
  customer_request?: string | null;
  created_at?: string;
};

type Category = {
  id: DbId;
  code: string;
  name: string;
  icon?: string | null;
};

type Provider = {
  id: DbId;
  name: string;
  contact_name?: string | null;
  whatsapp?: string | null;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  province?: string | null;
  service_area?: string | null;
  internal_rating?: number | string | null;
  times_used?: number;
  incident_count?: number;
};

type ProviderService = {
  id: DbId;
  provider_id: DbId;
  category_id: DbId;
  name: string;
  description?: string | null;
  pricing_model?: string | null;
  currency?: string | null;
  cost_from?: number | string | null;
  cost_to?: number | string | null;
  suggested_client_price?: number | string | null;
  capacity_min?: number | null;
  capacity_max?: number | null;
  lead_time_days?: number | null;
  active?: boolean;
};


type Quote = {
  id: DbId;
  event_id: DbId;
  version: number;
  status: string;
  final_price?: number | string;
  subtotal_price?: number | string;
  commissionable_margin?: number | string;
  valid_until?: string | null;
  created_at?: string;
};

type TeamMember = {
  id: DbId;
  name: string;
  email?: string | null;
  phone?: string | null;
  access_role: "admin" | "seller";
};

type CommissionRule = {
  id: DbId;
  name: string;
  participation_type: string;
  calculation_type: string;
  percent_value?: number | string | null;
  fixed_amount?: number | string | null;
};

type Commission = {
  id: DbId;
  event_id: DbId;
  participation_type: string;
  commission_amount: number | string;
  status: string;
  team_member_id?: DbId;
};

type ApiErrorBody = {
  error?: string;
};

const API = "/api";


function eventDurationDays(
  start?: string | null,
  end?: string | null,
) {
  if (!start) {
    return null;
  }

  const startDate =
    new Date(`${start}T12:00:00`);

  const endDate =
    new Date(
      `${end || start}T12:00:00`,
    );

  if (
    Number.isNaN(startDate.getTime())
    || Number.isNaN(endDate.getTime())
  ) {
    return null;
  }

  const difference =
    endDate.getTime()
    - startDate.getTime();

  return Math.max(
    1,
    Math.round(
      difference
      / 86_400_000,
    ) + 1,
  );
}


const eventTypes = [
  "Boda",
  "Cumpleaños",
  "Comunión",
  "Evento de empresa",
  "Ayuntamiento",
  "Fiesta privada",
  "Otro",
];

const participationLabels:
  Record<string, string> = {
    capture: "Captación",
    closing: "Cierre",
    coordination: "Coordinación",
    onsite: "Responsable presencial",
    administration: "Administración",
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
    paid: "Pagada",
  };

function hasView(
  me: CRMMe | null,
  view: string,
): boolean {
  if (!me) {
    return false;
  }

  if (
    !me.views
    || me.views.length === 0
  ) {
    if (me.admin) {
      return true;
    }

    return [
      "dashboard",
      "customers",
      "events",
      "quotes",
      "commissions",
    ].includes(
      view,
    );
  }

  return me.views.includes(
    view,
  );
}


function hasAction(
  me: CRMMe | null,
  action: string,
): boolean {
  if (!me) {
    return false;
  }

  if (
    !me.actions
    || me.actions.length === 0
  ) {
    if (me.admin) {
      return true;
    }

    return [
      "customers.create",
      "customers.edit",
      "events.create",
      "events.edit",
      "quotes.create",
    ].includes(
      action,
    );
  }

  return me.actions.includes(
    action,
  );
}


function money(
  value: number | string | null | undefined,
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
    return "Sin fecha";
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
          "Content-Type":
            "application/json",
          Accept:
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
      (body as ApiErrorBody)
        .error
      ?? `HTTP_${response.status}`,
    );
  }

  return body as T;
}


export function EventCRMClient() {
  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    saving,
    setSaving,
  ] =
    useState(false);

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
    categories,
    setCategories,
  ] =
    useState<Category[]>([]);

  const [
    providers,
    setProviders,
  ] =
    useState<Provider[]>([]);

  const [
    providerServices,
    setProviderServices,
  ] =
    useState<ProviderService[]>(
      [],
    );


  const [
    providerCategory,
    setProviderCategory,
  ] =
    useState<string>(
      "all",
    );


  const [
    providerSearch,
    setProviderSearch,
  ] =
    useState("");


  const [
    quotes,
    setQuotes,
  ] =
    useState<Quote[]>([]);

  const [
    team,
    setTeam,
  ] =
    useState<TeamMember[]>([]);

  const [
    rules,
    setRules,
  ] =
    useState<CommissionRule[]>([]);

  const [
    commissions,
    setCommissions,
  ] =
    useState<Commission[]>([]);

  const router =
    useRouter();

  const searchParams =
    useSearchParams();

  const deepLinkedEventId =
    searchParams.get(
      "event",
    );


  const [
    activeTab,
    setActiveTab,
  ] =
    useState("overview");


  useEffect(
    () => {
      const requestedView =
        searchParams.get(
          "view",
        );

      if (!requestedView) {
        return;
      }

      const allowedViews =
        new Set([
          "overview",
          "customers",
          "events",
          "providers",
          "quotes",
          "commissions",
          "team",
          "administration",
        ]);

      if (
        allowedViews.has(
          requestedView,
        )
      ) {
        setActiveTab(
          requestedView,
        );
      }
    },
    [
      searchParams,
    ],
  );


  const [
    selectedEventId,
    setSelectedEventId,
  ] =
    useState<string | null>(
      null,
    );


  function navigateToView(
    view: string,
  ) {
    setActiveTab(
      view,
    );

    router.push(
      `/crm?view=${encodeURIComponent(
        view,
      )}`,
      {
        scroll: false,
      },
    );
  }


  function openEvent(
    eventId: string,
  ) {
    setSelectedEventId(
      eventId,
    );

    navigateToView(
      "events",
    );

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }


  const selectedEvent =
    useMemo(
      () =>
        events.find(
          (item) =>
            item.id
            === selectedEventId,
        )
        ?? null,
      [
        events,
        selectedEventId,
      ],
    );


  const [
    wizardOpen,
    setWizardOpen,
  ] =
    useState(false);

  const [
    wizardStep,
    setWizardStep,
  ] =
    useState(1);

  const [
    customerMode,
    setCustomerMode,
  ] =
    useState<
      "existing" | "new"
    >("existing");

  const [
    eventForm,
    setEventForm,
  ] =
    useState({
      customerId: "",
      customerName: "",
      customerWhatsapp: "",
      customerEmail: "",
      title: "",
      eventType: "Boda",
      eventDate: "",
      eventEndDate: "",
      startTime: "",
      endTime: "",
      guestCount: "",
      city: "Valencia",
      province: "Valencia",
      venueName: "",
      venueAddress: "",
      targetBudget: "",
      customerRequest: "",
      sourceChannel: "whatsapp",
      selectedCategories:
        [] as string[],
    });

  const [
    providerOpen,
    setProviderOpen,
  ] =
    useState(false);

  const [
    providerForm,
    setProviderForm,
  ] =
    useState({
      name: "",
      contactName: "",
      whatsapp: "",
      email: "",
      city: "Valencia",
      province: "Valencia",
      serviceArea: "",
      selectedCategories:
        [] as string[],
    });

  const [
    ruleOpen,
    setRuleOpen,
  ] =
    useState(false);

  const [
    ruleForm,
    setRuleForm,
  ] =
    useState({
      name:
        "Comisión de cierre",
      participationType:
        "closing",
      calculationType:
        "percent_margin",
      value: "15",
    });


  const loadAll =
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
            customersBody,
            eventsBody,
            categoriesBody,
            providersBody,
          ] =
            await Promise.all([
              api<{
                ok: boolean;
                admin: boolean;
                role: string;
                crmRole: string;
                member:
                  CRMMe["member"];
                settings:
                  CRMMe["settings"];
              }>(
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
                categories:
                  Category[];
              }>(
                "/crm/service-categories",
              ),

              api<{
                providers:
                  Provider[];
              }>(
                "/crm/providers",
              ),
            ]);

          const currentMe:
            CRMMe = {
              admin:
                meBody.admin,
              role:
                meBody.role,
              crmRole:
                meBody.crmRole,
              member:
                meBody.member,
              settings:
                meBody.settings,
            };

          setMe(
            currentMe,
          );

          setCustomers(
            customersBody.customers
            ?? [],
          );

          setEvents(
            eventsBody.events
            ?? [],
          );

          setCategories(
            categoriesBody.categories
            ?? [],
          );

          const loadedProviders =
            providersBody.providers
            ?? [];

          setProviders(
            loadedProviders,
          );


          const providerServiceResponses =
            await Promise.all(
              loadedProviders.map(
                async (
                  provider,
                ) => {
                  try {
                    const result =
                      await api<{
                        services:
                          ProviderService[];
                      }>(
                        `/crm/providers/${provider.id}/services`,
                      );

                    return (
                      result.services
                      ?? []
                    );
                  } catch {
                    return [];
                  }
                },
              ),
            );

          setProviderServices(
            providerServiceResponses
              .flat(),
          );

          const quoteResponses =
            await Promise.all(
              (
                eventsBody.events
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
            quoteResponses.flat(),
          );

          const commissionResponses =
            await Promise.all(
              (
                eventsBody.events
                ?? []
              ).map(
                async (event) => {
                  try {
                    const result =
                      await api<{
                        commissions:
                          Commission[];
                      }>(
                        `/crm/events/${event.id}/commissions`,
                      );

                    return (
                      result.commissions
                      ?? []
                    );
                  } catch {
                    return [];
                  }
                },
              ),
            );

          setCommissions(
            commissionResponses
              .flat(),
          );

          if (
            currentMe.admin
          ) {
            const [
              teamBody,
              rulesBody,
            ] =
              await Promise.all([
                api<{
                  members:
                    TeamMember[];
                }>(
                  "/crm/team",
                ),

                api<{
                  rules:
                    CommissionRule[];
                }>(
                  "/crm/commission-rules",
                ),
              ]);

            setTeam(
              teamBody.members
              ?? [],
            );

            setRules(
              rulesBody.rules
              ?? [],
            );
          } else {
            setTeam([]);
            setRules([]);
          }
        } catch (
          loadError
        ) {
          setError(
            loadError
              instanceof Error
              ? loadError.message
              : "No se pudo cargar el CRM.",
          );
        } finally {
          setLoading(false);
        }
      },
      [],
    );


  useEffect(
    () => {
      void loadAll();
    },
    [loadAll],
  );


  const customersById =
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


  const eventsById =
    useMemo(
      () =>
        new Map(
          events.map(
            (event) => [
              event.id,
              event,
            ],
          ),
        ),
      [events],
    );


  const upcomingEvents =
    useMemo(
      () =>
        events
          .filter(
            (event) =>
              ![
                "completed",
                "lost",
                "cancelled",
              ].includes(
                event.status,
              ),
          )
          .sort(
            (a, b) => {
              const aTime =
                a.event_date
                  ? new Date(
                      a.event_date,
                    ).getTime()
                  : Number.MAX_SAFE_INTEGER;

              const bTime =
                b.event_date
                  ? new Date(
                      b.event_date,
                    ).getTime()
                  : Number.MAX_SAFE_INTEGER;

              return (
                aTime
                - bTime
              );
            },
          ),
      [events],
    );


  const pendingActions =
    useMemo(
      () =>
        events.filter(
          (event) =>
            Boolean(
              event.next_action,
            )
            && ![
              "completed",
              "cancelled",
              "lost",
            ].includes(
              event.status,
            ),
        ),
      [events],
    );


  const providerServicesByProvider =
    useMemo(
      () => {
        const map =
          new Map<
            string,
            ProviderService[]
          >();

        for (
          const service
          of providerServices
        ) {
          const current =
            map.get(
              service.provider_id,
            )
            ?? [];

          current.push(
            service,
          );

          map.set(
            service.provider_id,
            current,
          );
        }

        return map;
      },
      [
        providerServices,
      ],
    );


  const providerCategoryCounts =
    useMemo(
      () => {
        const counts =
          new Map<
            string,
            Set<string>
          >();

        for (
          const service
          of providerServices
        ) {
          const providersForCategory =
            counts.get(
              service.category_id,
            )
            ?? new Set<string>();

          providersForCategory.add(
            service.provider_id,
          );

          counts.set(
            service.category_id,
            providersForCategory,
          );
        }

        return counts;
      },
      [
        providerServices,
      ],
    );


  const visibleProviders =
    useMemo(
      () => {
        const search =
          providerSearch
            .trim()
            .toLowerCase();

        return providers.filter(
          provider => {
            const services =
              providerServicesByProvider
                .get(
                  provider.id,
                )
              ?? [];

            const categoryMatches =
              providerCategory
              === "all"
              || services.some(
                service =>
                  service.category_id
                  === providerCategory,
              );

            if (
              !categoryMatches
            ) {
              return false;
            }

            if (!search) {
              return true;
            }

            const serviceNames =
              services
                .map(
                  service =>
                    service.name,
                )
                .join(" ");

            const haystack =
              [
                provider.name,
                provider.contact_name,
                provider.city,
                provider.province,
                provider.service_area,
                serviceNames,
              ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            return haystack.includes(
              search,
            );
          },
        );
      },
      [
        providers,
        providerServicesByProvider,
        providerCategory,
        providerSearch,
      ],
    );


  const openQuotes =
    useMemo(
      () =>
        quotes.filter(
          (quote) =>
            ![
              "accepted",
              "rejected",
              "expired",
              "cancelled",
            ].includes(
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


  const myCommission =
    useMemo(
      () =>
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
        ),
      [commissions],
    );





  /*
   * EVENT_DIRECT_DEEPLINK_V10
   *
   * /crm/eventos/<ID>?view=events&event=<ID>
   * abre directamente EventWorkspace.
   */
  useEffect(
    () => {

      if (
        !deepLinkedEventId
        ||
        events.length === 0
      ) {
        return;
      }


      const eventExists =
        events.some(
          event =>
            String(
              event.id,
            )
            ===
            String(
              deepLinkedEventId,
            ),
        );


      if (
        !eventExists
      ) {
        return;
      }


      openEvent(
        deepLinkedEventId,
      );

    },
    [
      deepLinkedEventId,
      events,
    ],
  );



  function resetWizard() {
    setWizardStep(1);
    setCustomerMode(
      customers.length
        ? "existing"
        : "new",
    );

    setEventForm({
      customerId: "",
      customerName: "",
      customerWhatsapp: "",
      customerEmail: "",
      title: "",
      eventType: "Boda",
      eventDate: "",
      eventEndDate: "",
      startTime: "",
      endTime: "",
      guestCount: "",
      city: "Valencia",
      province: "Valencia",
      venueName: "",
      venueAddress: "",
      targetBudget: "",
      customerRequest: "",
      sourceChannel:
        "whatsapp",
      selectedCategories: [],
    });
  }


  function toggleCategory(
    categoryId: string,
  ) {
    setEventForm(
      (current) => ({
        ...current,

        selectedCategories:
          current
            .selectedCategories
            .includes(
              categoryId,
            )
            ? current
                .selectedCategories
                .filter(
                  (id) =>
                    id
                    !== categoryId,
                )
            : [
                ...current
                  .selectedCategories,
                categoryId,
              ],
      }),
    );
  }


  async function createEvent() {
    setSaving(true);
    setError(null);

    try {
      let customerId =
        eventForm.customerId;

      if (
        customerMode
        === "new"
      ) {
        const customerResult =
          await api<{
            customer:
              Customer;
          }>(
            "/crm/customers",
            {
              method: "POST",
              body:
                JSON.stringify({
                  name:
                    eventForm
                      .customerName,

                  whatsapp:
                    eventForm
                      .customerWhatsapp
                    || null,

                  email:
                    eventForm
                      .customerEmail
                    || null,

                  city:
                    eventForm.city
                    || null,

                  province:
                    eventForm
                      .province
                    || null,
                }),
            },
          );

        customerId =
          customerResult
            .customer.id;
      }

      if (!customerId) {
        throw new Error(
          "Seleccioná o creá un cliente.",
        );
      }

      const eventResult =
        await api<{
          event:
            CRMEvent;
        }>(
          "/crm/events",
          {
            method: "POST",

            body:
              JSON.stringify({
                customerId,

                title:
                  eventForm.title
                  || `${eventForm.eventType} - ${
                    customersById
                      .get(
                        customerId,
                      )
                      ?.name
                    ?? eventForm.customerName
                    ?? "Cliente"
                  }`,

                eventType:
                  eventForm.eventType,

                eventDate:
                  eventForm.eventDate
                  || null,

                eventEndDate:
                  eventForm.eventEndDate
                  || eventForm.eventDate
                  || null,

                startTime:
                  eventForm.startTime
                  || null,

                endTime:
                  eventForm.endTime
                  || null,

                venueName:
                  eventForm.venueName
                  || null,

                venueAddress:
                  eventForm.venueAddress
                  || null,

                guestCount:
                  eventForm.guestCount
                    ? Number(
                        eventForm
                          .guestCount,
                      )
                    : null,

                city:
                  eventForm.city
                  || null,

                province:
                  eventForm.province
                  || null,

                targetBudget:
                  eventForm
                    .targetBudget
                    ? Number(
                        eventForm
                          .targetBudget,
                      )
                    : null,

                customerRequest:
                  eventForm
                    .customerRequest
                  || null,

                sourceChannel:
                  eventForm
                    .sourceChannel
                  || null,

                nextAction:
                  eventForm
                    .selectedCategories
                    .length
                    ? "Buscar y seleccionar proveedores"
                    : "Completar necesidades del evento",
              }),
          },
        );

      await Promise.all(
        eventForm
          .selectedCategories
          .map(
            (categoryId) =>
              api(
                `/crm/events/${eventResult.event.id}/requirements`,
                {
                  method: "POST",
                  body:
                    JSON.stringify({
                      categoryId,
                      priority: 50,
                    }),
                },
              ),
          ),
      );

      setWizardOpen(false);
      resetWizard();
      await loadAll();

      window.location.assign(
        `/crm/eventos/${eventResult.event.id}`,
      );
    } catch (
      createError
    ) {
      setError(
        createError
          instanceof Error
          ? createError.message
          : "No se pudo crear el evento.",
      );
    } finally {
      setSaving(false);
    }
  }


  async function createProvider() {
    const name =
      providerForm.name.trim();

    const whatsapp =
      providerForm.whatsapp.trim();

    const city =
      providerForm.city.trim();

    if (!name) {
      setError(
        "El nombre del proveedor es obligatorio.",
      );
      return;
    }

    if (!whatsapp) {
      setError(
        "El WhatsApp del proveedor es obligatorio.",
      );
      return;
    }

    if (!city) {
      setError(
        "La ciudad del proveedor es obligatoria.",
      );
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const created =
        await api<{
          provider: Provider;
        }>(
          "/crm/providers",
          {
            method: "POST",
            body:
              JSON.stringify({
                name,
                contactName:
                  providerForm
                    .contactName
                    .trim()
                  || null,
                whatsapp,
                email:
                  providerForm
                    .email
                    .trim()
                  || null,
                city,
                province:
                  providerForm
                    .province
                    .trim()
                  || null,
                serviceArea:
                  providerForm
                    .serviceArea
                    .trim()
                  || null,
              }),
          },
        );

      const provider =
        created.provider;

      for (
        const categoryId
        of providerForm
          .selectedCategories
      ) {
        const category =
          categories.find(
            (item) =>
              item.id
              === categoryId,
          );

        if (!category) {
          continue;
        }

        await api(
          `/crm/providers/${
            provider.id
          }/services`,
          {
            method: "POST",
            body:
              JSON.stringify({
                categoryId:
                  category.id,
                name:
                  category.name,
              }),
          },
        );
      }

      setProviderOpen(
        false,
      );

      setProviderForm({
        name: "",
        contactName: "",
        whatsapp: "",
        email: "",
        city: "Valencia",
        province: "Valencia",
        serviceArea: "",
        selectedCategories: [],
      });

      await loadAll();
    } catch (
      createError
    ) {
      setError(
        createError
          instanceof Error
          ? createError.message
          : "No se pudo crear el proveedor.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function createRule() {
    setSaving(true);
    setError(null);

    try {
      const isPercent =
        ruleForm
          .calculationType
        === "percent_margin";

      await api(
        "/crm/commission-rules",
        {
          method: "POST",

          body:
            JSON.stringify({
              name:
                ruleForm.name,

              participationType:
                ruleForm
                  .participationType,

              calculationType:
                ruleForm
                  .calculationType,

              percentValue:
                isPercent
                  ? Number(
                      ruleForm
                        .value,
                    )
                  : null,

              fixedAmount:
                !isPercent
                  ? Number(
                      ruleForm
                        .value,
                    )
                  : null,
            }),
        },
      );

      setRuleOpen(false);
      await loadAll();
    } catch (
      createError
    ) {
      setError(
        createError
          instanceof Error
          ? createError.message
          : "No se pudo crear la regla.",
      );
    } finally {
      setSaving(false);
    }
  }


  if (loading) {
    return (
      <div
        className={
          styles.loading
        }
      >
        Preparando Centro de Eventos…
      </div>
    );
  }


  return (
    <div
      className={
        styles.root
      }
    >
      {error ? (
        <div
          className={
            styles.error
          }
        >
          <strong>
            Atención:
          </strong>{" "}
          {error}
        </div>
      ) : null}


      <section
        className={
          styles.hero
        }
      >
        <div
          className={
            styles.heroCopy
          }
        >
          <div
            className={
              styles.heroTopline
            }
          >
            <span
              className={
                styles.heroLiveDot
              }
            />

            OPERACIÓN EN VIVO · EVENTOS MEDITERRÁNEO
          </div>

          <h2>
            {me?.admin
              ? "Toda la operación. Un solo lugar."
              : `Tu operación, ${me?.member.name ?? "vendedor"}.`}
          </h2>

          <p>
            Desde el primer mensaje del cliente hasta el cierre,
            la coordinación del evento y la liquidación de comisiones.
          </p>

          <div
            className={
              styles.heroActions
            }
          >
            {hasAction(
              me,
              "events.create",
            ) ? (
              <button
                className={
                  styles.primaryButton
                }
                onClick={() => {
                  resetWizard();

                  setWizardOpen(
                    true,
                  );
                }}
              >
                <span>＋</span>
                Nuevo evento
              </button>
            ) : null}

            <button
              className={
                styles.heroSecondaryButton
              }
              onClick={() =>
                navigateToView("events")
              }
            >
              Ver eventos
              <span>→</span>
            </button>

            <button
              className={
                styles.heroSecondaryButton
              }
              onClick={() =>
                router.push(
                  "/crm/espacios",
                )
              }
            >
              Gestionar espacios
              <span>→</span>
            </button>

            <button
              className={
                styles.heroSecondaryButton
              }
              onClick={() =>
                router.push(
                  "/crm/solicitudes",
                )
              }
            >
              Ver solicitudes
              <span>→</span>
            </button>
          </div>
        </div>


        <div
          className={
            styles.heroAside
          }
        >
          <div
            className={
              styles.heroAsideHeader
            }
          >
            <div>
              <span>
                ESTADO DE LA OPERACIÓN
              </span>

              <strong>
                Ahora
              </strong>
            </div>

            <span
              className={
                styles.heroStatusPill
              }
            >
              <i />
              En línea
            </span>
          </div>


          <div
            className={
              styles.heroMainStat
            }
          >
            <span>
              Eventos activos
            </span>

            <strong>
              {
                upcomingEvents.length
              }
            </strong>
          </div>


          <div
            className={
              styles.heroMiniGrid
            }
          >
            <div>
              <span>
                Acciones
              </span>

              <strong>
                {
                  pendingActions.length
                }
              </strong>

              <small>
                pendientes
              </small>
            </div>

            <div>
              <span>
                Presupuestos
              </span>

              <strong>
                {
                  openQuotes.length
                }
              </strong>

              <small>
                abiertos
              </small>
            </div>

            <div>
              <span>
                Ventas
              </span>

              <strong>
                {
                  money(
                    acceptedRevenue,
                  )
                }
              </strong>

              <small>
                confirmadas
              </small>
            </div>
          </div>


          <button
            type="button"
            className={
              styles.heroNext
            }
            disabled={
              !upcomingEvents[0]
            }
            onClick={() => {
              const event =
                upcomingEvents[0];

              if (event) {
                window.location.assign(
                                `/crm/eventos/${event.id}`,
                              );
              }
            }}
          >
            <div>
              <span>
                PRÓXIMO EVENTO
              </span>

              <strong>
                {
                  upcomingEvents[0]
                    ?.title
                  ?? "Sin eventos programados"
                }
              </strong>

              <small>
                {
                  upcomingEvents[0]
                    ? `${
                        dateLabel(
                          upcomingEvents[0]
                            .event_date,
                        )
                      } · ${
                        upcomingEvents[0]
                          .city
                        ?? "Ubicación pendiente"
                      }`
                    : "Creá un evento para comenzar la operación."
                }
              </small>
            </div>

            <span
              className={
                styles.heroNextArrow
              }
            >
              ↗
            </span>
          </button>
        </div>
      </section>


      <section
        className={styles.crmGlobalActions}
      >
        <div>
          <strong>
            Operación
          </strong>

          <span>
            Crear y gestionar sin salir del CRM
          </span>
        </div>

        <div
          className={styles.crmGlobalButtons}
        >

          {hasAction(
            me,
            "events.create",
          ) ? (
            <button
              type="button"
              className={
                styles.crmPrimaryAction
              }
              onClick={() => {
                resetWizard();
                setWizardOpen(true);
              }}
            >
              + Nuevo evento
            </button>
          ) : null}


          {hasAction(
            me,
            "customers.create",
          ) ? (
            <button
              type="button"
              onClick={() => {
                navigateToView("customers");
              }}
            >
              + Nuevo cliente
            </button>
          ) : null}


          {hasAction(
            me,
            "providers.edit",
          )
          && hasView(
            me,
            "administration",
          ) ? (
            <button
              type="button"
              onClick={() => {
                navigateToView("administration");
              }}
            >
              + Nuevo proveedor
            </button>
          ) : null}


          {hasAction(
            me,
            "team.manage",
          )
          && hasView(
            me,
            "team",
          ) ? (
            <button
              type="button"
              onClick={() => {
                navigateToView("team");
              }}
            >
              Equipo y accesos
            </button>
          ) : null}


          {hasView(
            me,
            "administration",
          ) ? (
            <button
              type="button"
              onClick={() => {
                navigateToView("administration");
              }}
            >
              Configuración
            </button>
          ) : null}

        </div>
      </section>
{activeTab
        === "overview"
        ? (
          <>
            <section
              className={
                styles.metrics
              }
            >
              <Metric
                label={
                  me?.admin
                    ? "Eventos activos"
                    : "Mis eventos activos"
                }
                value={
                  String(
                    upcomingEvents
                      .length,
                  )
                }
                caption="Operación abierta"
              />

              <Metric
                label="Siguientes acciones"
                value={
                  String(
                    pendingActions
                      .length,
                  )
                }
                caption="Requieren seguimiento"
              />

              <Metric
                label="Presupuestos abiertos"
                value={
                  String(
                    openQuotes
                      .length,
                  )
                }
                caption="Pendientes de cierre"
              />

              <Metric
                label={
                  me?.admin
                    ? "Ventas confirmadas"
                    : "Mi comisión"
                }
                value={
                  me?.admin
                    ? money(
                        acceptedRevenue,
                      )
                    : money(
                        myCommission,
                      )
                }
                caption={
                  me?.admin
                    ? "Presupuestos aceptados"
                    : "Generada hasta hoy"
                }
              />
            </section>


            <section
              className={
                styles.gridTwo
              }
            >
              <Panel
                title="Qué requiere atención"
                subtitle="El sistema te marca el siguiente paso."
              >
                {pendingActions
                  .length
                  ? pendingActions
                      .slice(
                        0,
                        6,
                      )
                      .map(
                        (event) => (
                          <div
                            key={
                              event.id
                            }
                            className={
                              styles.clickableOperationRow
                            }
                            role="button"
                            tabIndex={0}
                            onClick={() =>
                              window.location.assign(
                                `/crm/eventos/${event.id}`,
                              )
                            }
                            onKeyDown={
                              (keyboardEvent) => {
                                if (
                                  keyboardEvent.key
                                    === "Enter"
                                  || keyboardEvent.key
                                    === " "
                                ) {
                                  keyboardEvent
                                    .preventDefault();

                                  window.location.assign(
                                `/crm/eventos/${event.id}`,
                              );
                                }
                              }
                            }
                          >
                            <ActionRow
                              event={
                                event
                              }
                              customer={
                                customersById
                                  .get(
                                    event.customer_id,
                                  )
                              }
                            />
                          </div>
                        ),
                      )
                  : (
                    <Empty
                      text="No hay acciones pendientes."
                    />
                  )}
              </Panel>


              <Panel
                title="Próximos eventos"
                subtitle="Vista rápida de la operación."
              >
                {upcomingEvents
                  .length
                  ? upcomingEvents
                      .slice(
                        0,
                        6,
                      )
                      .map(
                        (event) => (
                          <div
                            key={
                              event.id
                            }
                            className={
                              styles.clickableOperationRow
                            }
                            role="button"
                            tabIndex={0}
                            onClick={() =>
                              window.location.assign(
                                `/crm/eventos/${event.id}`,
                              )
                            }
                            onKeyDown={
                              (keyboardEvent) => {
                                if (
                                  keyboardEvent.key
                                    === "Enter"
                                  || keyboardEvent.key
                                    === " "
                                ) {
                                  keyboardEvent
                                    .preventDefault();

                                  window.location.assign(
                                `/crm/eventos/${event.id}`,
                              );
                                }
                              }
                            }
                          >
                            <EventRow
                              event={
                                event
                              }
                              customer={
                                customersById
                                  .get(
                                    event.customer_id,
                                  )
                              }
                            />
                          </div>
                        ),
                      )
                  : (
                    <Empty
                      text="Todavía no hay eventos activos."
                    />
                  )}
              </Panel>
            </section>
          </>
        )
        : null}


      {activeTab
        === "customers"
        ? (
          me?.admin
            ? (
              <CustomersManager
                customers={customers}
                onReload={loadAll}
              />
            )
            : (
              <Panel
                title="Mis clientes"
                subtitle="Clientes vinculados a tus eventos."
              >
                <div
                  className={
                    styles.tableWrap
                  }
                >
                  <table
                    className={
                      styles.table
                    }
                  >
                    <thead>
                      <tr>
                        <th>
                          Cliente
                        </th>

                        <th>
                          WhatsApp
                        </th>

                        <th>
                          Ubicación
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {customers.map(
                        customer => (
                          <tr
                            key={
                              customer.id
                            }
                          >
                            <td>
                              {
                                customer.name
                              }
                            </td>

                            <td>
                              {
                                customer.whatsapp
                                ?? "—"
                              }
                            </td>

                            <td>
                              {
                                [
                                  customer.city,
                                  customer.province,
                                ]
                                  .filter(Boolean)
                                  .join(", ")
                                || "—"
                              }
                            </td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </div>
              </Panel>
            )
        )
        : null}


      {activeTab
          === "events"
          && selectedEvent
          ? (
            <EventWorkspace
              event={
                selectedEvent
              }
              customer={
                customersById.get(
                  selectedEvent
                    .customer_id,
                )
              }
              categories={
                categories
              }
              providers={
                providers
              }
              providerServices={
                providerServices
              }
              team={
                team
              }
              isAdmin={
                Boolean(
                  me?.admin,
                )
              }
              onClose={
                () =>
                  setSelectedEventId(
                    null,
                  )
              }
            />
          )
          : null}


{activeTab
          === "events"
          && !selectedEvent
          ? (
          <Panel
            title={
              me?.admin
                ? "Eventos y solicitudes"
                : "Mis eventos"
            }
            subtitle="La unidad central de la operación comercial."
          >
            <div
              className={
                styles.eventGrid
              }
            >
              {events.map(
                (event) => (
                  <article
                    key={
                      event.id
                    }
                    className={
                      styles.eventCard
                    }
                  >
                    <div
                      className={
                        styles.cardTop
                      }
                    >
                      <div>
                        <small>
                          {
                            event.event_type
                          }
                        </small>

                        <h3>
                          {
                            event.title
                          }
                        </h3>
                      </div>

                      <Status
                        status={
                          event.status
                        }
                      />
                    </div>

                    <div
                      className={
                        styles.eventFacts
                      }
                    >
                      <span>
                        {
                          dateLabel(
                            event
                              .event_date,
                          )
                        }
                      </span>

                      <span>
                        {
                          event.guest_count
                          ? `${event.guest_count} personas`
                          : "Invitados sin definir"
                        }
                      </span>

                      <span>
                        {
                          event.city
                          ?? "Ubicación pendiente"
                        }
                      </span>
                    </div>

                    <div
                      className={
                        styles.clientLine
                      }
                    >
                      Cliente:{" "}
                      <strong>
                        {
                          customersById
                            .get(
                              event.customer_id,
                            )
                            ?.name
                          ?? "—"
                        }
                      </strong>
                    </div>

                    {event.target_budget ? (
                      <div
                        className={
                          styles.budget
                        }
                      >
                        Presupuesto objetivo{" "}
                        <strong>
                          {
                            money(
                              event.target_budget,
                            )
                          }
                        </strong>
                      </div>
                    ) : null}

                    <div
                      className={
                        styles.nextAction
                      }
                    >
                      <span>
                        Siguiente acción
                      </span>

                      <strong>
                        {
                          event.next_action
                          ?? "Definir siguiente paso"
                        }
                      </strong>
                    </div>
                    <button
                      className={
                        styles.secondaryButton
                      }
                      onClick={
                        () =>
                          setSelectedEventId(
                            event.id,
                          )
                      }
                      type="button"
                    >
                      Abrir operación →
                    </button>

                  </article>
                ),
              )}

              {!events.length ? (
                <Empty
                  text="Todavía no hay eventos. Creá el primero."
                />
              ) : null}
            </div>
          </Panel>
        )
        : null}


      {activeTab
        === "providers"
        && me?.admin
        ? (
          <Panel
            title="Proveedores"
            subtitle="Red operativa de espacios, catering, sonido, vehículos y servicios."
            action={
              <button
                className={
                  styles.secondaryButton
                }
                onClick={() =>
                  setProviderOpen(
                    !providerOpen,
                  )
                }
              >
                + Nuevo proveedor
              </button>
            }
          >
            {providerOpen ? (
              <div
                className={
                  styles.providerCreateForm
                }
              >
                <div
                  className={
                    styles.providerCreateHeader
                  }
                >
                  <div>
                    <strong>
                      Nuevo proveedor
                    </strong>

                    <span>
                      Solo nombre, WhatsApp y ciudad son obligatorios.
                    </span>
                  </div>
                </div>

                <div
                  className={
                    styles.providerCreateGrid
                  }
                >
                  <Input
                    label="Nombre *"
                    value={
                      providerForm.name
                    }
                    onChange={
                      (value) =>
                        setProviderForm(
                          (
                            current,
                          ) => ({
                            ...current,
                            name:
                              value,
                          }),
                        )
                    }
                  />

                  <Input
                    label="WhatsApp *"
                    value={
                      providerForm
                        .whatsapp
                    }
                    onChange={
                      (value) =>
                        setProviderForm(
                          (
                            current,
                          ) => ({
                            ...current,
                            whatsapp:
                              value,
                          }),
                        )
                    }
                  />

                  <Input
                    label="Ciudad *"
                    value={
                      providerForm.city
                    }
                    onChange={
                      (value) =>
                        setProviderForm(
                          (
                            current,
                          ) => ({
                            ...current,
                            city:
                              value,
                          }),
                        )
                    }
                  />

                  <Input
                    label="Persona de contacto"
                    value={
                      providerForm
                        .contactName
                    }
                    onChange={
                      (value) =>
                        setProviderForm(
                          (
                            current,
                          ) => ({
                            ...current,
                            contactName:
                              value,
                          }),
                        )
                    }
                  />

                  <Input
                    label="Email"
                    value={
                      providerForm.email
                    }
                    onChange={
                      (value) =>
                        setProviderForm(
                          (
                            current,
                          ) => ({
                            ...current,
                            email:
                              value,
                          }),
                        )
                    }
                  />

                  <Input
                    label="Provincia"
                    value={
                      providerForm
                        .province
                    }
                    onChange={
                      (value) =>
                        setProviderForm(
                          (
                            current,
                          ) => ({
                            ...current,
                            province:
                              value,
                          }),
                        )
                    }
                  />

                  <Input
                    label="Zona de cobertura"
                    value={
                      providerForm
                        .serviceArea
                    }
                    onChange={
                      (value) =>
                        setProviderForm(
                          (
                            current,
                          ) => ({
                            ...current,
                            serviceArea:
                              value,
                          }),
                        )
                    }
                  />
                </div>

                <div
                  className={
                    styles.providerServiceSelector
                  }
                >
                  <div
                    className={
                      styles.providerServiceSelectorHeader
                    }
                  >
                    <strong>
                      ¿Qué servicios ofrece?
                    </strong>

                    <span>
                      Podés elegir varios.
                    </span>
                  </div>

                  <div
                    className={
                      styles.providerServiceOptions
                    }
                  >
                    {categories.map(
                      (
                        category,
                      ) => {
                        const selected =
                          providerForm
                            .selectedCategories
                            .includes(
                              category.id,
                            );

                        return (
                          <button
                            key={
                              category.id
                            }
                            type="button"
                            className={
                              selected
                                ? styles
                                    .providerServiceOptionActive
                                : styles
                                    .providerServiceOption
                            }
                            onClick={
                              () =>
                                setProviderForm(
                                  (
                                    current,
                                  ) => ({
                                    ...current,

                                    selectedCategories:
                                      current
                                        .selectedCategories
                                        .includes(
                                          category.id,
                                        )
                                        ? current
                                            .selectedCategories
                                            .filter(
                                              (
                                                id,
                                              ) =>
                                                id
                                                !== category.id,
                                            )
                                        : [
                                            ...current
                                              .selectedCategories,
                                            category.id,
                                          ],
                                  }),
                                )
                            }
                          >
                            {category.name}
                          </button>
                        );
                      },
                    )}
                  </div>
                </div>

                <div
                  className={
                    styles.providerCreateActions
                  }
                >
                  <button
                    type="button"
                    className={
                      styles.secondaryButton
                    }
                    onClick={
                      () =>
                        setProviderOpen(
                          false,
                        )
                    }
                  >
                    Cancelar
                  </button>

                  <button
                    type="button"
                    className={
                      styles.primaryButton
                    }
                    disabled={
                      saving
                      || !providerForm
                        .name
                        .trim()
                      || !providerForm
                        .whatsapp
                        .trim()
                      || !providerForm
                        .city
                        .trim()
                    }
                    onClick={
                      () =>
                        void createProvider()
                    }
                  >
                    {saving
                      ? "Guardando…"
                      : "Guardar proveedor"}
                  </button>
                </div>
              </div>
            ) : null}

              {rules.map(
                (rule) => (
                  <div
                    key={
                      rule.id
                    }
                    className={
                      styles.ruleRow
                    }
                  >
                    <div>
                      <strong>
                        {
                          rule.name
                        }
                      </strong>

                      <small>
                        {
                          participationLabels[
                            rule
                              .participation_type
                          ]
                          ?? rule
                            .participation_type
                        }
                      </small>
                    </div>

                    <strong>
                      {
                        rule
                          .calculation_type
                        === "percent_margin"
                          ? `${rule.percent_value ?? 0}%`
                          : money(
                              rule.fixed_amount,
                            )
                      }
                    </strong>
                  </div>
                ),
              )}

              {!rules.length ? (
                <Empty
                  text="Todavía no hay reglas de comisión."
                />
              ) : null}
            </Panel>
        )
        : null}


            {activeTab
        === "administration"
        && me?.admin
        ? (
          <OperationsAdminPanel
            categories={categories}
            providers={providers}
            team={team}
            onReload={loadAll}
          />
        )
        : null}


{activeTab
        === "commissions"
        && !me?.admin
        ? (
          <Panel
            title="Mi comisión"
            subtitle="Participaciones generadas por tus eventos."
          >
            <div
              className={
                styles.commissionHero
              }
            >
              <span>
                Total generado
              </span>

              <strong>
                {
                  money(
                    myCommission,
                  )
                }
              </strong>
            </div>

            {commissions.map(
              (
                commission,
              ) => (
                <div
                  className={
                    styles.commissionRow
                  }
                  key={
                    commission.id
                  }
                >
                  <div>
                    <strong>
                      {
                        participationLabels[
                          commission
                            .participation_type
                        ]
                        ?? commission
                          .participation_type
                      }
                    </strong>

                    <small>
                      {
                        eventsById
                          .get(
                            commission.event_id,
                          )
                          ?.title
                        ?? "Evento"
                      }
                    </small>
                  </div>

                  <div
                    className={
                      styles.commissionAmount
                    }
                  >
                    <strong>
                      {
                        money(
                          commission
                            .commission_amount,
                        )
                      }
                    </strong>

                    <small>
                      {
                        statusLabels[
                          commission
                            .status
                        ]
                        ?? commission
                          .status
                      }
                    </small>
                  </div>
                </div>
              ),
            )}

            {!commissions.length ? (
              <Empty
                text="Todavía no tenés comisiones generadas."
              />
            ) : null}
          </Panel>
        )
        : null}


      {wizardOpen ? (
        <div
          className={
            styles.modalBackdrop
          }
        >
          <div
            className={
              styles.modal
            }
          >
            <div
              className={
                styles.modalHeader
              }
            >
              <div>
                <small>
                  NUEVO EVENTO · PASO{" "}
                  {wizardStep} DE 4
                </small>

                <h2>
                  {
                    [
                      "",
                      "¿Quién es el cliente?",
                      "Datos del evento",
                      "¿Qué necesita?",
                      "Revisar y crear",
                    ][
                      wizardStep
                    ]
                  }
                </h2>
              </div>

              <button
                className={
                  styles.closeButton
                }
                onClick={() =>
                  setWizardOpen(
                    false,
                  )
                }
              >
                ×
              </button>
            </div>


            <div
              className={
                styles.progress
              }
            >
              <span
                style={{
                  width:
                    `${
                      wizardStep
                      * 25
                    }%`,
                }}
              />
            </div>


            {wizardStep
              === 1
              ? (
                <div
                  className={
                    styles.wizardBody
                  }
                >
                  <div
                    className={
                      styles.segmented
                    }
                  >
                    <button
                      className={
                        customerMode
                        === "existing"
                          ? styles.segmentedActive
                          : ""
                      }
                      onClick={() =>
                        setCustomerMode(
                          "existing",
                        )
                      }
                    >
                      Cliente existente
                    </button>

                    <button
                      className={
                        customerMode
                        === "new"
                          ? styles.segmentedActive
                          : ""
                      }
                      onClick={() =>
                        setCustomerMode(
                          "new",
                        )
                      }
                    >
                      Nuevo cliente
                    </button>
                  </div>

                  {customerMode
                    === "existing"
                    ? (
                      <label>
                        Seleccionar cliente

                        <select
                          value={
                            eventForm
                              .customerId
                          }
                          onChange={
                            (
                              event,
                            ) =>
                              setEventForm(
                                (
                                  current,
                                ) => ({
                                  ...current,
                                  customerId:
                                    event
                                      .target
                                      .value,
                                }),
                              )
                          }
                        >
                          <option
                            value=""
                          >
                            Seleccionar…
                          </option>

                          {customers.map(
                            (
                              customer,
                            ) => (
                              <option
                                key={
                                  customer.id
                                }
                                value={
                                  customer.id
                                }
                              >
                                {
                                  customer.name
                                }
                                {
                                  customer.whatsapp
                                  ? ` · ${customer.whatsapp}`
                                  : ""
                                }
                              </option>
                            ),
                          )}
                        </select>
                      </label>
                    )
                    : (
                      <div
                        className={
                          styles.formGrid
                        }
                      >
                        <Input
                          label="Nombre *"
                          value={
                            eventForm
                              .customerName
                          }
                          onChange={
                            (value) =>
                              setEventForm(
                                (
                                  current,
                                ) => ({
                                  ...current,
                                  customerName:
                                    value,
                                }),
                              )
                          }
                        />

                        <Input
                          label="WhatsApp"
                          value={
                            eventForm
                              .customerWhatsapp
                          }
                          onChange={
                            (value) =>
                              setEventForm(
                                (
                                  current,
                                ) => ({
                                  ...current,
                                  customerWhatsapp:
                                    value,
                                }),
                              )
                          }
                        />

                        <Input
                          label="Email"
                          value={
                            eventForm
                              .customerEmail
                          }
                          onChange={
                            (value) =>
                              setEventForm(
                                (
                                  current,
                                ) => ({
                                  ...current,
                                  customerEmail:
                                    value,
                                }),
                              )
                          }
                        />
                      </div>
                    )}
                </div>
              )
              : null}


            {wizardStep
              === 2
              ? (
                <div
                  className={
                    styles.wizardBody
                  }
                >
                  <div
                    className={
                      styles.eventMainGrid
                    }
                  >
                    <label
                      className={
                        styles.eventField
                      }
                    >
                      <span>
                        Tipo de evento
                      </span>

                      <select
                        value={
                          eventForm.eventType
                        }
                        onChange={(event) =>
                          setEventForm(
                            (current) => ({
                              ...current,
                              eventType:
                                event.target.value,
                            }),
                          )
                        }
                      >
                        {eventTypes.map(
                          (type) => (
                            <option
                              key={type}
                              value={type}
                            >
                              {type}
                            </option>
                          ),
                        )}
                      </select>
                    </label>

                    <label
                      className={
                        styles.eventField
                      }
                    >
                      <span>
                        Nombre / referencia
                      </span>

                      <input
                        placeholder="Ej. Boda Laura y Andrés"
                        value={
                          eventForm.title
                        }
                        onChange={(event) =>
                          setEventForm(
                            (current) => ({
                              ...current,
                              title:
                                event.target.value,
                            }),
                          )
                        }
                      />
                    </label>

                    <label
                      className={
                        styles.eventField
                      }
                    >
                      <span>
                        Fecha de inicio
                      </span>

                      <input
                        type="date"
                        value={
                          eventForm.eventDate
                        }
                        onChange={(event) =>
                          setEventForm(
                            (current) => ({
                              ...current,
                              eventDate:
                                event.target.value,
                              eventEndDate:
                                current.eventEndDate
                                || event.target.value,
                            }),
                          )
                        }
                      />
                    </label>

                    <label
                      className={
                        styles.eventField
                      }
                    >
                      <span>
                        Fecha de finalización
                      </span>

                      <input
                        type="date"
                        min={
                          eventForm.eventDate
                          || undefined
                        }
                        value={
                          eventForm.eventEndDate
                        }
                        onChange={(event) =>
                          setEventForm(
                            (current) => ({
                              ...current,
                              eventEndDate:
                                event.target.value,
                            }),
                          )
                        }
                      />
                    </label>

                    <label
                      className={
                        styles.eventField
                      }
                    >
                      <span>
                        Hora de inicio
                      </span>

                      <input
                        type="time"
                        value={
                          eventForm.startTime
                        }
                        onChange={(event) =>
                          setEventForm(
                            (current) => ({
                              ...current,
                              startTime:
                                event.target.value,
                            }),
                          )
                        }
                      />
                    </label>

                    <label
                      className={
                        styles.eventField
                      }
                    >
                      <span>
                        Hora de finalización
                      </span>

                      <input
                        type="time"
                        value={
                          eventForm.endTime
                        }
                        onChange={(event) =>
                          setEventForm(
                            (current) => ({
                              ...current,
                              endTime:
                                event.target.value,
                            }),
                          )
                        }
                      />
                    </label>

                    <label
                      className={
                        styles.eventField
                      }
                    >
                      <span>
                        Número de invitados
                      </span>

                      <input
                        min="1"
                        placeholder="Ej. 120"
                        type="number"
                        value={
                          eventForm.guestCount
                        }
                        onChange={(event) =>
                          setEventForm(
                            (current) => ({
                              ...current,
                              guestCount:
                                event.target.value,
                            }),
                          )
                        }
                      />
                    </label>

                    <div
                      className={
                        styles.eventField
                      }
                    >
                      <span>
                        Duración
                      </span>

                      <div
                        className={
                          styles.durationCard
                        }
                      >
                        <span>
                          Duración calculada
                        </span>

                        <strong>
                          {eventDurationDays(
                            eventForm.eventDate,
                            eventForm.eventEndDate,
                          )
                            ? `${
                                eventDurationDays(
                                  eventForm.eventDate,
                                  eventForm.eventEndDate,
                                )
                              } día${
                                eventDurationDays(
                                  eventForm.eventDate,
                                  eventForm.eventEndDate,
                                ) === 1
                                  ? ""
                                  : "s"
                              }`
                            : "Sin fecha"}
                        </strong>
                      </div>
                    </div>

                    <label
                      className={
                        styles.eventField
                      }
                    >
                      <span>
                        Ciudad
                      </span>

                      <input
                        value={
                          eventForm.city
                        }
                        onChange={(event) =>
                          setEventForm(
                            (current) => ({
                              ...current,
                              city:
                                event.target.value,
                            }),
                          )
                        }
                      />
                    </label>

                    <label
                      className={
                        styles.eventField
                      }
                    >
                      <span>
                        Provincia
                      </span>

                      <input
                        value={
                          eventForm.province
                        }
                        onChange={(event) =>
                          setEventForm(
                            (current) => ({
                              ...current,
                              province:
                                event.target.value,
                            }),
                          )
                        }
                      />
                    </label>

                    <label
                      className={
                        styles.eventField
                      }
                    >
                      <span>
                        Lugar / espacio
                      </span>

                      <input
                        placeholder="Chalet, finca, salón..."
                        value={
                          eventForm.venueName
                        }
                        onChange={(event) =>
                          setEventForm(
                            (current) => ({
                              ...current,
                              venueName:
                                event.target.value,
                            }),
                          )
                        }
                      />
                    </label>

                    <label
                      className={
                        styles.eventField
                      }
                    >
                      <span>
                        Dirección
                      </span>

                      <input
                        placeholder="Dirección del evento"
                        value={
                          eventForm.venueAddress
                        }
                        onChange={(event) =>
                          setEventForm(
                            (current) => ({
                              ...current,
                              venueAddress:
                                event.target.value,
                            }),
                          )
                        }
                      />
                    </label>

                    <label
                      className={
                        styles.eventField
                      }
                    >
                      <span>
                        Presupuesto estimado (€)
                      </span>

                      <input
                        min="0"
                        placeholder="Ej. 8000"
                        step="1"
                        type="number"
                        value={
                          eventForm.targetBudget
                        }
                        onChange={(event) =>
                          setEventForm(
                            (current) => ({
                              ...current,
                              targetBudget:
                                event.target.value,
                            }),
                          )
                        }
                      />
                    </label>

                    <label
                      className={
                        `${styles.eventField} ${styles.eventFullField}`
                      }
                    >
                      <span>
                        Necesidad del cliente
                      </span>

                      <textarea
                        placeholder="Pegá el mensaje del cliente o escribí las necesidades principales del evento."
                        value={
                          eventForm.customerRequest
                        }
                        onChange={(event) =>
                          setEventForm(
                            (current) => ({
                              ...current,
                              customerRequest:
                                event.target.value,
                            }),
                          )
                        }
                      />
                    </label>
                  </div>
                </div>
              )
              : null}


            {wizardStep
              === 3
              ? (
                <div
                  className={
                    styles.wizardBody
                  }
                >
                  <p
                    className={
                      styles.helper
                    }
                  >
                    Seleccioná todo lo que el cliente necesita. Después el sistema buscará los proveedores compatibles.
                  </p>

                  <div
                    className={
                      styles.serviceGrid
                    }
                  >
                    {categories.map(
                      (
                        category,
                      ) => {
                        const selected =
                          eventForm
                            .selectedCategories
                            .includes(
                              category.id,
                            );

                        return (
                          <button
                            key={
                              category.id
                            }
                            className={
                              selected
                                ? styles.serviceSelected
                                : styles.serviceCard
                            }
                            onClick={() =>
                              toggleCategory(
                                category.id,
                              )
                            }
                          >
                            <span>
                              {
                                category.icon
                                ?? "•"
                              }
                            </span>

                            <strong>
                              {
                                category.name
                              }
                            </strong>

                            <small>
                              {
                                selected
                                  ? "Seleccionado"
                                  : "Agregar"
                              }
                            </small>
                          </button>
                        );
                      },
                    )}
                  </div>
                </div>
              )
              : null}


            {wizardStep
              === 4
              ? (
                <div
                  className={
                    styles.wizardBody
                  }
                >
                  <div
                    className={
                      styles.review
                    }
                  >
                    <Review
                      label="Cliente"
                      value={
                        customerMode
                        === "new"
                          ? eventForm
                              .customerName
                          : customersById
                              .get(
                                eventForm
                                  .customerId,
                              )
                              ?.name
                            ?? "Sin seleccionar"
                      }
                    />

                    <Review
                      label="Evento"
                      value={
                        eventForm
                          .eventType
                      }
                    />

                    <Review
                      label="Fecha"
                      value={
                        eventForm
                          .eventDate
                        || "Por definir"
                      }
                    />

                    <Review
                      label="Personas"
                      value={
                        eventForm
                          .guestCount
                        || "Por definir"
                      }
                    />

                    <Review
                      label="Ubicación"
                      value={
                        eventForm.city
                        || "Por definir"
                      }
                    />

                    <Review
                      label="Presupuesto objetivo"
                      value={
                        eventForm
                          .targetBudget
                          ? money(
                              eventForm
                                .targetBudget,
                            )
                          : "Sin definir"
                      }
                    />
                  </div>

                  <div
                    className={
                      styles.reviewServices
                    }
                  >
                    <span>
                      Servicios solicitados
                    </span>

                    <div>
                      {eventForm
                        .selectedCategories
                        .map(
                          (
                            id,
                          ) =>
                            categories
                              .find(
                                (
                                  category,
                                ) =>
                                  category.id
                                  === id,
                              )
                              ?.name,
                        )
                        .filter(
                          Boolean,
                        )
                        .join(
                          " · ",
                        )
                        || "Todavía ninguno"
                      }
                    </div>
                  </div>
                </div>
              )
              : null}


            <div
              className={
                styles.modalFooter
              }
            >
              <button
                className={
                  styles.secondaryButton
                }
                onClick={() => {
                  if (
                    wizardStep === 1
                  ) {
                    setWizardOpen(
                      false,
                    );

                    resetWizard();

                    return;
                  }

                  setWizardStep(
                    (
                      current,
                    ) =>
                      Math.max(
                        1,
                        current - 1,
                      ),
                  );
                }}
              >
                {
                  wizardStep === 1
                    ? "Cerrar"
                    : "Atrás"
                }
              </button>

              {wizardStep
                < 4
                ? (
                  <button
                    className={
                      styles.primaryButton
                    }
                    onClick={() =>
                      setWizardStep(
                        (
                          current,
                        ) =>
                          Math.min(
                            4,
                            current + 1,
                          ),
                      )
                    }
                  >
                    Continuar
                  </button>
                )
                : (
                  <button
                    className={
                      styles.primaryButton
                    }
                    disabled={
                      saving
                      || (
                        customerMode
                        === "existing"
                        && !eventForm
                          .customerId
                      )
                      || (
                        customerMode
                        === "new"
                        && !eventForm
                          .customerName
                      )
                    }
                    onClick={
                      () =>
                        void createEvent()
                    }
                  >
                    {
                      saving
                        ? "Creando…"
                        : "Crear evento"
                    }
                  </button>
                )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}


function Panel({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children:
    React.ReactNode;
}) {
  return (
    <section
      className={
        styles.panel
      }
    >
      <div
        className={
          styles.panelHeader
        }
      >
        <div>
          <h3>
            {title}
          </h3>

          {subtitle ? (
            <p>
              {subtitle}
            </p>
          ) : null}
        </div>

        {action}
      </div>

      {children}
    </section>
  );
}


function Metric({
  label,
  value,
  caption,
}: {
  label: string;
  value: string;
  caption: string;
}) {
  return (
    <article
      className={
        styles.metric
      }
    >
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>

      <small>
        {caption}
      </small>
    </article>
  );
}


function Status({
  status,
}: {
  status: string;
}) {
  return (
    <span
      className={
        styles.status
      }
      data-status={
        status
      }
    >
      {
        statusLabels[
          status
        ]
        ?? status
      }
    </span>
  );
}


function ActionRow({
  event,
  customer,
}: {
  event: CRMEvent;
  customer?: Customer;
}) {
  return (
    <div
      className={
        styles.actionRow
      }
    >
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
            customer?.name
            ?? "Cliente"
          }
        </small>
      </div>

      <span>
        {
          dateLabel(
            event
              .next_action_at
            ?? event
              .event_date,
          )
        }
      </span>
    </div>
  );
}


function EventRow({
  event,
  customer,
}: {
  event: CRMEvent;
  customer?: Customer;
}) {
  return (
    <div
      className={
        styles.actionRow
      }
    >
      <div>
        <strong>
          {
            event.title
          }
        </strong>

        <small>
          {
            customer?.name
            ?? "Cliente"
          }
          {" · "}
          {
            event.guest_count
            ? `${event.guest_count} pax`
            : "pax pendiente"
          }
        </small>
      </div>

      <Status
        status={
          event.status
        }
      />
    </div>
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


function Input({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange:
    (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label>
      {label}

      <input
        type={type}
        value={value}
        placeholder={
          placeholder
        }
        onChange={
          (event) =>
            onChange(
              event
                .target
                .value,
            )
        }
      />
    </label>
  );
}


function Review({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      className={
        styles.reviewItem
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
