import {
  supabaseRequest,
  supabaseRpc,
} from "../db/supabase-rest.client.js";


type PaymentSubmissionRow = {
  id?: string;
  customer_id?: string | null;
  order_id?: string | null;
  status?: string;
  created_at?: string;
};


type PaymentSubmissionOrder = {
  id?: string;
  orderNumber?: string;
  total?: number;
  paidAmount?: number;
  remaining?: number;
};


export type ReceivePaymentSubmissionResult = {
  submission?:
    PaymentSubmissionRow;

  created:
    boolean;

  duplicate:
    boolean;

  customerResolved:
    boolean;

  orderResolved:
    boolean;

  customer?: {
    id?: string;
    name?: string;
  } | null;

  order?:
    PaymentSubmissionOrder
    | null;
};


export async function receiveWhatsappPaymentSubmission(
  input: {
    companyId: string;
    messageId: string;
  },
): Promise<ReceivePaymentSubmissionResult> {
  const companyId =
    input.companyId.trim();

  const messageId =
    input.messageId.trim();

  if (!companyId) {
    throw new Error(
      "PAYMENT_SUBMISSION_COMPANY_REQUIRED",
    );
  }

  if (!messageId) {
    throw new Error(
      "PAYMENT_SUBMISSION_MESSAGE_REQUIRED",
    );
  }

  return supabaseRpc<
    ReceivePaymentSubmissionResult
  >(
    "commerce_receive_payment_submission",
    {
      p_company_id:
        companyId,

      p_message_id:
        messageId,
    },
  );
}


export type PaymentAccount = {
  id: string;

  company_id: string;

  display_name: string;
  institution_name: string;

  account_type:
    | "bank_account"
    | "virtual_wallet"
    | "cash"
    | "other";

  holder_name: string;
  tax_id?: string | null;

  alias?: string | null;
  account_number?: string | null;

  currency: string;
  instructions?: string | null;

  active: boolean;
  is_default: boolean;
};


export type PaymentWorkflow = {
  status:
    | "awaiting_receipt"
    | "receipt_received"
    | "expired"
    | "cancelled";

  paymentAccountId:
    string;

  orderId?:
    string | null;

  orderNumber?:
    string | null;

  createdAt:
    string;

  expiresAt:
    string;

  submissionId?:
    string | null;

  updatedAt:
    string;
};


export async function getDefaultPaymentAccount(
  input: {
    companyId: string;
    currency?: string;
  },
): Promise<PaymentAccount | null> {
  const companyId =
    input.companyId.trim();

  const currency =
    (
      input.currency
      ?? "ARS"
    )
      .trim()
      .toUpperCase();

  if (!companyId) {
    throw new Error(
      "PAYMENT_ACCOUNT_COMPANY_REQUIRED",
    );
  }

  const rows =
    await supabaseRequest<
      PaymentAccount[]
    >({
      table:
        "commerce_payment_accounts",

      query:
        `?company_id=eq.${encodeURIComponent(companyId)}`
        + `&currency=eq.${encodeURIComponent(currency)}`
        + "&active=eq.true"
        + "&is_default=eq.true"
        + "&select=*"
        + "&limit=1",
    });

  return rows[0]
    ?? null;
}


export function paymentAccountReply(
  account:
    PaymentAccount,
) {
  const lines = [
    "Podés realizar la transferencia a esta cuenta:",
    "",
    account.institution_name,
    `Titular: ${account.holder_name}`,
  ];

  if (
    account.alias
    ?.trim()
  ) {
    lines.push(
      `Alias: ${account.alias.trim()}`,
    );
  }

  if (
    account.account_number
    ?.trim()
  ) {
    const label =
      account.account_type
      === "virtual_wallet"
        ? "CVU"
        : "CBU";

    lines.push(
      `${label}: ${account.account_number.trim()}`,
    );
  }

  if (
    account.tax_id
    ?.trim()
  ) {
    lines.push(
      `CUIT: ${account.tax_id.trim()}`,
    );
  }

  if (
    account.instructions
    ?.trim()
  ) {
    lines.push(
      "",
      account.instructions.trim(),
    );
  }

  lines.push(
    "",
    "Cuando hagas la transferencia, enviame la imagen o el PDF del comprobante.",
    "Una vez recibido, verificaremos la transferencia y te confirmaremos el pago.",
  );

  return lines.join("\n");
}


export function paymentWorkflowFromMetadata(
  metadata?:
    Record<string, unknown>,
): PaymentWorkflow | null {
  const raw =
    metadata?.payment_workflow;

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
      "awaiting_receipt",
      "receipt_received",
      "expired",
      "cancelled",
    ].includes(status)
  ) {
    return null;
  }

  const paymentAccountId =
    typeof value.paymentAccountId
    === "string"
      ? value.paymentAccountId
      : "";

  const createdAt =
    typeof value.createdAt
    === "string"
      ? value.createdAt
      : "";

  const expiresAt =
    typeof value.expiresAt
    === "string"
      ? value.expiresAt
      : "";

  const updatedAt =
    typeof value.updatedAt
    === "string"
      ? value.updatedAt
      : "";

  if (
    !paymentAccountId
    || !createdAt
    || !expiresAt
    || !updatedAt
  ) {
    return null;
  }

  return {
    status:
      status as PaymentWorkflow["status"],

    paymentAccountId,

    orderId:
      typeof value.orderId
      === "string"
        ? value.orderId
        : null,

    orderNumber:
      typeof value.orderNumber
      === "string"
        ? value.orderNumber
        : null,

    createdAt,
    expiresAt,

    submissionId:
      typeof value.submissionId
      === "string"
        ? value.submissionId
        : null,

    updatedAt,
  };
}


export function isAwaitingPaymentReceipt(
  workflow:
    PaymentWorkflow
    | null,
) {
  if (
    !workflow
    || ![
      "awaiting_receipt",
      "receipt_received",
    ].includes(
      workflow.status,
    )
  ) {
    return false;
  }

  const expiresAt =
    new Date(
      workflow.expiresAt,
    );

  return (
    !Number.isNaN(
      expiresAt.getTime(),
    )
    && expiresAt.getTime()
      > Date.now()
  );
}


export function paymentSubmissionReply(
  result:
    ReceivePaymentSubmissionResult,
) {
  const orderNumber =
    result.order?.orderNumber
      ?.trim();

  const remaining =
    Number(
      result.order?.remaining,
    );

  if (result.duplicate) {
    return [
      "Ya había recibido este comprobante.",
      "",
      "La transferencia sigue pendiente de verificación.",
      "Te confirmaremos el pago una vez validado.",
    ].join("\n");
  }

  if (
    result.orderResolved
    && orderNumber
  ) {
    const lines = [
      "Recibí tu comprobante.",
      "",
      `Lo vinculé al pedido ${orderNumber}.`,
      "La transferencia quedó pendiente de verificación.",
    ];

    if (
      Number.isFinite(remaining)
      && remaining >= 0
    ) {
      lines.push(
        "",
        `Saldo pendiente del pedido: $${remaining.toLocaleString("es-AR")}.`,
      );
    }

    lines.push(
      "",
      "Te confirmaremos el pago una vez validado.",
    );

    return lines.join("\n");
  }

  if (result.customerResolved) {
    return [
      "Recibí tu comprobante.",
      "",
      "La transferencia quedó pendiente de verificación.",
      "Estamos validando la información del pedido.",
      "",
      "Te confirmaremos el pago una vez validado.",
    ].join("\n");
  }

  return [
    "Recibí el comprobante.",
    "",
    "La transferencia quedó pendiente de verificación.",
    "Te confirmaremos el estado del pago una vez validado.",
  ].join("\n");
}
