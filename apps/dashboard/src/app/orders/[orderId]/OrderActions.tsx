"use client";

import {
  FormEvent,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import styles from "./order-detail.module.css";

const apiUrl = (
  process.env.NEXT_PUBLIC_API_URL
  || "https://panel.fulanitasfabrica.site/api"
).replace(/\/+$/, "");

type Item = {
  id: string;
  quantity: number;
  picked_quantity?: number;
};

type Props = {
  orderId: string;
  total: number;
  paidAmount: number;
  paymentStatus: string;
  commercialStatus: string;
  fulfillmentStatus: string;
  reservationStatus: string;
  items: Item[];
};

export function OrderActions({
  orderId,
  total,
  paidAmount,
  paymentStatus,
  commercialStatus,
  fulfillmentStatus,
  reservationStatus,
  items,
}: Props) {
  const router = useRouter();

  const [loading, setLoading] =
    useState<string | null>(null);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const remaining =
    Math.max(total - paidAmount, 0);

  const [amount, setAmount] =
    useState(String(remaining));

  const [method, setMethod] =
    useState("Mercado Pago");

  const [reference, setReference] =
    useState("");

  async function request(
    pathname: string,
    body: Record<string, unknown>,
    label: string,
  ) {
    setLoading(label);
    setError("");
    setSuccess("");

    try {
      const response =
        await fetch(
          `${apiUrl}${pathname}`,
          {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify(body),
          },
        );

      const result =
        await response
          .json()
          .catch(() => null);

      if (!response.ok) {
        throw new Error(
          result?.message
          || result?.error
          || `Error ${response.status}`,
        );
      }

      setSuccess(
        `${label} completado correctamente.`,
      );

      router.refresh();

      return result;
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo completar la operación.",
      );

      throw requestError;
    } finally {
      setLoading(null);
    }
  }

  async function transition(
    action: string,
    payload:
      Record<string, unknown> = {},
    label = action,
  ) {
    return request(
      `/orders/${orderId}/fulfillment`,
      {
        action,
        payload,
      },
      label,
    );
  }

  async function registerPayment(
    event: FormEvent,
  ) {
    event.preventDefault();

    await request(
      `/orders/${orderId}/payments`,
      {
        amount: Number(amount),
        method,
        reference:
          reference.trim() || null,
      },
      "Pago",
    );
  }

  async function verifyAllItems() {
    setLoading("Verificación");
    setError("");
    setSuccess("");

    try {
      for (const item of items) {
        const missing =
          item.quantity
          - Number(
            item.picked_quantity ?? 0,
          );

        if (missing <= 0) {
          continue;
        }

        const response =
          await fetch(
            `${apiUrl}/orders/${orderId}/fulfillment`,
            {
              method: "POST",
              credentials: "include",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                action: "scan_item",
                payload: {
                  order_item_id:
                    item.id,
                  quantity:
                    missing,
                },
              }),
            },
          );

        const result =
          await response
            .json()
            .catch(() => null);

        if (!response.ok) {
          throw new Error(
            result?.message
            || result?.error
            || "No se pudo verificar el pedido.",
          );
        }
      }

      setSuccess(
        "Todas las unidades fueron verificadas.",
      );

      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo verificar el pedido.",
      );
    } finally {
      setLoading(null);
    }
  }

  const cancelled =
    commercialStatus === "cancelled"
    || fulfillmentStatus === "cancelled";

  return (
    <>
      {error ? (
        <div className={styles.alertError}>
          {error}
        </div>
      ) : null}

      {success ? (
        <div className={styles.alertSuccess}>
          {success}
        </div>
      ) : null}

      {!cancelled
      && paymentStatus !== "paid"
      && remaining > 0 ? (
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h3 className={styles.panelTitle}>
                Registrar pago
              </h3>

              <p className={styles.panelSubtitle}>
                Confirmá pagos totales o parciales
              </p>
            </div>
          </div>

          <form
            className={styles.form}
            onSubmit={registerPayment}
          >
            <div className={styles.balance}>
              <span>Saldo pendiente</span>

              <strong>
                ${remaining.toLocaleString("es-AR")}
              </strong>
            </div>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>
                Importe
              </span>

              <input
                className={styles.input}
                required
                min="1"
                max={remaining}
                step="0.01"
                type="number"
                value={amount}
                onChange={
                  (event) =>
                    setAmount(
                      event.target.value,
                    )
                }
              />
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>
                Método
              </span>

              <select
                className={styles.select}
                value={method}
                onChange={
                  (event) =>
                    setMethod(
                      event.target.value,
                    )
                }
              >
                <option>
                  Mercado Pago
                </option>

                <option>
                  Transferencia
                </option>

                <option>
                  Efectivo
                </option>

                <option>
                  Tarjeta
                </option>

                <option>
                  Otro
                </option>
              </select>
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>
                Referencia o comprobante
              </span>

              <input
                className={styles.input}
                type="text"
                value={reference}
                placeholder="Opcional"
                onChange={
                  (event) =>
                    setReference(
                      event.target.value,
                    )
                }
              />
            </label>

            <button
              className={styles.button}
              disabled={loading !== null}
              type="submit"
            >
              {loading === "Pago"
                ? "Registrando..."
                : "Registrar pago"}
            </button>
          </form>
        </section>
      ) : null}

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h3 className={styles.panelTitle}>
              Operación del pedido
            </h3>

            <p className={styles.panelSubtitle}>
              Estado actual: {fulfillmentStatus}
            </p>
          </div>
        </div>

        <div className={styles.actions}>
          {paymentStatus === "paid"
          && (
            fulfillmentStatus === "pending"
            || fulfillmentStatus === "incident"
          ) ? (
            <button
              className={styles.button}
              disabled={loading !== null}
              type="button"
              onClick={
                () =>
                  void transition(
                    "start_picking",
                    {},
                    "Preparación iniciada",
                  )
              }
            >
              Iniciar preparación
            </button>
          ) : null}

          {fulfillmentStatus === "picking" ? (
            <>
              <button
                className={[
                  styles.button,
                  styles.buttonSecondary,
                ].join(" ")}
                disabled={loading !== null}
                type="button"
                onClick={
                  () =>
                    void verifyAllItems()
                }
              >
                Verificar todas las unidades
              </button>

              <button
                className={styles.button}
                disabled={loading !== null}
                type="button"
                onClick={
                  () =>
                    void transition(
                      "complete_picking",
                      {},
                      "Alistamiento completado",
                    )
                }
              >
                Completar alistamiento
              </button>
            </>
          ) : null}

          {fulfillmentStatus === "picked" ? (
            <button
              className={styles.button}
              disabled={loading !== null}
              type="button"
              onClick={
                () =>
                  void transition(
                    "complete_packing",
                    {
                      package_count: 1,
                    },
                    "Pedido empacado",
                  )
              }
            >
              Empacar pedido
            </button>
          ) : null}

          {fulfillmentStatus === "packed" ? (
            <button
              className={styles.button}
              disabled={loading !== null}
              type="button"
              onClick={
                () =>
                  void transition(
                    "ready_to_dispatch",
                    {},
                    "Pedido listo para despacho",
                  )
              }
            >
              Marcar listo para despacho
            </button>
          ) : null}

          {fulfillmentStatus === "handed_to_carrier" ? (
            <button
              className={styles.button}
              disabled={loading !== null}
              type="button"
              onClick={
                () => {
                  const tracking =
                    window.prompt(
                      "Número de seguimiento",
                    );

                  if (tracking) {
                    void transition(
                      "mark_shipped",
                      {
                        tracking_number:
                          tracking,
                      },
                      "Pedido enviado",
                    );
                  }
                }
              }
            >
              Marcar enviado
            </button>
          ) : null}

          {fulfillmentStatus === "shipped" ? (
            <button
              className={styles.button}
              disabled={loading !== null}
              type="button"
              onClick={
                () =>
                  void transition(
                    "deliver",
                    {},
                    "Pedido entregado",
                  )
              }
            >
              Marcar entregado
            </button>
          ) : null}

          {!cancelled
          && fulfillmentStatus !== "delivered"
          && fulfillmentStatus !== "shipped"
          && paymentStatus === "unpaid"
          && reservationStatus !== "consumed" ? (
            <button
              className={[
                styles.button,
                styles.buttonDanger,
              ].join(" ")}
              disabled={loading !== null}
              type="button"
              onClick={
                () => {
                  const confirmed =
                    window.confirm(
                      "¿Cancelar el pedido y liberar el stock reservado?",
                    );

                  if (confirmed) {
                    void transition(
                      "cancel",
                      {
                        note:
                          "Cancelado desde el panel.",
                      },
                      "Pedido cancelado",
                    );
                  }
                }
              }
            >
              Cancelar y liberar stock
            </button>
          ) : null}

          {!cancelled
          && paymentStatus !== "paid"
          && fulfillmentStatus === "pending" ? (
            <div className={styles.empty}>
              El pedido debe estar pagado para iniciar la preparación.
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}
