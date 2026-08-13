import {
  Router,
} from "express";

import type {
  Request,
  Response,
} from "express";

import {
  z,
  ZodError,
} from "zod";

import {
  requireRoles,
} from "../../middlewares/auth.middleware.js";

import {
  deactivatePaymentAccount,
  getPaymentSettings,
  initializePaymentOwner,
  savePaymentAccount,
  setDefaultPaymentAccount,
} from "../../services/payments/payment-settings.repository.js";


export const adminPaymentSettingsRoutes =
  Router();


const accountSchema =
  z.object({
    displayName:
      z.string()
        .trim()
        .min(2)
        .max(120),

    institutionName:
      z.string()
        .trim()
        .min(2)
        .max(120),

    accountType:
      z.enum([
        "bank_account",
        "virtual_wallet",
        "cash",
        "other",
      ]),

    holderName:
      z.string()
        .trim()
        .min(2)
        .max(180),

    taxId:
      z.string()
        .trim()
        .max(40)
        .nullable()
        .optional(),

    alias:
      z.string()
        .trim()
        .max(120)
        .nullable()
        .optional(),

    accountNumber:
      z.string()
        .trim()
        .max(80)
        .nullable()
        .optional(),

    currency:
      z.enum([
        "ARS",
        "USD",
        "EUR",
      ])
        .default("ARS"),

    instructions:
      z.string()
        .trim()
        .max(1000)
        .nullable()
        .optional(),

    sortOrder:
      z.coerce
        .number()
        .int()
        .min(0)
        .max(1000)
        .default(0),
  })
  .strict();


const ownerSchema =
  z.object({
    phone:
      z.string()
        .trim()
        .min(8)
        .max(30),
  })
  .strict();


function companyId(
  req:
    Request,
) {
  const value =
    req.tenantContext
      ?.effectiveCompanyId;

  if (!value) {
    throw new Error(
      "COMPANY_CONTEXT_REQUIRED",
    );
  }

  return value;
}


function requestContext(
  req:
    Request,
) {
  if (!req.requestContext) {
    throw new Error(
      "REQUEST_CONTEXT_REQUIRED",
    );
  }

  return req.requestContext;
}


function statusForError(
  error:
    string,
) {
  switch (error) {
    case "PAYMENT_ACCOUNT_NOT_FOUND":
      return 404;

    case "PAYMENT_OWNER_ALREADY_CONFIGURED":
    case "PAYMENT_ACCOUNT_DEFAULT_CANNOT_DEACTIVATE":
      return 409;

    case "COMPANY_CONTEXT_REQUIRED":
    case "REQUEST_CONTEXT_REQUIRED":
      return 400;

    case "PAYMENT_ACCOUNT_COMPANY_REQUIRED":
    case "PAYMENT_ACCOUNT_ID_REQUIRED":
    case "PAYMENT_ACCOUNT_DISPLAY_NAME_REQUIRED":
    case "PAYMENT_ACCOUNT_INSTITUTION_REQUIRED":
    case "PAYMENT_ACCOUNT_HOLDER_REQUIRED":
    case "PAYMENT_ACCOUNT_TYPE_INVALID":
    case "PAYMENT_ACCOUNT_CURRENCY_INVALID":
    case "PAYMENT_ACCOUNT_DESTINATION_REQUIRED":
    case "PAYMENT_ACCOUNT_NUMBER_TOO_LONG":
    case "PAYMENT_ACCOUNT_INACTIVE":
    case "PAYMENT_OWNER_PHONE_INVALID":
    case "PAYMENT_OWNER_HASH_INVALID":
    case "PAYMENT_OWNER_LAST2_INVALID":
      return 400;

    default:
      return 500;
  }
}


function handleError(
  caught:
    unknown,

  res:
    Response,
) {
  if (
    caught instanceof
      ZodError
  ) {
    return res
      .status(400)
      .json({
        ok:
          false,

        error:
          "VALIDATION_ERROR",

        message:
          caught.issues[0]
            ?.message
          ?? "Datos inválidos.",

        issues:
          caught.issues,
      });
  }

  const error =
    caught instanceof Error
      ? caught.message
      : "PAYMENT_SETTINGS_ERROR";

  console.error(
    "[ADMIN PAYMENT SETTINGS]",
    {
      error,
    },
  );

  return res
    .status(
      statusForError(
        error,
      ),
    )
    .json({
      ok:
        false,

      error,

      message:
        error
        === "PAYMENT_OWNER_ALREADY_CONFIGURED"
          ? "El número del dueño ya fue configurado y no puede modificarse."
          : error
            === "PAYMENT_ACCOUNT_DEFAULT_CANNOT_DEACTIVATE"
            ? "Primero seleccioná otra cuenta predeterminada."
            : "No fue posible completar la operación.",
    });
}


adminPaymentSettingsRoutes.get(
  "/",

  requireRoles(
    "superadmin",
    "owner",
    "admin",
    "supervisor",
  ),

  async (
    req:
      Request,

    res:
      Response,
  ) => {
    try {
      const data =
        await getPaymentSettings(
          companyId(req),
        );

      return res.json({
        ok:
          true,

        data,

        requestId:
          req.requestContext
            ?.requestId
          ?? null,
      });
    } catch (caught) {
      return handleError(
        caught,
        res,
      );
    }
  },
);


adminPaymentSettingsRoutes.post(
  "/accounts",

  requireRoles(
    "superadmin",
    "owner",
    "admin",
  ),

  async (
    req:
      Request,

    res:
      Response,
  ) => {
    try {
      const data =
        accountSchema.parse(
          req.body,
        );

      const account =
        await savePaymentAccount({
          companyId:
            companyId(req),

          accountId:
            null,

          data,

          context:
            requestContext(req),
        });

      return res
        .status(201)
        .json({
          ok:
            true,

          account,
        });
    } catch (caught) {
      return handleError(
        caught,
        res,
      );
    }
  },
);


adminPaymentSettingsRoutes.put(
  "/accounts/:accountId",

  requireRoles(
    "superadmin",
    "owner",
    "admin",
  ),

  async (
    req:
      Request,

    res:
      Response,
  ) => {
    try {
      const accountId =
        z.string()
          .uuid()
          .parse(
            req.params.accountId,
          );

      const data =
        accountSchema.parse(
          req.body,
        );

      const account =
        await savePaymentAccount({
          companyId:
            companyId(req),

          accountId,

          data,

          context:
            requestContext(req),
        });

      return res.json({
        ok:
          true,

        account,
      });
    } catch (caught) {
      return handleError(
        caught,
        res,
      );
    }
  },
);


adminPaymentSettingsRoutes.post(
  "/accounts/:accountId/default",

  requireRoles(
    "superadmin",
    "owner",
    "admin",
  ),

  async (
    req:
      Request,

    res:
      Response,
  ) => {
    try {
      const accountId =
        z.string()
          .uuid()
          .parse(
            req.params.accountId,
          );

      const account =
        await setDefaultPaymentAccount({
          companyId:
            companyId(req),

          accountId,

          context:
            requestContext(req),
        });

      return res.json({
        ok:
          true,

        account,
      });
    } catch (caught) {
      return handleError(
        caught,
        res,
      );
    }
  },
);


adminPaymentSettingsRoutes.post(
  "/accounts/:accountId/deactivate",

  requireRoles(
    "superadmin",
    "owner",
    "admin",
  ),

  async (
    req:
      Request,

    res:
      Response,
  ) => {
    try {
      const accountId =
        z.string()
          .uuid()
          .parse(
            req.params.accountId,
          );

      const account =
        await deactivatePaymentAccount({
          companyId:
            companyId(req),

          accountId,

          context:
            requestContext(req),
        });

      return res.json({
        ok:
          true,

        account,
      });
    } catch (caught) {
      return handleError(
        caught,
        res,
      );
    }
  },
);


adminPaymentSettingsRoutes.post(
  "/owner",

  requireRoles(
    "superadmin",
    "owner",
    "admin",
  ),

  async (
    req:
      Request,

    res:
      Response,
  ) => {
    try {
      const input =
        ownerSchema.parse(
          req.body,
        );

      const owner =
        await initializePaymentOwner({
          companyId:
            companyId(req),

          phone:
            input.phone,

          context:
            requestContext(req),
        });

      return res
        .status(201)
        .json({
          ok:
            true,

          owner,
        });
    } catch (caught) {
      return handleError(
        caught,
        res,
      );
    }
  },
);
