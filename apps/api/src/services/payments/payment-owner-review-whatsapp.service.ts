import {
  createHash,
} from "node:crypto";

import {
  getConversationByPhone,
  updateConversationMetadata,
} from "../conversations/conversation.repository.js";

import {
  supabaseRequest,
} from "../db/supabase-rest.client.js";

import {
  approvePaymentSubmission,
  rejectPaymentSubmission,
} from "./payment-submission-admin.service.js";


type OwnerRow = {
  owner_phone_hash: string;
};


type SubmissionRow = {
  id: string;
  order_id: string | null;
  customer_id: string | null;
  customer_phone: string | null;
  message_id: string | null;
  whatsapp_message_id: string | null;
  media_type: string | null;
  media_mime_type: string | null;
  declared_amount: number | null;
  status: string;
  metadata:
    Record<string, unknown>;
  created_at: string;
};


type OrderRow = {
  id: string;
  number: string;
  total: number;
  paid_amount: number;
  currency: string;
  payment_status: string;
  commercial_status: string;
  customer_id: string | null;
};


type CustomerRow = {
  id: string;
  name: string | null;
  business_name: string | null;
  whatsapp: string | null;
};


type ReviewWorkflow = {
  status:
    | "selecting_submission"
    | "awaiting_decision"
    | "awaiting_rejection_reason";

  submissionIds:
    string[];

  selectedSubmissionId?:
    string | null;

  createdAt:
    string;

  expiresAt:
    string;
};


export type OwnerPaymentReviewResult = {
  handled: boolean;

  text?: string;

  media?: Array<{
    messageId: string;
    whatsappMediaId: string | null;
    mediaType: string | null;
    mimeType: string | null;
  }>;

  notifyCustomer?: {
    phone: string;
    text: string;
  } | null;
};


function normalizePhone(
  value: string,
) {
  return value.replace(
    /\D/g,
    "",
  );
}


function normalize(
  value: string,
) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(
      /\p{Diacritic}/gu,
      "",
    )
    .replace(
      /\s+/g,
      " ",
    );
}


function phoneHash(
  companyId: string,
  phone: string,
) {
  return createHash(
    "sha256",
  )
    .update(
      `${companyId}:${normalizePhone(phone)}`,
      "utf8",
    )
    .digest(
      "hex",
    );
}


async function authenticateOwner(
  companyId: string,
  phone: string,
) {
  const rows =
    await supabaseRequest<
      OwnerRow[]
    >({
      table:
        "commerce_payment_owner_settings",

      query:
        `?company_id=eq.${encodeURIComponent(companyId)}`
        + "&select=owner_phone_hash"
        + "&limit=1",
    });

  const configured =
    rows[0]
      ?.owner_phone_hash;

  if (!configured) {
    return false;
  }

  return (
    phoneHash(
      companyId,
      phone,
    )
    === configured
  );
}


function isStartCommand(
  message: string,
) {
  return (
    /\bcomprobantes?\b.*\bpendientes?\b/
      .test(message)

    || /\bpagos?\b.*\bpendientes?\b/
      .test(message)

    || message
      === "ver comprobantes"

    || message
      === "comprobantes"
  );
}


function workflowFromMetadata(
  metadata?:
    Record<string, unknown>,
): ReviewWorkflow | null {
  const raw =
    metadata
      ?.payment_owner_review_workflow;

  if (
    !raw
    || typeof raw !== "object"
    || Array.isArray(raw)
  ) {
    return null;
  }

  const value =
    raw as Record<
      string,
      unknown
    >;

  const status =
    typeof value.status
    === "string"
      ? value.status
      : "";

  if (
    ![
      "selecting_submission",
      "awaiting_decision",
      "awaiting_rejection_reason",
    ].includes(status)
  ) {
    return null;
  }

  const submissionIds =
    Array.isArray(
      value.submissionIds,
    )
      ? value.submissionIds
          .filter(
            (
              item,
            ): item is string =>
              typeof item
              === "string",
          )
      : [];

  const expiresAt =
    typeof value.expiresAt
    === "string"
      ? value.expiresAt
      : "";

  if (
    !expiresAt
    || new Date(
      expiresAt,
    ).getTime()
      <= Date.now()
  ) {
    return null;
  }

  return {
    status:
      status as ReviewWorkflow["status"],

    submissionIds,

    selectedSubmissionId:
      typeof value.selectedSubmissionId
      === "string"
        ? value.selectedSubmissionId
        : null,

    createdAt:
      typeof value.createdAt
      === "string"
        ? value.createdAt
        : new Date()
            .toISOString(),

    expiresAt,
  };
}


async function saveWorkflow(
  phone: string,
  companyId: string,
  workflow:
    ReviewWorkflow
    | null,
) {
  await updateConversationMetadata(
    phone,
    {
      payment_owner_review_workflow:
        workflow,
    },
    companyId,
  );
}


async function pendingSubmissions(
  companyId: string,
) {
  return supabaseRequest<
    SubmissionRow[]
  >({
    table:
      "commerce_payment_submissions",

    query:
      `?company_id=eq.${encodeURIComponent(companyId)}`
      + "&status=eq.pending_review"
      + "&select=*"
      + "&order=created_at.desc"
      + "&limit=10",
  });
}


async function submissionById(
  companyId: string,
  submissionId: string,
) {
  const rows =
    await supabaseRequest<
      SubmissionRow[]
    >({
      table:
        "commerce_payment_submissions",

      query:
        `?company_id=eq.${encodeURIComponent(companyId)}`
        + `&id=eq.${encodeURIComponent(submissionId)}`
        + "&select=*"
        + "&limit=1",
    });

  return rows[0]
    ?? null;
}


async function pendingSubmissionsByOrder(
  companyId: string,
  orderId: string,
) {
  return supabaseRequest<
    SubmissionRow[]
  >({
    table:
      "commerce_payment_submissions",

    query:
      `?company_id=eq.${encodeURIComponent(companyId)}`
      + `&order_id=eq.${encodeURIComponent(orderId)}`
      + "&status=eq.pending_review"
      + "&select=*"
      + "&order=created_at.asc"
      + "&limit=10",
  });
}


async function orderById(
  companyId: string,
  orderId:
    string
    | null,
) {
  if (!orderId) {
    return null;
  }

  const rows =
    await supabaseRequest<
      OrderRow[]
    >({
      table:
        "commerce_orders",

      query:
        `?company_id=eq.${encodeURIComponent(companyId)}`
        + `&id=eq.${encodeURIComponent(orderId)}`
        + "&select=id,number,total,paid_amount,currency,payment_status,commercial_status,customer_id"
        + "&limit=1",
    });

  return rows[0]
    ?? null;
}


async function customerById(
  companyId: string,
  customerId:
    string
    | null,
) {
  if (!customerId) {
    return null;
  }

  const rows =
    await supabaseRequest<
      CustomerRow[]
    >({
      table:
        "commerce_customers",

      query:
        `?company_id=eq.${encodeURIComponent(companyId)}`
        + `&id=eq.${encodeURIComponent(customerId)}`
        + "&select=id,name,business_name,whatsapp"
        + "&limit=1",
    });

  return rows[0]
    ?? null;
}


function money(
  value: number,
  currency: string,
) {
  return new Intl
    .NumberFormat(
      "es-AR",
      {
        style:
          "currency",

        currency:
          currency
          || "ARS",

        maximumFractionDigits:
          2,
      },
    )
    .format(
      value,
    );
}


function customerName(
  customer:
    CustomerRow
    | null,
) {
  return (
    customer
      ?.business_name
      ?.trim()

    || customer
      ?.name
      ?.trim()

    || "Cliente"
  );
}


async function listReply(
  companyId: string,
  submissions:
    SubmissionRow[],
) {
  const lines = [
    `Tenés ${submissions.length} comprobante${submissions.length === 1 ? "" : "s"} pendiente${submissions.length === 1 ? "" : "s"}:`,
    "",
  ];

  for (
    const [
      index,
      submission,
    ]
    of submissions.entries()
  ) {
    const order =
      await orderById(
        companyId,
        submission.order_id,
      );

    const customer =
      await customerById(
        companyId,
        submission.customer_id
        ?? order?.customer_id
        ?? null,
      );

    const remaining =
      order
        ? Math.max(
            Number(
              order.total,
            )
            - Number(
              order.paid_amount,
            ),
            0,
          )
        : null;

    lines.push(
      `${index + 1}. `
      + (
        order?.number
        ?? "Pedido sin vincular"
      )
      + " — "
      + (
        remaining !== null
          ? money(
              remaining,
              order?.currency
              ?? "ARS",
            )
          : "importe sin resolver"
      )
      + " — "
      + customerName(
          customer,
        ),
    );
  }

  lines.push(
    "",
    "Decime el número que querés revisar.",
  );

  return lines.join(
    "\n",
  );
}


async function detailReply(
  companyId: string,
  submission:
    SubmissionRow,
) {
  const order =
    await orderById(
      companyId,
      submission.order_id,
    );

  const customer =
    await customerById(
      companyId,
      submission.customer_id
      ?? order?.customer_id
      ?? null,
    );

  const total =
    Number(
      order?.total
      ?? 0,
    );

  const paid =
    Number(
      order?.paid_amount
      ?? 0,
    );

  const remaining =
    Math.max(
      total
      - paid,
      0,
    );

  return {
    order,
    customer,

    text: [
      "Comprobante pendiente",
      "",
      `Pedido: ${order?.number ?? "Sin pedido vinculado"}`,
      `Cliente: ${customerName(customer)}`,
      `Teléfono: ${submission.customer_phone ?? customer?.whatsapp ?? "Sin teléfono"}`,
      `Total: ${money(total, order?.currency ?? "ARS")}`,
      `Pagado: ${money(paid, order?.currency ?? "ARS")}`,
      `Saldo a confirmar: ${money(remaining, order?.currency ?? "ARS")}`,
      "",
      "Te envío el comprobante.",
      "",
      "Respondé CONFIRMAR o RECHAZAR.",
    ].join(
      "\n",
    ),

    amount:
      remaining,
  };
}


const rejectionReasons:
  Record<string, string> = {
    "1":
      "Importe incorrecto",

    "2":
      "Comprobante ilegible",

    "3":
      "Transferencia no encontrada",

    "4":
      "Los datos de la transferencia no coinciden",
  };


async function reopenCustomerReceipt(
  companyId: string,
  customerPhone: string,
  order:
    OrderRow
    | null,
) {
  const conversation =
    await getConversationByPhone(
      customerPhone,
      companyId,
    );

  const oldWorkflow =
    conversation
      ?.metadata
      ?.payment_workflow;

  const old =
    (
      oldWorkflow
      && typeof oldWorkflow
        === "object"
      && !Array.isArray(
        oldWorkflow,
      )
    )
      ? oldWorkflow as Record<
          string,
          unknown
        >
      : {};

  const now =
    new Date();

  const expiresAt =
    new Date(
      now.getTime()
      + 24
        * 60
        * 60
        * 1000,
    );

  await updateConversationMetadata(
    customerPhone,
    {
      payment_workflow: {
        ...old,

        status:
          "awaiting_receipt",

        orderId:
          order?.id
          ?? old.orderId
          ?? null,

        orderNumber:
          order?.number
          ?? old.orderNumber
          ?? null,

        submissionId:
          null,

        createdAt:
          typeof old.createdAt
          === "string"
            ? old.createdAt
            : now.toISOString(),

        updatedAt:
          now.toISOString(),

        expiresAt:
          expiresAt
            .toISOString(),
      },
    },
    companyId,
  );
}


export async function handlePaymentOwnerReviewWhatsappCommand(
  input: {
    companyId: string;
    phone: string;
    message: string;
    messageId: string;
  },
): Promise<OwnerPaymentReviewResult> {
  const authenticated =
    await authenticateOwner(
      input.companyId,
      input.phone,
    );

  if (!authenticated) {
    return {
      handled:
        false,
    };
  }

  const normalized =
    normalize(
      input.message,
    );

  const conversation =
    await getConversationByPhone(
      input.phone,
      input.companyId,
    );

  let workflow =
    workflowFromMetadata(
      conversation?.metadata,
    );

  if (
    !workflow
    && !isStartCommand(
      normalized,
    )
  ) {
    return {
      handled:
        false,
    };
  }

  if (
    !workflow
    && isStartCommand(
      normalized,
    )
  ) {
    const submissions =
      await pendingSubmissions(
        input.companyId,
      );

    if (!submissions.length) {
      return {
        handled:
          true,

        text:
          "No tenés comprobantes pendientes de verificación.",
      };
    }

    const now =
      new Date();

    workflow = {
      status:
        "selecting_submission",

      submissionIds:
        submissions.map(
          (item) =>
            item.id,
        ),

      selectedSubmissionId:
        null,

      createdAt:
        now.toISOString(),

      expiresAt:
        new Date(
          now.getTime()
          + 15
            * 60
            * 1000,
        )
          .toISOString(),
    };

    await saveWorkflow(
      input.phone,
      input.companyId,
      workflow,
    );

    return {
      handled:
        true,

      text:
        await listReply(
          input.companyId,
          submissions,
        ),
    };
  }

  if (
    normalized
    === "cancelar"
    || normalized
      === "salir"
  ) {
    await saveWorkflow(
      input.phone,
      input.companyId,
      null,
    );

    return {
      handled:
        true,

      text:
        "Listo, cerré la revisión de comprobantes.",
    };
  }

  if (
    workflow
      ?.status
    === "selecting_submission"
  ) {
    const index =
      Number(
        normalized,
      );

    if (
      !Number.isInteger(
        index,
      )
      || index < 1
      || index
        > workflow
            .submissionIds
            .length
    ) {
      return {
        handled:
          true,

        text:
          "Decime el número del comprobante que querés revisar.",
      };
    }

    const submissionId =
      workflow
        .submissionIds[
          index - 1
        ];

    const submission =
      await submissionById(
        input.companyId,
        submissionId,
      );

    if (
      !submission
      || submission.status
        !== "pending_review"
    ) {
      await saveWorkflow(
        input.phone,
        input.companyId,
        null,
      );

      return {
        handled:
          true,

        text:
          "Ese comprobante ya no está pendiente. Escribí “comprobantes pendientes” para actualizar la lista.",
      };
    }

    const detail =
      await detailReply(
        input.companyId,
        submission,
      );

    const updated:
      ReviewWorkflow = {
      ...workflow,

      status:
        "awaiting_decision",

      selectedSubmissionId:
        submission.id,

      expiresAt:
        new Date(
          Date.now()
          + 15
            * 60
            * 1000,
        )
          .toISOString(),
    };

    await saveWorkflow(
      input.phone,
      input.companyId,
      updated,
    );

    const relatedSubmissions =
      submission.order_id
        ? await pendingSubmissionsByOrder(
            input.companyId,
            submission.order_id,
          )
        : [
            submission,
          ];

    const media =
      relatedSubmissions
        .slice(
          0,
          5,
        )
        .flatMap(
          (item) => {
            if (!item.message_id) {
              return [];
            }

            const whatsappMediaId =
              typeof item
                .metadata
                ?.whatsapp_media_id
              === "string"
                ? String(
                    item
                      .metadata
                      .whatsapp_media_id,
                  )
                : null;

            return [{
              messageId:
                item.message_id,

              whatsappMediaId,

              mediaType:
                item.media_type,

              mimeType:
                item.media_mime_type,
            }];
          },
        );

    const detailText =
      media.length > 1
        ? detail.text.replace(
            "Te envío el comprobante.",
            `Se recibieron ${media.length} archivos para este pedido. Te los envío a continuación.`,
          )
        : detail.text;

    return {
      handled:
        true,

      text:
        detailText,

      media,
    };
  }

  if (
    workflow
      ?.status
    === "awaiting_decision"
  ) {
    const submissionId =
      workflow
        .selectedSubmissionId;

    if (!submissionId) {
      await saveWorkflow(
        input.phone,
        input.companyId,
        null,
      );

      return {
        handled:
          true,

        text:
          "La revisión venció. Escribí “comprobantes pendientes” para empezar de nuevo.",
      };
    }

    const submission =
      await submissionById(
        input.companyId,
        submissionId,
      );

    if (
      !submission
      || submission.status
        !== "pending_review"
    ) {
      await saveWorkflow(
        input.phone,
        input.companyId,
        null,
      );

      return {
        handled:
          true,

        text:
          "Ese comprobante ya fue procesado.",
      };
    }

    const detail =
      await detailReply(
        input.companyId,
        submission,
      );

    if (
      normalized
        === "confirmar"
      || normalized
        === "confirmo"
      || normalized
        === "aprobar"
    ) {
      if (
        !detail.order
        || detail.amount <= 0
      ) {
        return {
          handled:
            true,

          text:
            "No puedo confirmar este comprobante porque el pedido o el saldo no están correctamente vinculados.",
        };
      }

      await approvePaymentSubmission(
        input.companyId,
        submission.id,
        detail.amount,
        {
          id:
            "whatsapp-owner",

          name:
            "Dueño por WhatsApp",

          email:
            "whatsapp-owner@fulanitas.local",

          role:
            "owner",
        },
      );

      await saveWorkflow(
        input.phone,
        input.companyId,
        null,
      );

      const customerPhone =
        submission
          .customer_phone
        ?? detail.customer
          ?.whatsapp
        ?? null;

      return {
        handled:
          true,

        text: [
          "Pago confirmado ✅",
          "",
          `Pedido: ${detail.order.number}`,
          `Importe: ${money(detail.amount, detail.order.currency)}`,
        ].join(
          "\n",
        ),

        notifyCustomer:
          customerPhone
            ? {
                phone:
                  customerPhone,

                text: [
                  "Pago confirmado ✅",
                  "",
                  `Recibimos correctamente la transferencia del pedido ${detail.order.number}.`,
                  "Tu pedido ya quedó confirmado.",
                ].join(
                  "\n",
                ),
              }
            : null,
      };
    }

    if (
      normalized
        === "rechazar"
      || normalized
        === "rechazo"
    ) {
      const updated:
        ReviewWorkflow = {
        ...workflow,

        status:
          "awaiting_rejection_reason",

        expiresAt:
          new Date(
            Date.now()
            + 15
              * 60
              * 1000,
          )
            .toISOString(),
      };

      await saveWorkflow(
        input.phone,
        input.companyId,
        updated,
      );

      return {
        handled:
          true,

        text: [
          "¿Por qué querés rechazarlo?",
          "",
          "1. Importe incorrecto",
          "2. Comprobante ilegible",
          "3. Transferencia no encontrada",
          "4. Los datos no coinciden",
          "5. Otro motivo",
        ].join(
          "\n",
        ),
      };
    }

    return {
      handled:
        true,

      text:
        "Respondé CONFIRMAR o RECHAZAR.",
    };
  }

  if (
    workflow
      ?.status
    === "awaiting_rejection_reason"
  ) {
    const submissionId =
      workflow
        .selectedSubmissionId;

    if (!submissionId) {
      await saveWorkflow(
        input.phone,
        input.companyId,
        null,
      );

      return {
        handled:
          true,

        text:
          "La revisión venció.",
      };
    }

    if (normalized === "5") {
      return {
        handled:
          true,

        text:
          "Escribime el motivo del rechazo.",
      };
    }

    const reason =
      rejectionReasons[
        normalized
      ]
      ?? (
        normalized.length
          >= 4
          ? input.message
              .trim()
          : null
      );

    if (!reason) {
      return {
        handled:
          true,

        text:
          "Elegí una opción del 1 al 5 o escribí directamente el motivo.",
      };
    }

    const submission =
      await submissionById(
        input.companyId,
        submissionId,
      );

    if (
      !submission
      || submission.status
        !== "pending_review"
    ) {
      await saveWorkflow(
        input.phone,
        input.companyId,
        null,
      );

      return {
        handled:
          true,

        text:
          "Ese comprobante ya fue procesado.",
      };
    }

    const order =
      await orderById(
        input.companyId,
        submission.order_id,
      );

    await rejectPaymentSubmission(
      input.companyId,
      submission.id,
      reason,
      {
        id:
          "whatsapp-owner",

        name:
          "Dueño por WhatsApp",

        email:
          "whatsapp-owner@fulanitas.local",

        role:
          "owner",
      },
    );

    const customer =
      await customerById(
        input.companyId,
        submission.customer_id,
      );

    const customerPhone =
      submission
        .customer_phone
      ?? customer
        ?.whatsapp
      ?? null;

    if (customerPhone) {
      await reopenCustomerReceipt(
        input.companyId,
        customerPhone,
        order,
      );
    }

    await saveWorkflow(
      input.phone,
      input.companyId,
      null,
    );

    return {
      handled:
        true,

      text: [
        "Comprobante rechazado.",
        "",
        `Pedido: ${order?.number ?? "Sin número"}`,
        `Motivo: ${reason}`,
        "",
        "El cliente podrá enviar un nuevo comprobante.",
      ].join(
        "\n",
      ),

      notifyCustomer:
        customerPhone
          ? {
              phone:
                customerPhone,

              text: [
                `No pudimos verificar el comprobante del pedido ${order?.number ?? ""}.`,
                "",
                `Motivo: ${reason}.`,
                "",
                "Por favor, enviá nuevamente una imagen o PDF del comprobante para volver a verificar la transferencia.",
              ].join(
                "\n",
              ),
            }
          : null,
    };
  }

  return {
    handled:
      false,
  };
}
