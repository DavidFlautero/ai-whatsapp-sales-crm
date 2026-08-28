"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import styles from "./payments.module.css";


type PaymentSubmissionStatus =
  | "pending_review"
  | "confirmed"
  | "rejected";


type PaymentSubmission = {
  id: string;

  customer_id?:
    string
    | null;

  order_id?:
    string
    | null;

  message_id?:
    string
    | null;

  customer_phone?:
    string
    | null;

  media_type?:
    string
    | null;

  media_mime_type?:
    string
    | null;

  declared_amount?:
    number
    | string
    | null;

  detected_amount?:
    number
    | string
    | null;

  status:
    PaymentSubmissionStatus;

  rejection_reason?:
    string
    | null;

  reviewed_at?:
    string
    | null;

  created_at:
    string;

  customer?: {
    id: string;

    name?:
      string
      | null;

    business_name?:
      string
      | null;

    whatsapp?:
      string
      | null;
  } | null;

  order?: {
    id: string;

    number?:
      string
      | null;

    total?:
      number
      | string
      | null;

    paid_amount?:
      number
      | string
      | null;

    payment_status?:
      string
      | null;

    currency?:
      string
      | null;

    items?: Array<{
      id: string;
      quantity: number;
      unit_price: number;
      final_unit_price: number;
      subtotal: number;

      product?: {
        id: string;
        name?: string | null;
      } | null;

      variant?: {
        id: string;
        sku?: string | null;
        color_name?: string | null;
        size?: string | null;
      } | null;
    }>;
  } | null;
};


type PaymentTab =
  | "pending_review"
  | "confirmed"
  | "rejected";


const apiUrl = (
  process.env.NEXT_PUBLIC_API_URL
  || "https://panel.fulanitasfabrica.site/api"
).replace(
  /\/+$/,
  "",
);


function numberValue(
  value:
    | number
    | string
    | null
    | undefined,
) {
  const result =
    Number(
      value
      ?? 0,
    );

  return Number.isFinite(
    result,
  )
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
    numberValue(
      value,
    ),
  );
}


function dateTime(
  value?:
    string
    | null,
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
    new Date(
      value,
    ),
  );
}


export default function PaymentSubmissionsClient() {
  const router =
    useRouter();

  const [
    paymentTab,
    setPaymentTab,
  ] =
    useState<PaymentTab>(
      "pending_review",
    );

  const [
    submissions,
    setSubmissions,
  ] =
    useState<
      PaymentSubmission[]
    >(
      [],
    );

  const [
    loading,
    setLoading,
  ] =
    useState(
      false,
    );

  const [
    error,
    setError,
  ] =
    useState(
      "",
    );

  const [
    action,
    setAction,
  ] =
    useState<
      string
      | null
    >(
      null,
    );

  const [
    preview,
    setPreview,
  ] =
    useState<
      PaymentSubmission
      | null
    >(
      null,
    );


  async function load(
    status:
      PaymentTab = paymentTab,
  ) {
    setLoading(
      true,
    );

    setError(
      "",
    );

    try {
      const response =
        await fetch(
          `${apiUrl}/admin/payment-submissions?status=${encodeURIComponent(status)}`,
          {
            credentials:
              "include",

            cache:
              "no-store",
          },
        );

      const payload =
        await response
          .json();

      if (!response.ok) {
        throw new Error(
          payload?.error
          ?? "No se pudieron cargar los comprobantes.",
        );
      }

      setSubmissions(
        Array.isArray(
          payload
            ?.submissions,
        )
          ? payload
              .submissions
          : [],
      );
    } catch (
      currentError
    ) {
      setError(
        currentError
        instanceof Error
          ? currentError
              .message
          : "Error cargando comprobantes.",
      );
    } finally {
      setLoading(
        false,
      );
    }
  }


  useEffect(
    () => {
      void load(
        paymentTab,
      );
    },
    [
      paymentTab,
    ],
  );


  useEffect(
    () => {
      if (!preview) {
        return;
      }

      function escape(
        event:
          KeyboardEvent,
      ) {
        if (
          event.key
          === "Escape"
        ) {
          setPreview(
            null,
          );
        }
      }

      window
        .addEventListener(
          "keydown",
          escape,
        );

      return () => {
        window
          .removeEventListener(
            "keydown",
            escape,
          );
      };
    },
    [
      preview,
    ],
  );


  async function approve(
    submission:
      PaymentSubmission,
  ) {
    const remaining =
      Math.max(
        numberValue(
          submission
            .order
            ?.total,
        )
        - numberValue(
            submission
              .order
              ?.paid_amount,
          ),
        0,
      );

    const amount =
      numberValue(
        submission
          .declared_amount
        ?? submission
          .detected_amount
        ?? remaining,
      );

    if (
      amount
      <= 0
    ) {
      setError(
        "No se pudo determinar el importe a confirmar.",
      );

      return;
    }

    setAction(
      submission.id,
    );

    setError(
      "",
    );

    try {
      const response =
        await fetch(
          `${apiUrl}/admin/payment-submissions/${encodeURIComponent(submission.id)}/approve`,
          {
            method:
              "POST",

            credentials:
              "include",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                amount,
              }),
          },
        );

      const payload =
        await response
          .json();

      if (!response.ok) {
        throw new Error(
          payload?.error
          ?? "No se pudo aprobar el comprobante.",
        );
      }

      setPreview(
        null,
      );

      await load(
        paymentTab,
      );

      router
        .refresh();
    } catch (
      currentError
    ) {
      setError(
        currentError
        instanceof Error
          ? currentError
              .message
          : "Error aprobando comprobante.",
      );
    } finally {
      setAction(
        null,
      );
    }
  }


  async function reject(
    submission:
      PaymentSubmission,
  ) {
    const reason =
      window.prompt(
        "Motivo del rechazo:",
        "Transferencia no encontrada",
      );

    if (
      !reason
      || !reason
        .trim()
    ) {
      return;
    }

    setAction(
      submission.id,
    );

    setError(
      "",
    );

    try {
      const response =
        await fetch(
          `${apiUrl}/admin/payment-submissions/${encodeURIComponent(submission.id)}/reject`,
          {
            method:
              "POST",

            credentials:
              "include",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                reason:
                  reason
                    .trim(),
              }),
          },
        );

      const payload =
        await response
          .json();

      if (!response.ok) {
        throw new Error(
          payload?.error
          ?? "No se pudo rechazar el comprobante.",
        );
      }

      setPreview(
        null,
      );

      await load(
        paymentTab,
      );

      router
        .refresh();
    } catch (
      currentError
    ) {
      setError(
        currentError
        instanceof Error
          ? currentError
              .message
          : "Error rechazando comprobante.",
      );
    } finally {
      setAction(
        null,
      );
    }
  }


  return (
    <>
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
          <div
            className={
              styles.tabs
            }
          >
            {[
              [
                "pending_review",
                "Pendientes",
              ],
              [
                "confirmed",
                "Confirmados",
              ],
              [
                "rejected",
                "Rechazados",
              ],
            ].map(
              (
                [
                  status,
                  label,
                ],
              ) => (
                <button
                  key={
                    status
                  }
                  type="button"
                  className={[
                    styles.tab,
                    paymentTab
                    === status
                      ? styles.tabActive
                      : "",
                  ].join(
                    " ",
                  )}
                  onClick={
                    () =>
                      setPaymentTab(
                        status as PaymentTab,
                      )
                  }
                >
                  {
                    label
                  }
                </button>
              ),
            )}
          </div>

          <button
            type="button"
            className={
              styles.refreshButton
            }
            onClick={
              () =>
                void load(
                  paymentTab,
                )
            }
          >
            Actualizar
          </button>
        </div>

        {
          error
            ? (
              <div
                className={
                  styles.error
                }
              >
                {
                  error
                }
              </div>
            )
            : null
        }

        {
          loading
            ? (
              <div
                className={
                  styles.empty
                }
              >
                Cargando comprobantes...
              </div>
            )
            : submissions
                .length
              === 0
              ? (
                <div
                  className={
                    styles.empty
                  }
                >
                  No hay comprobantes en este estado.
                </div>
              )
              : (
                <div
                  className={
                    styles.grid
                  }
                >
                  {
                    submissions
                      .map(
                        (
                          submission,
                        ) => {
                          const customerName =
                            submission
                              .customer
                              ?.business_name
                            || submission
                              .customer
                              ?.name
                            || "Cliente WhatsApp";

                          const total =
                            numberValue(
                              submission
                                .order
                                ?.total,
                            );

                          const paid =
                            numberValue(
                              submission
                                .order
                                ?.paid_amount,
                            );

                          const remaining =
                            Math.max(
                              total
                              - paid,
                              0,
                            );

                          const amount =
                            numberValue(
                              submission
                                .declared_amount
                              ?? submission
                                .detected_amount
                              ?? remaining,
                            );

                          const mediaUrl =
                            submission
                              .message_id
                              ? `/dashboard-api/messages/${encodeURIComponent(submission.message_id)}/media`
                              : null;

                          const pdf =
                            submission
                              .media_type
                            === "document"
                            || submission
                              .media_mime_type
                            === "application/pdf";

                          return (
                            <article
                              key={
                                submission.id
                              }
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
                                  <strong
                                    className={
                                      styles.orderNumber
                                    }
                                  >
                                    {
                                      submission
                                        .order
                                        ?.number
                                      ?? "Pedido sin vincular"
                                    }
                                  </strong>

                                  <div
                                    className={
                                      styles.customer
                                    }
                                  >
                                    {
                                      customerName
                                    }

                                    <span>
                                      {
                                        submission
                                          .customer_phone
                                        ?? submission
                                          .customer
                                          ?.whatsapp
                                        ?? "Sin teléfono"
                                      }
                                    </span>
                                  </div>
                                </div>

                                <span
                                  className={[
                                    styles.status,
                                    submission
                                      .status
                                    === "confirmed"
                                      ? styles.confirmed
                                      : submission
                                          .status
                                        === "rejected"
                                        ? styles.rejected
                                        : styles.pending,
                                  ].join(
                                    " ",
                                  )}
                                >
                                  {
                                    submission
                                      .status
                                    === "confirmed"
                                      ? "Confirmado"
                                      : submission
                                          .status
                                        === "rejected"
                                        ? "Rechazado"
                                        : "Pendiente"
                                  }
                                </span>
                              </div>

                              <div
                                className={
                                  styles.orderSummary
                                }
                              >
                                <div
                                  className={
                                    styles.orderSummaryHeader
                                  }
                                >
                                  <div>
                                    <span
                                      className={
                                        styles.sectionEyebrow
                                      }
                                    >
                                      Detalle del pedido
                                    </span>

                                    <strong>
                                      {
                                        submission
                                          .order
                                          ?.number
                                        ?? "Pedido"
                                      }
                                    </strong>
                                  </div>

                                  {
                                    submission
                                      .order_id
                                      ? (
                                        <a
                                          href={
                                            `/orders/${encodeURIComponent(submission.order_id)}`
                                          }
                                          className={
                                            styles.orderLink
                                          }
                                        >
                                          Ver pedido completo →
                                        </a>
                                      )
                                      : null
                                  }
                                </div>

                                <div
                                  className={
                                    styles.orderItems
                                  }
                                >
                                  {
                                    submission
                                      .order
                                      ?.items
                                      ?.length
                                      ? submission
                                          .order
                                          .items
                                          .map(
                                            (
                                              item,
                                            ) => {
                                              const name =
                                                item
                                                  .product
                                                  ?.name
                                                ?? item
                                                  .variant
                                                  ?.sku
                                                ?? "Producto";

                                              const variant =
                                                [
                                                  item
                                                    .variant
                                                    ?.color_name,
                                                  item
                                                    .variant
                                                    ?.size
                                                    ? `talle ${item.variant.size}`
                                                    : null,
                                                ]
                                                  .filter(
                                                    Boolean,
                                                  )
                                                  .join(
                                                    " · ",
                                                  );

                                              return (
                                                <div
                                                  key={
                                                    item.id
                                                  }
                                                  className={
                                                    styles.orderItem
                                                  }
                                                >
                                                  <div
                                                    className={
                                                      styles.orderItemMain
                                                    }
                                                  >
                                                    <strong>
                                                      {
                                                        item.quantity
                                                      }
                                                      {" × "}
                                                      {
                                                        name
                                                      }
                                                    </strong>

                                                    {
                                                      variant
                                                        ? (
                                                          <span>
                                                            {
                                                              variant
                                                            }
                                                          </span>
                                                        )
                                                        : null
                                                    }
                                                  </div>

                                                  <div
                                                    className={
                                                      styles.orderItemPrice
                                                    }
                                                  >
                                                    <span>
                                                      {
                                                        money(
                                                          item.final_unit_price,
                                                          submission
                                                            .order
                                                            ?.currency
                                                          ?? "ARS",
                                                        )
                                                      }
                                                      {" c/u"}
                                                    </span>

                                                    <strong>
                                                      {
                                                        money(
                                                          item.subtotal,
                                                          submission
                                                            .order
                                                            ?.currency
                                                          ?? "ARS",
                                                        )
                                                      }
                                                    </strong>
                                                  </div>
                                                </div>
                                              );
                                            },
                                          )
                                      : (
                                        <div
                                          className={
                                            styles.noOrderItems
                                          }
                                        >
                                          Sin detalle de productos disponible.
                                        </div>
                                      )
                                  }
                                </div>

                                <div
                                  className={
                                    styles.orderTotal
                                  }
                                >
                                  <span>
                                    Total del pedido
                                  </span>

                                  <strong>
                                    {
                                      money(
                                        total,
                                        submission
                                          .order
                                          ?.currency
                                        ?? "ARS",
                                      )
                                    }
                                  </strong>
                                </div>
                              </div>

                              <div
                                className={
                                  styles.mediaLabel
                                }
                              >
                                <span
                                  className={
                                    styles.sectionEyebrow
                                  }
                                >
                                  Comprobante recibido
                                </span>

                                <span>
                                  Click en la imagen para ampliarla
                                </span>
                              </div>

                              <div
                                className={
                                  styles.mediaBox
                                }
                              >
                                {
                                  mediaUrl
                                    ? (
                                      pdf
                                        ? (
                                          <div
                                            className={
                                              styles.pdfBox
                                            }
                                          >
                                            <div
                                              className={
                                                styles.pdfIcon
                                              }
                                            >
                                              PDF
                                            </div>

                                            <strong>
                                              Comprobante PDF
                                            </strong>

                                            <a
                                              href={
                                                mediaUrl
                                              }
                                              target="_blank"
                                              rel="noreferrer"
                                              className={
                                                styles.mediaButton
                                              }
                                            >
                                              Abrir documento
                                            </a>

                                            <a
                                              href={
                                                mediaUrl
                                              }
                                              download
                                              className={
                                                styles.downloadButton
                                              }
                                            >
                                              Descargar
                                            </a>
                                          </div>
                                        )
                                        : (
                                          <>
                                            <button
                                              type="button"
                                              className={
                                                styles.imageButton
                                              }
                                              onClick={
                                                () =>
                                                  setPreview(
                                                    submission,
                                                  )
                                              }
                                              title="Ampliar comprobante"
                                            >
                                              <img
                                                src={
                                                  mediaUrl
                                                }
                                                alt={
                                                  `Comprobante ${submission.order?.number ?? ""}`
                                                }
                                                className={
                                                  styles.image
                                                }
                                              />

                                              <span
                                                className={
                                                  styles.zoomHint
                                                }
                                              >
                                                🔍 Click para ampliar
                                              </span>
                                            </button>

                                            <a
                                              href={
                                                mediaUrl
                                              }
                                              download
                                              className={
                                                styles.downloadInline
                                              }
                                            >
                                              Descargar comprobante
                                            </a>
                                          </>
                                        )
                                    )
                                    : (
                                      <div
                                        className={
                                          styles.noMedia
                                        }
                                      >
                                        Sin archivo disponible
                                      </div>
                                    )
                                }
                              </div>

                              <div
                                className={
                                  styles.details
                                }
                              >
                                <div>
                                  <span>
                                    Importe
                                  </span>

                                  <strong>
                                    {
                                      money(
                                        amount,
                                        submission
                                          .order
                                          ?.currency
                                        ?? "ARS",
                                      )
                                    }
                                  </strong>
                                </div>

                                <div>
                                  <span>
                                    Recibido
                                  </span>

                                  <strong>
                                    {
                                      dateTime(
                                        submission
                                          .created_at,
                                      )
                                    }
                                  </strong>
                                </div>

                                {
                                  submission
                                    .reviewed_at
                                    ? (
                                      <div>
                                        <span>
                                          Revisado
                                        </span>

                                        <strong>
                                          {
                                            dateTime(
                                              submission
                                                .reviewed_at,
                                            )
                                          }
                                        </strong>
                                      </div>
                                    )
                                    : null
                                }
                              </div>

                              {
                                submission
                                  .rejection_reason
                                  ? (
                                    <div
                                      className={
                                        styles.reason
                                      }
                                    >
                                      <strong>
                                        Motivo del rechazo
                                      </strong>

                                      <span>
                                        {
                                          submission
                                            .rejection_reason
                                        }
                                      </span>
                                    </div>
                                  )
                                  : null
                              }

                              {
                                submission
                                  .status
                                === "pending_review"
                                  ? (
                                    <div
                                      className={
                                        styles.actions
                                      }
                                    >
                                      <button
                                        type="button"
                                        className={
                                          styles.approve
                                        }
                                        disabled={
                                          action
                                          === submission.id
                                        }
                                        onClick={
                                          () =>
                                            void approve(
                                              submission,
                                            )
                                        }
                                      >
                                        ✓ Aprobar pago
                                      </button>

                                      <button
                                        type="button"
                                        className={
                                          styles.reject
                                        }
                                        disabled={
                                          action
                                          === submission.id
                                        }
                                        onClick={
                                          () =>
                                            void reject(
                                              submission,
                                            )
                                        }
                                      >
                                        ✕ Rechazar
                                      </button>
                                    </div>
                                  )
                                  : null
                              }
                            </article>
                          );
                        },
                      )
                  }
                </div>
              )
        }
      </section>

      {
        preview
        && preview
          .message_id
          ? (
            <div
              className={
                styles.modalBackdrop
              }
              role="presentation"
              onClick={
                () =>
                  setPreview(
                    null,
                  )
              }
            >
              <div
                className={
                  styles.modal
                }
                role="dialog"
                aria-modal="true"
                aria-label="Comprobante ampliado"
                onClick={
                  (
                    event,
                  ) =>
                    event
                      .stopPropagation()
                }
              >
                <div
                  className={
                    styles.modalHeader
                  }
                >
                  <div>
                    <strong>
                      {
                        preview
                          .order
                          ?.number
                        ?? "Comprobante"
                      }
                    </strong>

                    <span>
                      {
                        preview
                          .customer
                          ?.business_name
                        || preview
                          .customer
                          ?.name
                        || "Cliente"
                      }
                    </span>
                  </div>

                  <button
                    type="button"
                    className={
                      styles.closeButton
                    }
                    onClick={
                      () =>
                        setPreview(
                          null,
                        )
                    }
                  >
                    ×
                  </button>
                </div>

                <div
                  className={
                    styles.modalMedia
                  }
                >
                  <img
                    src={
                      `/dashboard-api/messages/${encodeURIComponent(preview.message_id)}/media`
                    }
                    alt="Comprobante ampliado"
                  />
                </div>

                <div
                  className={
                    styles.modalFooter
                  }
                >
                  <a
                    href={
                      `/dashboard-api/messages/${encodeURIComponent(preview.message_id)}/media`
                    }
                    download
                    className={
                      styles.downloadButton
                    }
                  >
                    ↓ Descargar archivo
                  </a>

                  {
                    preview
                      .status
                    === "pending_review"
                      ? (
                        <>
                          <button
                            type="button"
                            className={
                              styles.approve
                            }
                            disabled={
                              action
                              === preview.id
                            }
                            onClick={
                              () =>
                                void approve(
                                  preview,
                                )
                            }
                          >
                            ✓ Aprobar pago
                          </button>

                          <button
                            type="button"
                            className={
                              styles.reject
                            }
                            disabled={
                              action
                              === preview.id
                            }
                            onClick={
                              () =>
                                void reject(
                                  preview,
                                )
                            }
                          >
                            ✕ Rechazar
                          </button>
                        </>
                      )
                      : null
                  }
                </div>
              </div>
            </div>
          )
          : null
      }
    </>
  );
}
