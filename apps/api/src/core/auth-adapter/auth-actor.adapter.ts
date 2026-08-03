import type {
  SessionUser,
} from "../../auth/auth.types.js";

import {
  isAccessRole,
  type AccessActor,
} from "../authorization/index.js";

export class AuthActorAdapterError
  extends Error {
  readonly code:
    | "UNSUPPORTED_ROLE"
    | "COMPANY_REQUIRED";

  constructor(
    code:
      AuthActorAdapterError["code"],

    message:
      string,
  ) {
    super(message);

    this.name =
      "AuthActorAdapterError";

    this.code =
      code;
  }
}

function normalizeCompanyId(
  value: string | null,
): string | null {
  const normalized =
    value
      ?.trim()
      .toLowerCase()
    || null;

  return normalized;
}

export function toAccessActor(
  user: SessionUser,
): AccessActor {
  if (
    !isAccessRole(
      user.role,
    )
  ) {
    throw new AuthActorAdapterError(
      "UNSUPPORTED_ROLE",
      "El rol de la sesión no pertenece al catálogo de acceso.",
    );
  }

  const companyId =
    user.role === "superadmin"
      ? null
      : normalizeCompanyId(
          user.companyId,
        );

  if (
    user.role !== "superadmin"
    && !companyId
  ) {
    throw new AuthActorAdapterError(
      "COMPANY_REQUIRED",
      "El usuario empresarial no tiene una empresa asignada.",
    );
  }

  return {
    id:
      user.id,

    name:
      user.name,

    email:
      user.email
        .trim()
        .toLowerCase(),

    role:
      user.role,

    companyId,

    active:
      user.active,
  };
}
