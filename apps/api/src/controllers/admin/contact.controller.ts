import type {
  Request,
  Response,
} from "express";

import {
  updateContactIdentity,
} from "../../services/crm/crm.repository.js";

const allowedTemperatures =
  new Set([
    "cold",
    "warm",
    "hot",
  ]);

const allowedStatuses =
  new Set([
    "lead",
    "customer",
    "inactive",
    "blocked",
  ]);

const allowedCustomerTypes =
  new Set([
    "retail",
    "wholesaler",
    "distributor",
    "reseller",
    "vip",
    "other",
  ]);

function optionalText(
  value: unknown,
) {
  if (value === undefined) {
    return undefined;
  }

  return String(
    value ?? "",
  ).trim();
}

export async function updateAdminContact(
  req: Request,
  res: Response,
) {
  try {
    const phone =
      String(
        req.params.phone
        ?? req.body?.phone
        ?? "",
      ).trim();

    if (!phone) {
      return res
        .status(400)
        .json({
          ok:
            false,

          error:
            "CONTACT_PHONE_REQUIRED",
        });
    }

    const temperature =
      optionalText(
        req.body?.temperature,
      );

    const status =
      optionalText(
        req.body?.status,
      );

    const customerType =
      optionalText(
        req.body?.customer_type,
      );

    if (
      temperature
      && !allowedTemperatures.has(
        temperature,
      )
    ) {
      return res
        .status(400)
        .json({
          ok:
            false,

          error:
            "INVALID_TEMPERATURE",
        });
    }

    if (
      status
      && !allowedStatuses.has(
        status,
      )
    ) {
      return res
        .status(400)
        .json({
          ok:
            false,

          error:
            "INVALID_CONTACT_STATUS",
        });
    }

    if (
      customerType
      && !allowedCustomerTypes.has(
        customerType,
      )
    ) {
      return res
        .status(400)
        .json({
          ok:
            false,

          error:
            "INVALID_CUSTOMER_TYPE",
        });
    }

    const contact =
      await updateContactIdentity({
        phone,

        name:
          optionalText(
            req.body?.name,
          ),

        business_name:
          optionalText(
            req.body
              ?.business_name,
          ),

        name_confirmed:
          req.body
            ?.name_confirmed
          !== false,

        email:
          optionalText(
            req.body?.email,
          ),

        country:
          optionalText(
            req.body?.country,
          ),

        province:
          optionalText(
            req.body?.province,
          ),

        city:
          optionalText(
            req.body?.city,
          ),

        address:
          optionalText(
            req.body?.address,
          ),

        postal_code:
          optionalText(
            req.body
              ?.postal_code,
          ),

        address_reference:
          optionalText(
            req.body
              ?.address_reference,
          ),

        customer_type:
          customerType as
            | "retail"
            | "wholesaler"
            | "distributor"
            | "reseller"
            | "vip"
            | "other"
            | undefined,

        notes:
          optionalText(
            req.body?.notes,
          ),

        temperature:
          temperature as
            | "cold"
            | "warm"
            | "hot"
            | undefined,

        status:
          status as
            | "lead"
            | "customer"
            | "inactive"
            | "blocked"
            | undefined,
      });

    return res.json({
      ok:
        true,

      contact,
    });
  } catch (
    error
  ) {
    const message =
      error instanceof Error
        ? error.message
        : "CONTACT_UPDATE_FAILED";

    return res
      .status(
        message
        === "CONTACT_NAME_TOO_SHORT"
          ? 400
          : 500,
      )
      .json({
        ok:
          false,

        error:
          message,
      });
  }
}
