"use client";

import {
  KeyboardEvent,
  useMemo,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import type {
  CommerceOrder,
} from "../../lib/api";

import styles from "./orders.module.css";

type Filter =
  | "all"
  | "paid-today"
  | "paid-month"
  | "pending-payment"
  | "active-reservations";

type Props = {
  orders: CommerceOrder[];
};

function numberValue(
  value:
    | number
    | string
    | null
    | undefined,
) {
  const result =
    Number(value ?? 0);

  return Number.isFinite(result)
    ? result
    : 0;
}

function money(
  value:
    | number
    | string,
  currency = "ARS",
) {
  return new Intl.NumberFormat(
    "es-AR",
    {
      style:
        "currency",

      currency,

      maximumFractionDigits:
        0,
    },
  ).format(
    numberValue(value),
  );
}

function dateTime(
  value?: string | null,
) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat(
    "es-AR",
    {
      dateStyle:
        "short",

      timeStyle:
        "short",
    },
  ).format(
    new Date(value),
  );
}

function sameLocalDay(
  value: string,
  reference: Date,
) {
  const date =
    new Date(value);

  return (
    date.getFullYear()
      === reference.getFullYear()
    && date.getMonth()
      === reference.getMonth()
    && date.getDate()
      === reference.getDate()
  );
}

function sameLocalMonth(
  value: string,
  reference: Date,
) {
  const date =
    new Date(value);

  return (
    date.getFullYear()
      === reference.getFullYear()
    && date.getMonth()
      === reference.getMonth()
  );
}

function paymentLabel(
  status?: string,
) {
  const labels:
    Record<string, string> = {
      paid:
        "Pagado",

      partial:
        "Pago parcial",

      refunded:
        "Reintegrado",

      unpaid:
        "Pendiente",
    };

  return labels[
    status
    ?? ""
  ]
  ?? "Pendiente";
}

function fulfillmentLabel(
  status?: string,
) {
  const labels:
    Record<string, string> = {
      pending:
        "Pendiente",

      picking:
        "En preparación",

      picked:
        "Preparado",

      packing:
        "Empacando",

      packed:
        "Empacado",

      ready_to_dispatch:
        "Listo para despacho",

      handed_to_carrier:
        "Con el transporte",

      shipped:
        "Enviado",

      delivered:
        "Entregado",

      incident:
        "Con incidencia",

      cancelled:
        "Cancelado",
    };

  return labels[
    status
    ?? ""
  ]
  ?? status
  ?? "-";
}

function reservationLabel(
  status?: string,
) {
  const labels:
    Record<string, string> = {
      active:
        "Activa",

      converted:
        "Confirmada",

      released:
        "Liberada",

      expired:
        "Vencida",

      consumed:
        "Consumida",

      none:
        "Sin reserva",
    };

  return labels[
    status
    ?? ""
  ]
  ?? "Sin reserva";
}

function paymentBadge(
  status?: string,
) {
  if (status === "paid") {
    return styles.badgeGreen;
  }

  if (
    status === "partial"
  ) {
    return styles.badgeAmber;
  }

  if (
    status === "refunded"
  ) {
    return styles.badgeGray;
  }

  return styles.badgeBlue;
}

function fulfillmentBadge(
  status?: string,
) {
  if (
    status === "delivered"
  ) {
    return styles.badgeGreen;
  }

  if (
    status === "cancelled"
    || status === "incident"
  ) {
    return styles.badgeRed;
  }

  if (
    status === "shipped"
    || status
      === "handed_to_carrier"
  ) {
    return styles.badgeBlue;
  }

  if (
    status === "picking"
    || status === "packing"
    || status === "packed"
    || status
      === "ready_to_dispatch"
  ) {
    return styles.badgeAmber;
  }

  return styles.badgeGray;
}

function reservationBadge(
  status?: string,
) {
  if (
    status === "active"
  ) {
    return styles.badgeAmber;
  }

  if (
    status === "converted"
    || status === "consumed"
  ) {
    return styles.badgeGreen;
  }

  if (
    status === "expired"
  ) {
    return styles.badgeRed;
  }

  return styles.badgeGray;
}

function filterTitle(
  filter: Filter,
) {
  const titles:
    Record<Filter, string> = {
      all:
        "Todos los pedidos",

      "paid-today":
        "Ventas cobradas hoy",

      "paid-month":
        "Ventas cobradas este mes",

      "pending-payment":
        "Pedidos pendientes de pago",

      "active-reservations":
        "Pedidos con reserva activa",
    };

  return titles[filter];
}

export function OrdersClient({
  orders,
}: Props) {
  const router =
    useRouter();

  const [
    activeFilter,
    setActiveFilter,
  ] =
    useState<Filter>(
      "all",
    );

  const [
    search,
    setSearch,
  ] =
    useState("");

  const now =
    new Date();

  const paidTodayOrders =
    orders.filter(
      (order) =>
        order.payment_status
          === "paid"
        && sameLocalDay(
          order.created_at,
          now,
        ),
    );

  const paidMonthOrders =
    orders.filter(
      (order) =>
        order.payment_status
          === "paid"
        && sameLocalMonth(
          order.created_at,
          now,
        ),
    );

  const pendingPaymentOrders =
    orders.filter(
      (order) =>
        order.payment_status
          === "unpaid"
        || order.payment_status
          === "partial",
    );

  const activeReservationOrders =
    orders.filter(
      (order) =>
        order.reservation_status
          === "active",
    );

  const paidToday =
    paidTodayOrders.reduce(
      (
        total,
        order,
      ) =>
        total
        + numberValue(
          order.total,
        ),
      0,
    );

  const paidMonth =
    paidMonthOrders.reduce(
      (
        total,
        order,
      ) =>
        total
        + numberValue(
          order.total,
        ),
      0,
    );

  const pendingAmount =
    pendingPaymentOrders.reduce(
      (
        total,
        order,
      ) =>
        total
        + Math.max(
          numberValue(
            order.total,
          )
          - numberValue(
            order.paid_amount,
          ),
          0,
        ),
      0,
    );

  const visibleOrders =
    useMemo(
      () => {
        let result =
          orders;

        if (
          activeFilter
            === "paid-today"
        ) {
          result =
            paidTodayOrders;
        }

        if (
          activeFilter
            === "paid-month"
        ) {
          result =
            paidMonthOrders;
        }

        if (
          activeFilter
            === "pending-payment"
        ) {
          result =
            pendingPaymentOrders;
        }

        if (
          activeFilter
            === "active-reservations"
        ) {
          result =
            activeReservationOrders;
        }

        const normalizedSearch =
          search
            .trim()
            .toLowerCase();

        if (
          !normalizedSearch
        ) {
          return result;
        }

        return result.filter(
          (order) => {
            const customer =
              order.customer;

            const haystack = [
              order.number,
              customer?.name,
              customer
                ?.business_name,
              customer
                ?.whatsapp,
              order.source,
              ...(order.items
                ?? [])
                .flatMap(
                  (
                    item,
                  ) => [
                    item
                      .product_name_snapshot,
                    item
                      .sku_snapshot,
                    item
                      .size_snapshot,
                    item
                      .color_name_snapshot,
                  ],
                ),
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();

            return haystack.includes(
              normalizedSearch,
            );
          },
        );
      },
      [
        activeFilter,
        search,
        orders,
      ],
    );

  function openOrder(
    orderId: string,
  ) {
    router.push(
      `/orders/${orderId}`,
    );
  }

  function handleRowKey(
    event:
      KeyboardEvent<HTMLTableRowElement>,
    orderId: string,
  ) {
    if (
      event.key === "Enter"
      || event.key === " "
    ) {
      event.preventDefault();
      openOrder(orderId);
    }
  }

  const cards: Array<{
    id: Filter;
    label: string;
    value: string;
    detail: string;
    icon: string;
  }> = [
    {
      id:
        "paid-today",

      label:
        "Ventas cobradas hoy",

      value:
        money(
          paidToday,
        ),

      detail:
        `${paidTodayOrders.length} pedidos pagados`,

      icon:
        "$",
    },
    {
      id:
        "paid-month",

      label:
        "Ventas cobradas del mes",

      value:
        money(
          paidMonth,
        ),

      detail:
        `${paidMonthOrders.length} pedidos pagados`,

      icon:
        "↗",
    },
    {
      id:
        "pending-payment",

      label:
        "Pendientes de pago",

      value:
        String(
          pendingPaymentOrders.length,
        ),

      detail:
        `${money(pendingAmount)} por cobrar`,

      icon:
        "!",
    },
    {
      id:
        "active-reservations",

      label:
        "Reservas activas",

      value:
        String(
          activeReservationOrders.length,
        ),

      detail:
        "Stock separado temporalmente",

      icon:
        "R",
    },
  ];

  return (
    <div className={styles.page}>
      <section className={styles.metrics}>
        {cards.map(
          (
            card,
          ) => (
            <button
              key={card.id}
              type="button"
              className={[
                styles.metricButton,
                activeFilter
                  === card.id
                  ? styles.metricActive
                  : "",
              ].join(" ")}
              onClick={
                () =>
                  setActiveFilter(
                    activeFilter
                      === card.id
                      ? "all"
                      : card.id,
                  )
              }
            >
              <div className={styles.metricTop}>
                <span className={styles.metricLabel}>
                  {card.label}
                </span>

                <span className={styles.metricIcon}>
                  {card.icon}
                </span>
              </div>

              <strong className={styles.metricValue}>
                {card.value}
              </strong>

              <div className={styles.metricFooter}>
                <span>
                  {card.detail}
                </span>

                <span className={styles.metricLink}>
                  {activeFilter
                    === card.id
                    ? "Quitar filtro"
                    : "Ver pedidos →"}
                </span>
              </div>
            </button>
          ),
        )}
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2 className={styles.panelTitle}>
              Pedidos registrados
            </h2>

            <p className={styles.panelDescription}>
              {visibleOrders.length} de {orders.length} pedidos
            </p>
          </div>

          <div className={styles.controls}>
            <input
              className={styles.search}
              type="search"
              value={search}
              placeholder="Buscar pedido, cliente o WhatsApp..."
              onChange={
                (
                  event,
                ) =>
                  setSearch(
                    event.target.value,
                  )
              }
            />

            {activeFilter
                !== "all"
              || search ? (
              <button
                type="button"
                className={styles.clearButton}
                onClick={
                  () => {
                    setActiveFilter(
                      "all",
                    );
                    setSearch("");
                  }
                }
              >
                Limpiar filtros
              </button>
            ) : null}
          </div>
        </div>

        {activeFilter
          !== "all" ? (
          <div className={styles.filterBar}>
            <span>
              Filtro activo: {filterTitle(activeFilter)}
            </span>

            <span>
              {visibleOrders.length} resultados
            </span>
          </div>
        ) : null}

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Cliente</th>
                <th>WhatsApp</th>
                <th>Productos</th>
                <th>Total</th>
                <th>Pago</th>
                <th>Preparación</th>
                <th>Reserva</th>
                <th>Vencimiento</th>
                <th>Fecha</th>
              </tr>
            </thead>

            <tbody>
              {visibleOrders.length
                === 0 ? (
                <tr>
                  <td
                    className={styles.empty}
                    colSpan={10}
                  >
                    No hay pedidos que coincidan con este filtro.
                  </td>
                </tr>
              ) : (
                visibleOrders.map(
                  (
                    order,
                  ) => (
                    <tr
                      key={order.id}
                      className={styles.row}
                      tabIndex={0}
                      role="link"
                      onClick={
                        () =>
                          openOrder(
                            order.id,
                          )
                      }
                      onKeyDown={
                        (
                          event,
                        ) =>
                          handleRowKey(
                            event,
                            order.id,
                          )
                      }
                    >
                      <td>
                        <div className={styles.orderNumber}>
                          {order.number}
                        </div>

                        <div className={styles.secondaryText}>
                          {order.source
                            ?? "panel"}
                        </div>
                      </td>

                      <td>
                        <div className={styles.primaryText}>
                          {order.customer
                            ?.business_name
                            || order.customer
                              ?.name
                            || "Cliente WhatsApp"}
                        </div>

                        {order.customer
                          ?.business_name
                          && order.customer
                            ?.name ? (
                          <div className={styles.secondaryText}>
                            {order.customer.name}
                          </div>
                        ) : null}
                      </td>

                      <td>
                        {order.customer
                          ?.whatsapp
                          ?? "-"}
                      </td>

                      <td>
                        <div className={styles.primaryText}>
                          {order.item_count
                            ?? 0} unidades
                        </div>

                        <div className={styles.productSummary}>
                          {order.items
                            ?.map(
                              (
                                item,
                              ) =>
                                `${item.quantity ?? 0}× ${
                                  item.product_name_snapshot
                                    || (
                                      item.size_snapshot
                                        ? `talle ${item.size_snapshot}`
                                        : item.sku_snapshot
                                          ?? "producto"
                                    )
                                }`,
                            )
                            .join(", ")
                            || "-"}
                        </div>
                      </td>

                      <td>
                        <div className={styles.primaryText}>
                          {money(
                            order.total,
                            order.currency,
                          )}
                        </div>
                      </td>

                      <td>
                        <span
                          className={[
                            styles.badge,
                            paymentBadge(
                              order.payment_status,
                            ),
                          ].join(" ")}
                        >
                          {paymentLabel(
                            order.payment_status,
                          )}
                        </span>
                      </td>

                      <td>
                        <span
                          className={[
                            styles.badge,
                            fulfillmentBadge(
                              order.fulfillment_status,
                            ),
                          ].join(" ")}
                        >
                          {fulfillmentLabel(
                            order.fulfillment_status,
                          )}
                        </span>
                      </td>

                      <td>
                        <span
                          className={[
                            styles.badge,
                            reservationBadge(
                              order.reservation_status,
                            ),
                          ].join(" ")}
                        >
                          {reservationLabel(
                            order.reservation_status,
                          )}
                        </span>
                      </td>

                      <td>
                        {dateTime(
                          order.reservation
                            ?.expires_at,
                        )}
                      </td>

                      <td>
                        {dateTime(
                          order.created_at,
                        )}
                      </td>
                    </tr>
                  ),
                )
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
