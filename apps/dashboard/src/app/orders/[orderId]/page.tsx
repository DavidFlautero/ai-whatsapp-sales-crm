import Link from "next/link";

import {
  notFound,
} from "next/navigation";

import {
  AppShell,
} from "../../../components/app-shell/AppShell";

import {
  Header,
} from "../../../components/ui/Header";

import {
  LiveRefresh,
} from "../../../components/live-refresh/LiveRefresh";

import {
  getOrderDetail,
} from "../../../lib/api";

import {
  OrderActions,
} from "./OrderActions";

import styles from "./order-detail.module.css";

function numberValue(
  value:
    | string
    | number
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
    | string
    | number
    | null
    | undefined,
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
        "medium",

      timeStyle:
        "short",

      timeZone:
        "Europe/Madrid",
    },
  ).format(
    new Date(value),
  );
}

function statusLabel(
  value?: string | null,
) {
  const labels:
    Record<string, string> = {
      received:
        "Recibido",

      confirmed:
        "Confirmado",

      cancelled:
        "Cancelado",

      unpaid:
        "Pendiente",

      partial:
        "Pago parcial",

      paid:
        "Pagado",

      refunded:
        "Reintegrado",

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

      active:
        "Activa",

      converted:
        "Confirmada por pago",

      released:
        "Liberada",

      expired:
        "Vencida",

      consumed:
        "Consumida",

      none:
        "Sin reserva",

      confirmed_payment:
        "Confirmado",
    };

  return labels[
    value
    ?? ""
  ]
  ?? value
  ?? "-";
}

function statusClass(
  status?: string | null,
) {
  if (
    status === "paid"
    || status === "delivered"
    || status === "converted"
    || status === "consumed"
    || status === "confirmed"
  ) {
    return styles.green;
  }

  if (
    status === "partial"
    || status === "active"
    || status === "picking"
    || status === "packing"
    || status === "packed"
    || status === "ready_to_dispatch"
  ) {
    return styles.amber;
  }

  if (
    status === "shipped"
    || status === "handed_to_carrier"
  ) {
    return styles.blue;
  }

  if (
    status === "cancelled"
    || status === "incident"
    || status === "expired"
  ) {
    return styles.red;
  }

  return styles.gray;
}

function StatusBadge({
  value,
}: {
  value?: string | null;
}) {
  return (
    <span
      className={[
        styles.badge,
        statusClass(value),
      ].join(" ")}
    >
      {statusLabel(value)}
    </span>
  );
}

export default async function OrderDetailPage({
  params,
}: {
  params:
    Promise<{
      orderId: string;
    }>;
}) {
  const {
    orderId,
  } =
    await params;

  const order =
    await getOrderDetail(
      orderId,
    );

  if (!order) {
    notFound();
  }

  const customerName =
    order.customer
      ?.business_name
    || order.customer
      ?.name
    || "Cliente WhatsApp";

  const total =
    numberValue(
      order.total,
    );

  const paidAmount =
    numberValue(
      order.paid_amount,
    );

  const pendingAmount =
    Math.max(
      total
      - paidAmount,
      0,
    );

  const itemCount =
    order.items.reduce(
      (
        accumulator,
        item,
      ) =>
        accumulator
        + numberValue(
          item.quantity,
        ),
      0,
    );

  return (
    <AppShell>
      <div className={styles.page}>
        <Header
          kicker="DETALLE DE PEDIDO"
          title={order.number}
          description={`${customerName} · ${statusLabel(order.payment_status)} · ${statusLabel(order.fulfillment_status)}`}
          action={
            <Link
              className="btn"
              href="/orders"
            >
              ← Volver a pedidos
            </Link>
          }
        />

        <div
          style={{
            display:
              "flex",

            justifyContent:
              "flex-end",
          }}
        >
          <LiveRefresh
            intervalMs={2000}
            label="Pedido sincronizado"
          />
        </div>

        <section className={styles.summaryGrid}>
          <article className={styles.summaryCard}>
            <span className={styles.summaryLabel}>
              Total del pedido
            </span>

            <strong className={styles.summaryValue}>
              {money(
                order.total,
                order.currency,
              )}
            </strong>

            <span className={styles.summaryFooter}>
              {itemCount} unidades en total
            </span>
          </article>

          <article className={styles.summaryCard}>
            <span className={styles.summaryLabel}>
              Importe pagado
            </span>

            <strong className={styles.summaryValue}>
              {money(
                order.paid_amount,
                order.currency,
              )}
            </strong>

            <StatusBadge
              value={order.payment_status}
            />
          </article>

          <article className={styles.summaryCard}>
            <span className={styles.summaryLabel}>
              Saldo pendiente
            </span>

            <strong className={styles.summaryValue}>
              {money(
                pendingAmount,
                order.currency,
              )}
            </strong>

            <span className={styles.summaryFooter}>
              Estado comercial: {statusLabel(order.commercial_status)}
            </span>
          </article>

          <article className={styles.summaryCard}>
            <span className={styles.summaryLabel}>
              Reserva de stock
            </span>

            <div>
              <StatusBadge
                value={order.reservation_status}
              />
            </div>

            <span className={styles.summaryFooter}>
              Vence: {dateTime(order.reservation?.expires_at)}
            </span>
          </article>
        </section>

        <div className={styles.layout}>
          <main className={styles.mainColumn}>
            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <h2 className={styles.panelTitle}>
                    Productos
                  </h2>

                  <p className={styles.panelSubtitle}>
                    Prendas, variantes, talles y cantidades
                  </p>
                </div>

                <span className={[
                  styles.badge,
                  styles.blue,
                ].join(" ")}>
                  {itemCount} unidades
                </span>
              </div>

              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>SKU</th>
                      <th>Color</th>
                      <th>Talle</th>
                      <th>Cantidad</th>
                      <th>Verificado</th>
                      <th>Precio</th>
                      <th>Subtotal</th>
                    </tr>
                  </thead>

                  <tbody>
                    {order.items.map(
                      (
                        item,
                      ) => (
                        <tr key={item.id}>
                          <td>
                            <div className={styles.primary}>
                              {item.product_name_snapshot
                                ?? "Producto"}
                            </div>
                          </td>

                          <td>
                            {item.sku_snapshot}
                          </td>

                          <td>
                            {item.color_name_snapshot
                              ?? "-"}
                          </td>

                          <td>
                            {item.size_snapshot
                              ?? "-"}
                          </td>

                          <td>
                            {item.quantity}
                          </td>

                          <td>
                            {item.picked_quantity
                              ?? 0} / {item.quantity}
                          </td>

                          <td>
                            {money(
                              item.unit_price,
                              order.currency,
                            )}
                          </td>

                          <td>
                            <strong className={styles.money}>
                              {money(
                                item.subtotal,
                                order.currency,
                              )}
                            </strong>
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <h2 className={styles.panelTitle}>
                    Pagos registrados
                  </h2>

                  <p className={styles.panelSubtitle}>
                    Historial de pagos y comprobantes
                  </p>
                </div>

                <StatusBadge
                  value={order.payment_status}
                />
              </div>

              {order.payments.length === 0 ? (
                <div className={styles.empty}>
                  Todavía no se registraron pagos para este pedido.
                </div>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Método</th>
                        <th>Referencia</th>
                        <th>Estado</th>
                        <th>Importe</th>
                      </tr>
                    </thead>

                    <tbody>
                      {order.payments.map(
                        (
                          payment,
                        ) => (
                          <tr key={payment.id}>
                            <td>
                              {dateTime(payment.created_at)}
                            </td>

                            <td>
                              {payment.method}
                            </td>

                            <td>
                              {payment.reference
                                ?? "-"}
                            </td>

                            <td>
                              <StatusBadge
                                value={payment.status}
                              />
                            </td>

                            <td>
                              <strong className={styles.money}>
                                {money(
                                  payment.amount,
                                  order.currency,
                                )}
                              </strong>
                            </td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <h2 className={styles.panelTitle}>
                    Historial del pedido
                  </h2>

                  <p className={styles.panelSubtitle}>
                    Actividad, cambios y acciones realizadas
                  </p>
                </div>

                <span className={[
                  styles.badge,
                  styles.gray,
                ].join(" ")}>
                  {order.events.length} eventos
                </span>
              </div>

              {order.events.length === 0 ? (
                <div className={styles.empty}>
                  No hay eventos registrados.
                </div>
              ) : (
                <div className={styles.timeline}>
                  {order.events.map(
                    (
                      event,
                    ) => (
                      <article
                        className={styles.event}
                        key={event.id}
                      >
                        <div className={styles.eventHeader}>
                          <strong className={styles.eventTitle}>
                            {event.title}
                          </strong>

                          <span className={styles.eventDate}>
                            {dateTime(event.created_at)}
                          </span>
                        </div>

                        {event.description ? (
                          <p className={styles.eventDescription}>
                            {event.description}
                          </p>
                        ) : null}

                        <div className={styles.eventActor}>
                          {event.actor_name
                            ? `${event.actor_name} · ${event.actor_role ?? "usuario"}`
                            : "Sistema"}
                        </div>
                      </article>
                    ),
                  )}
                </div>
              )}
            </section>
          </main>

          <aside className={styles.sideColumn}>
            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <h2 className={styles.panelTitle}>
                    Cliente
                  </h2>

                  <p className={styles.panelSubtitle}>
                    Información asociada al pedido
                  </p>
                </div>
              </div>

              <div className={styles.infoList}>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>
                    Nombre
                  </span>

                  <span className={styles.infoValue}>
                    {order.customer?.name
                      ?? customerName}
                  </span>
                </div>

                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>
                    Negocio
                  </span>

                  <span className={styles.infoValue}>
                    {order.customer?.business_name
                      ?? "-"}
                  </span>
                </div>

                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>
                    WhatsApp
                  </span>

                  <span className={styles.infoValue}>
                    {order.customer?.whatsapp
                      ?? "-"}
                  </span>
                </div>

                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>
                    Email
                  </span>

                  <span className={styles.infoValue}>
                    {order.customer?.email
                      ?? "-"}
                  </span>
                </div>

                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>
                    Ciudad
                  </span>

                  <span className={styles.infoValue}>
                    {order.customer?.city
                      ?? "-"}
                  </span>
                </div>

                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>
                    Dirección
                  </span>

                  <span className={styles.infoValue}>
                    {order.shipping_address
                      ?? order.customer?.address
                      ?? "-"}
                  </span>
                </div>
              </div>
            </section>

            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <h2 className={styles.panelTitle}>
                    Estado operativo
                  </h2>

                  <p className={styles.panelSubtitle}>
                    Situación actual del pedido
                  </p>
                </div>
              </div>

              <div className={styles.infoList}>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>
                    Pedido
                  </span>

                  <StatusBadge
                    value={order.commercial_status}
                  />
                </div>

                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>
                    Pago
                  </span>

                  <StatusBadge
                    value={order.payment_status}
                  />
                </div>

                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>
                    Preparación
                  </span>

                  <StatusBadge
                    value={order.fulfillment_status}
                  />
                </div>

                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>
                    Reserva
                  </span>

                  <StatusBadge
                    value={order.reservation_status}
                  />
                </div>

                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>
                    Creado
                  </span>

                  <span className={styles.infoValue}>
                    {dateTime(order.created_at)}
                  </span>
                </div>

                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>
                    Actualizado
                  </span>

                  <span className={styles.infoValue}>
                    {dateTime(order.updated_at)}
                  </span>
                </div>
              </div>
            </section>

            {order.shipment ? (
              <section className={styles.panel}>
                <div className={styles.panelHeader}>
                  <div>
                    <h2 className={styles.panelTitle}>
                      Envío
                    </h2>

                    <p className={styles.panelSubtitle}>
                      Información del transporte
                    </p>
                  </div>
                </div>

                <div className={styles.infoList}>
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>
                      Transporte
                    </span>

                    <span className={styles.infoValue}>
                      {order.shipment.carrier
                        ?? "-"}
                    </span>
                  </div>

                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>
                      Seguimiento
                    </span>

                    <span className={styles.infoValue}>
                      {order.shipment.tracking_number
                        ?? "-"}
                    </span>
                  </div>

                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>
                      Estado
                    </span>

                    <StatusBadge
                      value={order.shipment.status}
                    />
                  </div>

                  {order.shipment.tracking_url ? (
                    <a
                      className={styles.button}
                      href={order.shipment.tracking_url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Abrir seguimiento
                    </a>
                  ) : null}
                </div>
              </section>
            ) : null}

            <OrderActions
              orderId={order.id}
              total={total}
              paidAmount={paidAmount}
              paymentStatus={order.payment_status}
              commercialStatus={order.commercial_status}
              fulfillmentStatus={order.fulfillment_status}
              reservationStatus={order.reservation_status}
              items={order.items.map(
                (
                  item,
                ) => ({
                  id:
                    item.id,

                  quantity:
                    numberValue(
                      item.quantity,
                    ),

                  picked_quantity:
                    numberValue(
                      item.picked_quantity,
                    ),
                }),
              )}
            />
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
