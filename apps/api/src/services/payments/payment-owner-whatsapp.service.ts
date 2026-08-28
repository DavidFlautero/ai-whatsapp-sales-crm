import {
  createHash,
  randomUUID,
} from "node:crypto";

import type {
  RequestContext,
} from "../../core/request-context/index.js";

import {
  supabaseRequest,
} from "../db/supabase-rest.client.js";

import {
  getPaymentSettings,
  setDefaultPaymentAccount,
} from "./payment-settings.repository.js";


type OwnerRow = {
  owner_phone_hash: string;
};


type AdminActionRow = {
  id: string;
  company_id: string;
  owner_phone_hash: string;

  action_type:
    "set_default_payment_account";

  target_account_id:
    string | null;

  previous_account_id:
    string | null;

  status:
    | "pending_selection"
    | "pending_confirmation"
    | "completed"
    | "cancelled"
    | "expired"
    | "failed";

  initiating_message_id: string;
  confirmation_message_id:
    string | null;

  payload:
    Record<string, unknown>;

  expires_at: string;
};


type OwnerWhatsappResult = {
  handled: boolean;
  text?: string;
};


function normalizePhone(
  value:
    string,
) {
  return value.replace(
    /\D/g,
    "",
  );
}


function ownerPhoneHash(
  companyId:
    string,

  phone:
    string,
) {
  return createHash("sha256")
    .update(
      `${companyId}:${normalizePhone(phone)}`,
      "utf8",
    )
    .digest("hex");
}


function normalizeMessage(
  value:
    string,
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


function isStartCommand(
  message:
    string,
) {
  return (
    /\bcambiar\b.*\bcuenta\b/
      .test(message)
    || /\bcuenta\b.*\bpredeterminada\b/
      .test(message)
    || /\bcambiar\b.*\bcobro\b/
      .test(message)
  );
}


function isConfirmCommand(
  message:
    string,
) {
  return (
    message === "confirmar"
    || message === "confirmo"
    || message === "si confirmar"
  );
}


function isCancelCommand(
  message:
    string,
) {
  return (
    message === "cancelar"
    || message === "cancela"
    || message === "no"
  );
}


function requestContext(
  companyId:
    string,

  messageId:
    string,
): RequestContext {
  return {
    requestId:
      randomUUID(),

    startedAt:
      new Date()
        .toISOString(),

    actor: {
      id:
        "whatsapp-owner",

      name:
        "Dueño por WhatsApp",

      email:
        "whatsapp-owner@fulanitas.local",

      role:
        "owner",

      companyId,

      active:
        true,
    },

    tenant: {
      mode:
        "company",

      effectiveCompanyId:
        companyId,

      actorCompanyId:
        companyId,

      source:
        "session",

      superadminImpersonation:
        false,
    },

    source:
      "whatsapp",

    ipAddress:
      null,

    userAgent:
      `whatsapp:${messageId}`,
  };
}


async function authenticateOwner(
  companyId:
    string,

  phone:
    string,
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

  const configuredHash =
    rows[0]
      ?.owner_phone_hash;

  if (!configuredHash) {
    return {
      authenticated:
        false,

      phoneHash:
        null,
    };
  }

  const calculatedHash =
    ownerPhoneHash(
      companyId,
      phone,
    );

  return {
    authenticated:
      calculatedHash
      === configuredHash,

    phoneHash:
      calculatedHash,
  };
}


async function expireOldActions(
  companyId:
    string,

  phoneHash:
    string,
) {
  await supabaseRequest({
    table:
      "commerce_payment_admin_actions",

    method:
      "PATCH",

    query:
      `?company_id=eq.${encodeURIComponent(companyId)}`
      + `&owner_phone_hash=eq.${encodeURIComponent(phoneHash)}`
      + "&status=in.(pending_selection,pending_confirmation)"
      + `&expires_at=lt.${encodeURIComponent(new Date().toISOString())}`,

    body: {
      status:
        "expired",

      updated_at:
        new Date()
          .toISOString(),
    },

    prefer:
      "return=minimal",
  });
}


async function pendingAction(
  companyId:
    string,

  phoneHash:
    string,
) {
  const rows =
    await supabaseRequest<
      AdminActionRow[]
    >({
      table:
        "commerce_payment_admin_actions",

      query:
        `?company_id=eq.${encodeURIComponent(companyId)}`
        + `&owner_phone_hash=eq.${encodeURIComponent(phoneHash)}`
        + "&status=in.(pending_selection,pending_confirmation)"
        + "&select=*"
        + "&order=created_at.desc"
        + "&limit=1",
    });

  return rows[0]
    ?? null;
}


async function updateAction(
  companyId:
    string,

  actionId:
    string,

  body:
    Record<string, unknown>,
) {
  const rows =
    await supabaseRequest<
      AdminActionRow[]
    >({
      table:
        "commerce_payment_admin_actions",

      method:
        "PATCH",

      query:
        `?company_id=eq.${encodeURIComponent(companyId)}`
        + `&id=eq.${encodeURIComponent(actionId)}`,

      body: {
        ...body,

        updated_at:
          new Date()
            .toISOString(),
      },

      prefer:
        "return=representation",
    });

  return rows[0]
    ?? null;
}


export async function handlePaymentOwnerWhatsappCommand(
  input: {
    companyId: string;
    phone: string;
    message: string;
    messageId: string;
  },
): Promise<OwnerWhatsappResult> {
  const auth =
    await authenticateOwner(
      input.companyId,
      input.phone,
    );

  /*
   * Para cualquier otro número, el comando no existe.
   * El mensaje continúa hacia el agente comercial normal.
   */
  if (
    !auth.authenticated
    || !auth.phoneHash
  ) {
    return {
      handled:
        false,
    };
  }

  const normalized =
    normalizeMessage(
      input.message,
    );

  await expireOldActions(
    input.companyId,
    auth.phoneHash,
  );

  let action =
    await pendingAction(
      input.companyId,
      auth.phoneHash,
    );

  if (
    !action
    && !isStartCommand(
      normalized,
    )
  ) {
    return {
      handled:
        false,
    };
  }

  const settings =
    await getPaymentSettings(
      input.companyId,
    );

  const accounts =
    settings.accounts
      .filter(
        (account) =>
          account.active,
      );

  if (
    !action
    && isStartCommand(
      normalized,
    )
  ) {
    if (!accounts.length) {
      return {
        handled:
          true,

        text:
          "No hay cuentas de cobro activas configuradas.",
      };
    }

    if (accounts.length === 1) {
      const only =
        accounts[0];

      return {
        handled:
          true,

        text: [
          "Sólo hay una cuenta activa.",
          `${only.displayName} — ${only.currency}`,
          only.isDefault
            ? "Ya es la cuenta predeterminada."
            : "Agregá otra cuenta desde el panel para poder alternarlas.",
        ].join("\n"),
      };
    }

    const expiresAt =
      new Date(
        Date.now()
        + 10 * 60 * 1000,
      );

    const idempotencyKey =
      createHash("sha256")
        .update(
          `${input.companyId}:${input.messageId}:set-default`,
          "utf8",
        )
        .digest("hex");

    const inserted =
      await supabaseRequest<
        AdminActionRow[]
      >({
        table:
          "commerce_payment_admin_actions",

        method:
          "POST",

        body: {
          company_id:
            input.companyId,

          owner_phone_hash:
            auth.phoneHash,

          action_type:
            "set_default_payment_account",

          status:
            "pending_selection",

          initiating_message_id:
            input.messageId,

          idempotency_key:
            idempotencyKey,

          payload: {
            source:
              "whatsapp",

            accountIds:
              accounts.map(
                (account) =>
                  account.id,
              ),
          },

          expires_at:
            expiresAt
              .toISOString(),
        },

        prefer:
          "return=representation",
      });

    action =
      inserted[0]
      ?? null;

    if (!action) {
      throw new Error(
        "PAYMENT_ADMIN_ACTION_CREATE_FAILED",
      );
    }

    return {
      handled:
        true,

      text: [
        "Cuentas de cobro activas:",
        "",
        ...accounts.map(
          (
            account,
            index,
          ) => [
            `${index + 1}. ${account.displayName}`,
            `   ${account.institutionName} · ${account.currency}`,
            account.isDefault
              ? "   Predeterminada actualmente"
              : "",
          ]
            .filter(Boolean)
            .join("\n"),
        ),
        "",
        "Respondé con el número de la cuenta que querés dejar como predeterminada.",
        "La operación vence en 10 minutos.",
      ].join("\n"),
    };
  }

  if (!action) {
    return {
      handled:
        false,
    };
  }

  if (
    isCancelCommand(
      normalized,
    )
  ) {
    await updateAction(
      input.companyId,
      action.id,
      {
        status:
          "cancelled",

        confirmation_message_id:
          input.messageId,

        completed_at:
          new Date()
            .toISOString(),
      },
    );

    return {
      handled:
        true,

      text:
        "Operación cancelada. La cuenta predeterminada no cambió.",
    };
  }

  if (
    action.status
    === "pending_selection"
  ) {
    const selectedNumber =
      Number.parseInt(
        normalized,
        10,
      );

    if (
      !Number.isInteger(
        selectedNumber,
      )
      || selectedNumber < 1
      || selectedNumber > accounts.length
    ) {
      return {
        handled:
          true,

        text:
          `Elegí un número entre 1 y ${accounts.length}, o escribí CANCELAR.`,
      };
    }

    const selected =
      accounts[
        selectedNumber - 1
      ];

    if (!selected) {
      return {
        handled:
          true,

        text:
          "No pude identificar esa cuenta. Volvé a elegir un número.",
      };
    }

    if (selected.isDefault) {
      await updateAction(
        input.companyId,
        action.id,
        {
          status:
            "cancelled",

          target_account_id:
            selected.id,

          completed_at:
            new Date()
              .toISOString(),

          result_data: {
            reason:
              "already_default",
          },
        },
      );

      return {
        handled:
          true,

        text:
          `${selected.displayName} ya es la cuenta predeterminada para ${selected.currency}.`,
      };
    }

    const previous =
      accounts.find(
        (account) =>
          account.currency
          === selected.currency
          && account.isDefault,
      );

    await updateAction(
      input.companyId,
      action.id,
      {
        status:
          "pending_confirmation",

        target_account_id:
          selected.id,

        previous_account_id:
          previous?.id
          ?? null,

        payload: {
          ...action.payload,

          selectedDisplayName:
            selected.displayName,

          selectedCurrency:
            selected.currency,
        },
      },
    );

    return {
      handled:
        true,

      text: [
        `Vas a dejar como predeterminada:`,
        `${selected.displayName} — ${selected.institutionName}`,
        `Moneda: ${selected.currency}`,
        "",
        "Respondé CONFIRMAR para aplicar el cambio.",
        "Respondé CANCELAR para mantener la cuenta actual.",
      ].join("\n"),
    };
  }

  if (
    action.status
    === "pending_confirmation"
  ) {
    if (
      !isConfirmCommand(
        normalized,
      )
    ) {
      return {
        handled:
          true,

        text:
          "Respondé CONFIRMAR para aplicar el cambio o CANCELAR para abortar.",
      };
    }

    if (!action.target_account_id) {
      await updateAction(
        input.companyId,
        action.id,
        {
          status:
            "failed",

          confirmation_message_id:
            input.messageId,

          completed_at:
            new Date()
              .toISOString(),

          result_data: {
            error:
              "TARGET_ACCOUNT_MISSING",
          },
        },
      );

      return {
        handled:
          true,

        text:
          "No pude identificar la cuenta seleccionada. Iniciá nuevamente el cambio.",
      };
    }

    try {
      const account =
        await setDefaultPaymentAccount({
          companyId:
            input.companyId,

          accountId:
            action.target_account_id,

          context:
            requestContext(
              input.companyId,
              input.messageId,
            ),
        });

      await updateAction(
        input.companyId,
        action.id,
        {
          status:
            "completed",

          confirmation_message_id:
            input.messageId,

          completed_at:
            new Date()
              .toISOString(),

          result_data: {
            accountId:
              account.id,

            displayName:
              account.displayName,

            currency:
              account.currency,
          },
        },
      );

      return {
        handled:
          true,

        text: [
          "Cuenta predeterminada actualizada ✅",
          `${account.displayName} — ${account.institutionName}`,
          `Moneda: ${account.currency}`,
        ].join("\n"),
      };
    } catch (error) {
      await updateAction(
        input.companyId,
        action.id,
        {
          status:
            "failed",

          confirmation_message_id:
            input.messageId,

          completed_at:
            new Date()
              .toISOString(),

          result_data: {
            error:
              error instanceof Error
                ? error.message
                : "UNKNOWN_ERROR",
          },
        },
      );

      throw error;
    }
  }

  return {
    handled:
      false,
  };
}
