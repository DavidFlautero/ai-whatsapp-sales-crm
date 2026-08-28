"use client";

import Link from "next/link";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import type {
  CommerceOrder,
} from "../../lib/api";

import styles from "./crm.module.css";

type Metadata = {
  email?: string;
  country?: string;
  province?: string;
  city?: string;
  address?: string;
  postal_code?: string;
  address_reference?: string;
  customer_type?: string;
  notes?: string;
  name_source?: string;
  name_confirmed?: boolean;
};

export type CRMContact = {
  id?: string;
  phone: string;
  name?: string;
  business_name?: string;
  status?: string;
  temperature?: string;
  ai_score?: number;
  total_sales?: number;
  last_message?: string;
  last_seen_at?: string;
  created_at?: string;
  metadata?: Metadata;
};

type Props = {
  initialContacts: CRMContact[];
  orders: CommerceOrder[];
};

type MetricFilter =
  | "all"
  | "lead"
  | "customer"
  | "hot"
  | "missing_address";

function value(
  input: unknown,
) {
  return typeof input === "string"
    ? input.trim()
    : "";
}

function normalizePhone(
  input: string,
) {
  return input.replace(/\D/g, "");
}

function initials(
  input?: string,
) {
  const parts =
    value(input)
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2);

  return parts.length
    ? parts
        .map((part) =>
          part[0]?.toUpperCase() ?? "",
        )
        .join("")
    : "?";
}

function money(
  amount: number,
) {
  return new Intl.NumberFormat(
    "es-CO",
    {
      style:
        "currency",

      currency:
        "COP",

      maximumFractionDigits:
        0,
    },
  ).format(amount);
}

function dateTime(
  input?: string,
) {
  if (!input) {
    return "Sin actividad";
  }

  const date =
    new Date(input);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "Sin actividad";
  }

  return new Intl.DateTimeFormat(
    "es-AR",
    {
      day:
        "2-digit",

      month:
        "2-digit",

      year:
        "numeric",

      hour:
        "2-digit",

      minute:
        "2-digit",
    },
  ).format(date);
}

function statusLabel(
  status?: string,
) {
  switch (status) {
    case "customer":
      return "Cliente";

    case "inactive":
      return "Inactivo";

    case "blocked":
      return "Bloqueado";

    default:
      return "Lead";
  }
}

function temperatureLabel(
  temperature?: string,
) {
  switch (temperature) {
    case "hot":
      return "Caliente";

    case "cold":
      return "Frío";

    default:
      return "Interesado";
  }
}

function statusClass(
  status?: string,
) {
  switch (status) {
    case "customer":
      return styles.customerStatus;

    case "inactive":
      return styles.inactive;

    case "blocked":
      return styles.blocked;

    default:
      return styles.lead;
  }
}

function temperatureClass(
  temperature?: string,
) {
  switch (temperature) {
    case "hot":
      return styles.hot;

    case "cold":
      return styles.cold;

    default:
      return styles.warm;
  }
}

function orderPhone(
  order: CommerceOrder,
) {
  return normalizePhone(
    order.customer
      ?.whatsapp
      ?? "",
  );
}

function csvEscape(
  input: unknown,
) {
  const text =
    String(
      input ?? "",
    );

  return `"${text.replace(/"/g, '""')}"`;
}

export function CRMClient({
  initialContacts,
  orders,
}: Props) {
  const router =
    useRouter();

  const [
    contacts,
    setContacts,
  ] =
    useState(
      initialContacts,
    );


  const [
    selectedPhone,
    setSelectedPhone,
  ] =
    useState<string | null>(
      initialContacts[0]
        ?.phone
      ?? null,
    );

  const [
    search,
    setSearch,
  ] =
    useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] =
    useState("all");

  const [
    temperatureFilter,
    setTemperatureFilter,
  ] =
    useState("all");

  const [
    locationFilter,
    setLocationFilter,
  ] =
    useState("all");

  const [
    metricFilter,
    setMetricFilter,
  ] =
    useState<MetricFilter>(
      "all",
    );

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  useEffect(
    () => {
      if (!saving) {
        setContacts(
          initialContacts,
        );
      }
    },
    [
      initialContacts,
      saving,
    ],
  );

  const [
    saveMessage,
    setSaveMessage,
  ] =
    useState("");

  const [
    saveError,
    setSaveError,
  ] =
    useState(false);

  const selected =
    contacts.find(
      (contact) =>
        contact.phone
        === selectedPhone,
    )
    ?? null;

  const [
    form,
    setForm,
  ] =
    useState({
      name:
        "",

      business_name:
        "",

      email:
        "",

      country:
        "",

      province:
        "",

      city:
        "",

      address:
        "",

      postal_code:
        "",

      address_reference:
        "",

      customer_type:
        "wholesaler",

      status:
        "lead",

      temperature:
        "warm",

      notes:
        "",
    });

  useEffect(
    () => {
      if (!selected) {
        return;
      }

      setForm({
        name:
          selected.name
          ?? "",

        business_name:
          selected.business_name
          ?? "",

        email:
          selected.metadata
            ?.email
          ?? "",

        country:
          selected.metadata
            ?.country
          ?? "",

        province:
          selected.metadata
            ?.province
          ?? "",

        city:
          selected.metadata
            ?.city
          ?? "",

        address:
          selected.metadata
            ?.address
          ?? "",

        postal_code:
          selected.metadata
            ?.postal_code
          ?? "",

        address_reference:
          selected.metadata
            ?.address_reference
          ?? "",

        customer_type:
          selected.metadata
            ?.customer_type
          ?? "wholesaler",

        status:
          selected.status
          ?? "lead",

        temperature:
          selected.temperature
          ?? "warm",

        notes:
          selected.metadata
            ?.notes
          ?? "",
      });

      setSaveMessage("");
      setSaveError(false);
    },
    [
      selected,
    ],
  );

  useEffect(
    () => {
      const interval =
        window.setInterval(
          () => {
            if (!saving) {
              router.refresh();
            }
          },
          5000,
        );

      return () =>
        window.clearInterval(
          interval,
        );
    },
    [
      router,
      saving,
    ],
  );

  const ordersByPhone =
    useMemo(
      () => {
        const map =
          new Map<
            string,
            CommerceOrder[]
          >();

        for (
          const order
          of orders
        ) {
          const phone =
            orderPhone(
              order,
            );

          if (!phone) {
            continue;
          }

          const existing =
            map.get(phone)
            ?? [];

          existing.push(
            order,
          );

          map.set(
            phone,
            existing,
          );
        }

        return map;
      },
      [
        orders,
      ],
    );

  const locations =
    useMemo(
      () =>
        Array.from(
          new Set(
            contacts
              .map(
                (contact) =>
                  value(
                    contact.metadata
                      ?.city,
                  ),
              )
              .filter(Boolean),
          ),
        ).sort(),
      [
        contacts,
      ],
    );

  const metrics =
    useMemo(
      () => ({
        all:
          contacts.length,

        lead:
          contacts.filter(
            (contact) =>
              (
                contact.status
                ?? "lead"
              )
              === "lead",
          ).length,

        customer:
          contacts.filter(
            (contact) =>
              contact.status
              === "customer",
          ).length,

        hot:
          contacts.filter(
            (contact) =>
              contact.temperature
              === "hot",
          ).length,

        missingAddress:
          contacts.filter(
            (contact) =>
              !value(
                contact.metadata
                  ?.address,
              ),
          ).length,
      }),
      [
        contacts,
      ],
    );

  const filteredContacts =
    useMemo(
      () => {
        const query =
          search
            .trim()
            .toLowerCase();

        return contacts.filter(
          (contact) => {
            const metadata =
              contact.metadata
              ?? {};

            const normalizedSearch =
              [
                contact.name,
                contact.business_name,
                contact.phone,
                metadata.email,
                metadata.country,
                metadata.province,
                metadata.city,
                metadata.address,
                metadata.notes,
                contact.last_message,
              ]
                .map(
                  (item) =>
                    value(item)
                      .toLowerCase(),
                )
                .join(" ");

            const matchesSearch =
              !query
              || normalizedSearch
                .includes(query);

            const matchesStatus =
              statusFilter
              === "all"
              || (
                contact.status
                ?? "lead"
              )
              === statusFilter;

            const matchesTemperature =
              temperatureFilter
              === "all"
              || (
                contact.temperature
                ?? "warm"
              )
              === temperatureFilter;

            const matchesLocation =
              locationFilter
              === "all"
              || value(
                metadata.city,
              )
              === locationFilter;

            const matchesMetric =
              metricFilter
              === "all"
              || (
                metricFilter
                === "lead"
                && (
                  contact.status
                  ?? "lead"
                )
                === "lead"
              )
              || (
                metricFilter
                === "customer"
                && contact.status
                === "customer"
              )
              || (
                metricFilter
                === "hot"
                && contact.temperature
                === "hot"
              )
              || (
                metricFilter
                === "missing_address"
                && !value(
                  metadata.address,
                )
              );

            return (
              matchesSearch
              && matchesStatus
              && matchesTemperature
              && matchesLocation
              && matchesMetric
            );
          },
        );
      },
      [
        contacts,
        search,
        statusFilter,
        temperatureFilter,
        locationFilter,
        metricFilter,
      ],
    );

  const selectedOrders =
    selected
      ? ordersByPhone.get(
          normalizePhone(
            selected.phone,
          ),
        )
        ?? []
      : [];

  const selectedSales =
    selectedOrders.reduce(
      (
        total,
        order,
      ) =>
        total
        + Number(
          order.paid_amount
          || order.total
          || 0,
        ),
      0,
    );

  function field(
    name:
      keyof typeof form,
    valueToSet: string,
  ) {
    setForm(
      (current) => ({
        ...current,
        [name]:
          valueToSet,
      }),
    );

    setSaveMessage("");
  }

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
    setTemperatureFilter("all");
    setLocationFilter("all");
    setMetricFilter("all");
  }

  async function saveContact() {
    if (!selected) {
      return;
    }

    if (
      form.name
        .trim()
        .length
      < 2
    ) {
      setSaveError(true);
      setSaveMessage(
        "El nombre es obligatorio.",
      );

      return;
    }

    setSaving(true);
    setSaveError(false);
    setSaveMessage(
      "Guardando...",
    );

    try {
      const response =
        await fetch(
          `/dashboard-api/contacts/${encodeURIComponent(selected.phone)}`,
          {
            method:
              "PATCH",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                ...form,

                name:
                  form.name.trim(),

                name_confirmed:
                  true,
              }),
          },
        );

      const payload =
        await response.json();

      if (
        !response.ok
        || !payload.ok
      ) {
        throw new Error(
          payload.error
          ?? "No se pudo guardar",
        );
      }

      setContacts(
        (current) =>
          current.map(
            (contact) =>
              contact.phone
              === selected.phone
                ? payload.contact
                : contact,
          ),
      );

      setSaveMessage(
        "Cliente actualizado.",
      );
      setSaveError(false);
    } catch (
      error
    ) {
      setSaveError(true);
      setSaveMessage(
        error instanceof Error
          ? error.message
          : "No se pudo guardar",
      );
    } finally {
      setSaving(false);
    }
  }

  function exportFiltered() {
    const header = [
      "Nombre",
      "Negocio",
      "Teléfono",
      "Email",
      "País",
      "Provincia",
      "Ciudad",
      "Dirección",
      "Estado",
      "Temperatura",
      "Último mensaje",
      "Última actividad",
    ];

    const rows =
      filteredContacts.map(
        (contact) => [
          contact.name
          ?? "",

          contact.business_name
          ?? "",

          contact.phone,

          contact.metadata
            ?.email
          ?? "",

          contact.metadata
            ?.country
          ?? "",

          contact.metadata
            ?.province
          ?? "",

          contact.metadata
            ?.city
          ?? "",

          contact.metadata
            ?.address
          ?? "",

          statusLabel(
            contact.status,
          ),

          temperatureLabel(
            contact.temperature,
          ),

          contact.last_message
          ?? "",

          contact.last_seen_at
          ?? "",
        ],
      );

    const csv =
      [
        header,
        ...rows,
      ]
        .map(
          (row) =>
            row
              .map(csvEscape)
              .join(","),
        )
        .join("\n");

    const blob =
      new Blob(
        [
          "\uFEFF",
          csv,
        ],
        {
          type:
            "text/csv;charset=utf-8",
        },
      );

    const url =
      URL.createObjectURL(
        blob,
      );

    const anchor =
      document.createElement(
        "a",
      );

    anchor.href =
      url;

    anchor.download =
      `crm-clientes-${new Date().toISOString().slice(0, 10)}.csv`;

    anchor.click();

    URL.revokeObjectURL(
      url,
    );
  }

  return (
    <div
      className={
        styles.workspace
      }
    >
      <section
        className={
          styles.metrics
        }
      >
        <button
          type="button"
          className={`${styles.metric} ${
            metricFilter === "all"
              ? styles.metricActive
              : ""
          }`}
          onClick={
            () =>
              setMetricFilter(
                "all",
              )
          }
        >
          <span className={styles.metricLabel}>
            Contactos
          </span>

          <strong className={styles.metricValue}>
            {metrics.all}
          </strong>

          <span className={styles.metricHint}>
            Base comercial completa
          </span>
        </button>

        <button
          type="button"
          className={`${styles.metric} ${
            metricFilter === "lead"
              ? styles.metricActive
              : ""
          }`}
          onClick={
            () =>
              setMetricFilter(
                "lead",
              )
          }
        >
          <span className={styles.metricLabel}>
            Leads
          </span>

          <strong className={styles.metricValue}>
            {metrics.lead}
          </strong>

          <span className={styles.metricHint}>
            Aún sin conversión
          </span>
        </button>

        <button
          type="button"
          className={`${styles.metric} ${
            metricFilter === "customer"
              ? styles.metricActive
              : ""
          }`}
          onClick={
            () =>
              setMetricFilter(
                "customer",
              )
          }
        >
          <span className={styles.metricLabel}>
            Clientes
          </span>

          <strong className={styles.metricValue}>
            {metrics.customer}
          </strong>

          <span className={styles.metricHint}>
            Contactos convertidos
          </span>
        </button>

        <button
          type="button"
          className={`${styles.metric} ${
            metricFilter === "hot"
              ? styles.metricActive
              : ""
          }`}
          onClick={
            () =>
              setMetricFilter(
                "hot",
              )
          }
        >
          <span className={styles.metricLabel}>
            Calientes
          </span>

          <strong className={styles.metricValue}>
            {metrics.hot}
          </strong>

          <span className={styles.metricHint}>
            Alta intención
          </span>
        </button>

        <button
          type="button"
          className={`${styles.metric} ${
            metricFilter
            === "missing_address"
              ? styles.metricActive
              : ""
          }`}
          onClick={
            () =>
              setMetricFilter(
                "missing_address",
              )
          }
        >
          <span className={styles.metricLabel}>
            Sin dirección
          </span>

          <strong className={styles.metricValue}>
            {metrics.missingAddress}
          </strong>

          <span className={styles.metricHint}>
            Requieren completar ficha
          </span>
        </button>
      </section>

      <section
        className={
          styles.panel
        }
      >
        <div
          className={
            styles.toolbar
          }
        >
          <input
            className={
              styles.input
            }
            value={search}
            placeholder="Buscar nombre, negocio, teléfono, ciudad, dirección..."
            onChange={
              (event) =>
                setSearch(
                  event.target.value,
                )
            }
          />

          <select
            className={
              styles.select
            }
            value={
              statusFilter
            }
            onChange={
              (event) =>
                setStatusFilter(
                  event.target.value,
                )
            }
          >
            <option value="all">
              Todos los estados
            </option>

            <option value="lead">
              Leads
            </option>

            <option value="customer">
              Clientes
            </option>

            <option value="inactive">
              Inactivos
            </option>

            <option value="blocked">
              Bloqueados
            </option>
          </select>

          <select
            className={
              styles.select
            }
            value={
              temperatureFilter
            }
            onChange={
              (event) =>
                setTemperatureFilter(
                  event.target.value,
                )
            }
          >
            <option value="all">
              Todas las temperaturas
            </option>

            <option value="hot">
              Calientes
            </option>

            <option value="warm">
              Interesados
            </option>

            <option value="cold">
              Fríos
            </option>
          </select>

          <select
            className={
              styles.select
            }
            value={
              locationFilter
            }
            onChange={
              (event) =>
                setLocationFilter(
                  event.target.value,
                )
            }
          >
            <option value="all">
              Todas las ciudades
            </option>

            {locations.map(
              (location) => (
                <option
                  key={location}
                  value={location}
                >
                  {location}
                </option>
              ),
            )}
          </select>

          <button
            type="button"
            className={
              styles.clearButton
            }
            onClick={
              clearFilters
            }
          >
            Limpiar
          </button>

          <button
            type="button"
            className={
              styles.exportButton
            }
            onClick={
              exportFiltered
            }
          >
            Exportar filtrados
          </button>
        </div>

        <div
          className={
            styles.content
          }
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
                  <th>Cliente</th>
                  <th>Teléfono</th>
                  <th>Ubicación</th>
                  <th>Estado</th>
                  <th>Temperatura</th>
                  <th>Pedidos</th>
                  <th>Último mensaje</th>
                  <th>Actividad</th>
                </tr>
              </thead>

              <tbody>
                {filteredContacts.length
                  === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <div className={styles.empty}>
                        No hay clientes que coincidan con los filtros.
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredContacts.map(
                    (contact) => {
                      const phoneOrders =
                        ordersByPhone.get(
                          normalizePhone(
                            contact.phone,
                          ),
                        )
                        ?? [];

                      const location =
                        [
                          contact.metadata
                            ?.city,
                          contact.metadata
                            ?.province,
                        ]
                          .filter(Boolean)
                          .join(", ");

                      return (
                        <tr
                          key={
                            contact.phone
                          }
                          className={`${styles.row} ${
                            selectedPhone
                            === contact.phone
                              ? styles.rowSelected
                              : ""
                          }`}
                          onClick={
                            () =>
                              setSelectedPhone(
                                contact.phone,
                              )
                          }
                        >
                          <td>
                            <div className={styles.customer}>
                              <div className={styles.avatar}>
                                {initials(contact.name)}
                              </div>

                              <div>
                                <strong className={styles.customerName}>
                                  {contact.name
                                  ?? "Cliente WhatsApp"}
                                </strong>

                                <span className={styles.customerBusiness}>
                                  {contact.business_name
                                  ?? "Sin negocio registrado"}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td>
                            {contact.phone}
                          </td>

                          <td>
                            {location
                            || "Sin ubicación"}
                          </td>

                          <td>
                            <span className={`${styles.badge} ${statusClass(contact.status)}`}>
                              {statusLabel(contact.status)}
                            </span>
                          </td>

                          <td>
                            <span className={`${styles.badge} ${temperatureClass(contact.temperature)}`}>
                              {temperatureLabel(contact.temperature)}
                            </span>
                          </td>

                          <td>
                            {phoneOrders.length}
                          </td>

                          <td>
                            <div className={styles.message}>
                              {contact.last_message
                              ?? "-"}
                            </div>
                          </td>

                          <td>
                            {dateTime(contact.last_seen_at)}
                          </td>
                        </tr>
                      );
                    },
                  )
                )}
              </tbody>
            </table>
          </div>

          <aside
            className={
              styles.drawer
            }
          >
            {!selected ? (
              <div className={styles.drawerEmpty}>
                Seleccioná un cliente para ver y editar su ficha.
              </div>
            ) : (
              <>
                <div className={styles.drawerHeader}>
                  <div>
                    <h2 className={styles.drawerTitle}>
                      {selected.name
                      ?? "Cliente WhatsApp"}
                    </h2>

                    <div className={styles.drawerSubtitle}>
                      {selected.business_name
                      ?? selected.phone}
                    </div>
                  </div>

                  <button
                    type="button"
                    className={
                      styles.closeButton
                    }
                    onClick={
                      () =>
                        setSelectedPhone(
                          null,
                        )
                    }
                  >
                    ×
                  </button>
                </div>

                <div className={styles.drawerActions}>
                  <Link
                    className={styles.primaryAction}
                    href={`/conversations?phone=${encodeURIComponent(selected.phone)}`}
                  >
                    Abrir conversación
                  </Link>

                  <Link
                    className={styles.secondaryAction}
                    href="/orders"
                  >
                    Ver pedidos
                  </Link>
                </div>

                <section className={styles.section}>
                  <h3 className={styles.sectionTitle}>
                    Resumen comercial
                  </h3>

                  <div className={styles.summaryGrid}>
                    <div className={styles.summaryCard}>
                      <span>Pedidos</span>
                      <strong>{selectedOrders.length}</strong>
                    </div>

                    <div className={styles.summaryCard}>
                      <span>Ventas asociadas</span>
                      <strong>{money(selectedSales)}</strong>
                    </div>

                    <div className={styles.summaryCard}>
                      <span>Última actividad</span>
                      <strong>{dateTime(selected.last_seen_at)}</strong>
                    </div>

                    <div className={styles.summaryCard}>
                      <span>Puntaje IA</span>
                      <strong>{selected.ai_score ?? 0}</strong>
                    </div>
                  </div>
                </section>

                <section className={styles.section}>
                  <h3 className={styles.sectionTitle}>
                    Datos del cliente
                  </h3>

                  <div className={styles.form}>
                    <div className={styles.formGrid}>
                      <input
                        className={styles.input}
                        value={form.name}
                        placeholder="Nombre *"
                        onChange={
                          (event) =>
                            field(
                              "name",
                              event.target.value,
                            )
                        }
                      />

                      <input
                        className={styles.input}
                        value={form.business_name}
                        placeholder="Negocio"
                        onChange={
                          (event) =>
                            field(
                              "business_name",
                              event.target.value,
                            )
                        }
                      />

                      <input
                        className={styles.input}
                        value={form.email}
                        placeholder="Email"
                        onChange={
                          (event) =>
                            field(
                              "email",
                              event.target.value,
                            )
                        }
                      />

                      <input
                        className={styles.input}
                        value={selected.phone}
                        readOnly
                        aria-label="Teléfono"
                      />

                      <select
                        className={styles.select}
                        value={form.status}
                        onChange={
                          (event) =>
                            field(
                              "status",
                              event.target.value,
                            )
                        }
                      >
                        <option value="lead">
                          Lead
                        </option>

                        <option value="customer">
                          Cliente
                        </option>

                        <option value="inactive">
                          Inactivo
                        </option>

                        <option value="blocked">
                          Bloqueado
                        </option>
                      </select>

                      <select
                        className={styles.select}
                        value={form.temperature}
                        onChange={
                          (event) =>
                            field(
                              "temperature",
                              event.target.value,
                            )
                        }
                      >
                        <option value="cold">
                          Frío
                        </option>

                        <option value="warm">
                          Interesado
                        </option>

                        <option value="hot">
                          Caliente
                        </option>
                      </select>

                      <select
                        className={styles.select}
                        value={form.customer_type}
                        onChange={
                          (event) =>
                            field(
                              "customer_type",
                              event.target.value,
                            )
                        }
                      >
                        <option value="retail">
                          Minorista
                        </option>

                        <option value="wholesaler">
                          Mayorista
                        </option>

                        <option value="distributor">
                          Distribuidor
                        </option>

                        <option value="reseller">
                          Revendedor
                        </option>

                        <option value="vip">
                          VIP
                        </option>

                        <option value="other">
                          Otro
                        </option>
                      </select>

                      <input
                        className={styles.input}
                        value={form.country}
                        placeholder="País"
                        onChange={
                          (event) =>
                            field(
                              "country",
                              event.target.value,
                            )
                        }
                      />

                      <input
                        className={styles.input}
                        value={form.province}
                        placeholder="Provincia"
                        onChange={
                          (event) =>
                            field(
                              "province",
                              event.target.value,
                            )
                        }
                      />

                      <input
                        className={styles.input}
                        value={form.city}
                        placeholder="Ciudad"
                        onChange={
                          (event) =>
                            field(
                              "city",
                              event.target.value,
                            )
                        }
                      />

                      <input
                        className={styles.input}
                        value={form.address}
                        placeholder="Dirección"
                        onChange={
                          (event) =>
                            field(
                              "address",
                              event.target.value,
                            )
                        }
                      />

                      <input
                        className={styles.input}
                        value={form.postal_code}
                        placeholder="Código postal"
                        onChange={
                          (event) =>
                            field(
                              "postal_code",
                              event.target.value,
                            )
                        }
                      />
                    </div>

                    <textarea
                      className={`${styles.input} ${styles.textarea}`}
                      value={form.address_reference}
                      placeholder="Referencia de entrega"
                      onChange={
                        (event) =>
                          field(
                            "address_reference",
                            event.target.value,
                          )
                      }
                    />

                    <textarea
                      className={`${styles.input} ${styles.textarea}`}
                      value={form.notes}
                      placeholder="Notas internas"
                      onChange={
                        (event) =>
                          field(
                            "notes",
                            event.target.value,
                          )
                      }
                    />

                    <div className={styles.saveRow}>
                      {saveMessage ? (
                        <span
                          className={`${styles.saveStatus} ${
                            saveError
                              ? styles.error
                              : styles.success
                          }`}
                        >
                          {saveMessage}
                        </span>
                      ) : null}

                      <button
                        type="button"
                        className={styles.exportButton}
                        disabled={saving}
                        onClick={
                          () =>
                            void saveContact()
                        }
                      >
                        {saving
                          ? "Guardando..."
                          : "Guardar cliente"}
                      </button>
                    </div>
                  </div>
                </section>

                <section className={styles.section}>
                  <h3 className={styles.sectionTitle}>
                    Pedidos asociados
                  </h3>

                  <div className={styles.orders}>
                    {selectedOrders.length
                      === 0 ? (
                      <div className={styles.summaryCard}>
                        Este cliente todavía no tiene pedidos asociados por teléfono.
                      </div>
                    ) : (
                      selectedOrders
                        .slice(0, 6)
                        .map(
                          (order) => (
                            <Link
                              key={order.id}
                              href={`/orders/${order.id}`}
                              className={styles.orderCard}
                            >
                              <div className={styles.orderTop}>
                                <strong className={styles.orderNumber}>
                                  {order.number}
                                </strong>

                                <strong className={styles.orderTotal}>
                                  {money(Number(order.total || 0))}
                                </strong>
                              </div>

                              <div className={styles.orderMeta}>
                                {order.payment_status}
                                {" · "}
                                {order.fulfillment_status}
                                {" · "}
                                {dateTime(order.created_at)}
                              </div>
                            </Link>
                          ),
                        )
                    )}
                  </div>
                </section>
              </>
            )}
          </aside>
        </div>
      </section>
    </div>
  );
}
