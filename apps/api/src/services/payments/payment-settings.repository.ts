import {
  createHash,
} from "node:crypto";

import type {
  RequestContext,
} from "../../core/request-context/index.js";

import {
  supabaseRequest,
  supabaseRpc,
} from "../db/supabase-rest.client.js";


export type PaymentAccountInput = {
  displayName: string;
  institutionName: string;

  accountType:
    | "bank_account"
    | "virtual_wallet"
    | "cash"
    | "other";

  holderName: string;

  taxId?:
    string | null;

  alias?:
    string | null;

  accountNumber?:
    string | null;

  currency:
    | "ARS"
    | "USD"
    | "EUR";

  instructions?:
    string | null;

  sortOrder:
    number;
};


type PaymentAccountRow = {
  id: string;
  company_id: string;

  display_name: string;
  institution_name: string;
  account_type: PaymentAccountInput["accountType"];

  holder_name: string;
  tax_id?: string | null;

  alias?: string | null;
  account_number?: string | null;

  currency: PaymentAccountInput["currency"];

  instructions?: string | null;

  active: boolean;
  is_default: boolean;
  sort_order: number;

  created_at: string;
  updated_at: string;
};


type PaymentOwnerRow = {
  company_id: string;
  owner_phone_last2: string;
  locked: boolean;
  configured_at: string;
};


function actorPayload(
  context:
    RequestContext,
) {
  return {
    id:
      context.actor.id,

    name:
      context.actor.name
      ?? null,

    email:
      context.actor.email
      ?? null,

    role:
      context.actor.role,
  };
}


function requestPayload(
  context:
    RequestContext,
) {
  return {
    requestId:
      context.requestId,

    source:
      context.source,

    ipAddress:
      context.ipAddress,

    userAgent:
      context.userAgent,
  };
}


function maskAccountNumber(
  value?:
    string | null,
) {
  const digits =
    String(value ?? "")
      .replace(
        /\D/g,
        "",
      );

  if (!digits) {
    return null;
  }

  return `••••${digits.slice(-4)}`;
}


function publicAccount(
  row:
    PaymentAccountRow,
) {
  return {
    id:
      row.id,

    displayName:
      row.display_name,

    institutionName:
      row.institution_name,

    accountType:
      row.account_type,

    holderName:
      row.holder_name,

    taxId:
      row.tax_id
      ?? null,

    alias:
      row.alias
      ?? null,

    accountNumberMasked:
      maskAccountNumber(
        row.account_number,
      ),

    hasAccountNumber:
      Boolean(
        row.account_number,
      ),

    currency:
      row.currency,

    instructions:
      row.instructions
      ?? null,

    active:
      row.active,

    isDefault:
      row.is_default,

    sortOrder:
      row.sort_order,

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at,
  };
}


export async function getPaymentSettings(
  companyId:
    string,
) {
  const encodedCompanyId =
    encodeURIComponent(
      companyId,
    );

  const [
    accounts,
    ownerRows,
  ] =
    await Promise.all([
      supabaseRequest<
        PaymentAccountRow[]
      >({
        table:
          "commerce_payment_accounts",

        query:
          `?company_id=eq.${encodedCompanyId}`
          + "&select=*"
          + "&order=sort_order.asc,created_at.asc",
      }),

      supabaseRequest<
        PaymentOwnerRow[]
      >({
        table:
          "commerce_payment_owner_settings",

        query:
          `?company_id=eq.${encodedCompanyId}`
          + "&select=company_id,owner_phone_last2,locked,configured_at"
          + "&limit=1",
      }),
    ]);

  const owner =
    ownerRows[0];

  return {
    accounts:
      accounts.map(
        publicAccount,
      ),

    owner:
      owner
        ? {
            configured:
              true,

            maskedPhone:
              `••••${owner.owner_phone_last2}`,

            last2:
              owner.owner_phone_last2,

            locked:
              owner.locked,

            configuredAt:
              owner.configured_at,
          }
        : {
            configured:
              false,

            maskedPhone:
              null,

            last2:
              null,

            locked:
              false,

            configuredAt:
              null,
          },
  };
}


export async function savePaymentAccount(
  input: {
    companyId: string;

    accountId?:
      string | null;

    data:
      PaymentAccountInput;

    context:
      RequestContext;
  },
) {
  const row =
    await supabaseRpc<
      PaymentAccountRow
    >(
      "commerce_save_payment_account",
      {
        p_company_id:
          input.companyId,

        p_account_id:
          input.accountId
          ?? null,

        p_data:
          input.data,

        p_actor:
          actorPayload(
            input.context,
          ),

        p_request:
          requestPayload(
            input.context,
          ),
      },
    );

  return publicAccount(
    row,
  );
}


export async function setDefaultPaymentAccount(
  input: {
    companyId: string;
    accountId: string;
    context: RequestContext;
  },
) {
  const row =
    await supabaseRpc<
      PaymentAccountRow
    >(
      "commerce_set_default_payment_account",
      {
        p_company_id:
          input.companyId,

        p_account_id:
          input.accountId,

        p_actor:
          actorPayload(
            input.context,
          ),

        p_request:
          requestPayload(
            input.context,
          ),
      },
    );

  return publicAccount(
    row,
  );
}


export async function deactivatePaymentAccount(
  input: {
    companyId: string;
    accountId: string;
    context: RequestContext;
  },
) {
  const row =
    await supabaseRpc<
      PaymentAccountRow
    >(
      "commerce_deactivate_payment_account",
      {
        p_company_id:
          input.companyId,

        p_account_id:
          input.accountId,

        p_actor:
          actorPayload(
            input.context,
          ),

        p_request:
          requestPayload(
            input.context,
          ),
      },
    );

  return publicAccount(
    row,
  );
}


function normalizeOwnerPhone(
  value:
    string,
) {
  const normalized =
    value.replace(
      /\D/g,
      "",
    );

  if (
    normalized.length < 8
    || normalized.length > 15
  ) {
    throw new Error(
      "PAYMENT_OWNER_PHONE_INVALID",
    );
  }

  return normalized;
}


export async function initializePaymentOwner(
  input: {
    companyId: string;
    phone: string;
    context: RequestContext;
  },
) {
  const normalizedPhone =
    normalizeOwnerPhone(
      input.phone,
    );

  /*
   * El número completo no se almacena.
   * El hash queda ligado a la empresa para evitar
   * reutilización directa entre tenants.
   */
  const phoneHash =
    createHash("sha256")
      .update(
        `${input.companyId}:${normalizedPhone}`,
        "utf8",
      )
      .digest("hex");

  return supabaseRpc<{
    companyId: string;
    configured: boolean;
    maskedPhone: string;
    last2: string;
    locked: boolean;
    configuredAt: string;
  }>(
    "commerce_initialize_payment_owner",
    {
      p_company_id:
        input.companyId,

      p_phone_hash:
        phoneHash,

      p_phone_last2:
        normalizedPhone.slice(-2),

      p_actor:
        actorPayload(
          input.context,
        ),

      p_request:
        requestPayload(
          input.context,
        ),
    },
  );
}
