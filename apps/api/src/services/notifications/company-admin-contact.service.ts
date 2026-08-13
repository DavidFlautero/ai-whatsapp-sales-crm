import {
  authConfig,
} from "../../auth/auth.config.js";


export type CompanyAdminContact = {
  userId: string;

  name: string;

  role:
    "owner"
    | "admin";

  phone: string;
};


function normalizeCompany(
  value:
    string | null | undefined,
) {
  return String(
    value ?? "",
  )
    .trim()
    .toLowerCase();
}


function normalizedPhone(
  value:
    string | null | undefined,
) {
  const digits =
    String(
      value ?? "",
    )
      .replace(
        /\D/g,
        "",
      );

  return (
    digits.length >= 8
    && digits.length <= 15
  )
    ? digits
    : null;
}


/*
 * ÚNICA FUENTE DE VERDAD:
 *
 * authConfig.users.
 *
 * No usamos:
 * - número hardcodeado en monitor
 * - settings de catálogo
 * - número del último cliente
 * - variables OWNER_WHATSAPP paralelas
 */
export function resolveCompanyAdminContact(
  companyId:
    string,
): CompanyAdminContact | null {
  const targetCompany =
    normalizeCompany(
      companyId,
    );


  const candidates =
    authConfig.users
      .filter(
        (user) =>
          user.active
          && normalizeCompany(
            user.companyId,
          ) === targetCompany
          && (
            user.role === "owner"
            || user.role === "admin"
          ),
      )
      .sort(
        (
          left,
          right,
        ) => {
          const priority = (
            role:
              string,
          ) =>
            role === "owner"
              ? 0
              : 1;

          return (
            priority(
              left.role,
            )
            - priority(
                right.role,
              )
          );
        },
      );


  for (
    const user
    of candidates
  ) {
    const phone =
      normalizedPhone(
        user.phone,
      );

    if (!phone) {
      continue;
    }

    return {
      userId:
        user.id,

      name:
        user.name,

      role:
        user.role as
          | "owner"
          | "admin",

      phone,
    };
  }


  return null;
}
