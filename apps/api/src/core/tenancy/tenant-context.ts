import type {
  AccessActor,
} from "../authorization/index.js";

export type TenantMode =
  | "platform"
  | "company";

export type TenantSource =
  | "platform"
  | "session"
  | "route"
  | "header";

export type TenantContext = {
  mode: TenantMode;

  effectiveCompanyId:
    string | null;

  actorCompanyId:
    string | null;

  source:
    TenantSource;

  superadminImpersonation:
    boolean;
};

export type ResolveTenantInput = {
  actor: AccessActor;

  mode: TenantMode;

  routeCompanyId?:
    string | null;

  headerCompanyId?:
    string | null;
};

export type TenantErrorCode =
  | "INVALID_COMPANY_ID"
  | "CONFLICTING_COMPANY_CONTEXT"
  | "PLATFORM_ACCESS_DENIED"
  | "COMPANY_CONTEXT_REQUIRED"
  | "COMPANY_CONTEXT_MISMATCH";

export class TenantContextError
  extends Error {
  readonly code:
    TenantErrorCode;

  constructor(
    code: TenantErrorCode,
    message: string,
  ) {
    super(message);

    this.name =
      "TenantContextError";

    this.code =
      code;
  }
}

const COMPANY_ID_PATTERN =
  /^[a-z0-9](?:[a-z0-9_-]{0,62}[a-z0-9])?$/;

function normalizeCompanyId(
  value:
    string
    | null
    | undefined,
): string | null {
  const normalized =
    value
      ?.trim()
      .toLowerCase()
    || null;

  if (!normalized) {
    return null;
  }

  if (
    !COMPANY_ID_PATTERN.test(
      normalized,
    )
  ) {
    throw new TenantContextError(
      "INVALID_COMPANY_ID",
      "El identificador de empresa no es válido.",
    );
  }

  return normalized;
}

export function resolveTenantContext(
  input: ResolveTenantInput,
): TenantContext {
  const routeCompanyId =
    normalizeCompanyId(
      input.routeCompanyId,
    );

  const headerCompanyId =
    normalizeCompanyId(
      input.headerCompanyId,
    );

  if (
    routeCompanyId
    && headerCompanyId
    && routeCompanyId
      !== headerCompanyId
  ) {
    throw new TenantContextError(
      "CONFLICTING_COMPANY_CONTEXT",
      "La empresa de la ruta no coincide con la cabecera.",
    );
  }

  const explicitCompanyId =
    routeCompanyId
    ?? headerCompanyId;

  const explicitSource:
    TenantSource =
      routeCompanyId
        ? "route"
        : headerCompanyId
          ? "header"
          : "session";

  if (
    input.mode === "platform"
  ) {
    if (
      input.actor.role
      !== "superadmin"
    ) {
      throw new TenantContextError(
        "PLATFORM_ACCESS_DENIED",
        "Solo superadmin puede usar contexto de plataforma.",
      );
    }

    if (explicitCompanyId) {
      throw new TenantContextError(
        "CONFLICTING_COMPANY_CONTEXT",
        "El contexto de plataforma no acepta una empresa activa.",
      );
    }

    return {
      mode: "platform",

      effectiveCompanyId:
        null,

      actorCompanyId:
        input.actor.companyId,

      source:
        "platform",

      superadminImpersonation:
        false,
    };
  }

  if (
    input.actor.role
    === "superadmin"
  ) {
    if (!explicitCompanyId) {
      throw new TenantContextError(
        "COMPANY_CONTEXT_REQUIRED",
        "Superadmin debe seleccionar explícitamente una empresa.",
      );
    }

    return {
      mode: "company",

      effectiveCompanyId:
        explicitCompanyId,

      actorCompanyId:
        input.actor.companyId,

      source:
        explicitSource,

      superadminImpersonation:
        true,
    };
  }

  const actorCompanyId =
    normalizeCompanyId(
      input.actor.companyId,
    );

  if (!actorCompanyId) {
    throw new TenantContextError(
      "COMPANY_CONTEXT_REQUIRED",
      "El usuario no tiene una empresa asignada.",
    );
  }

  if (
    explicitCompanyId
    && explicitCompanyId
      !== actorCompanyId
  ) {
    throw new TenantContextError(
      "COMPANY_CONTEXT_MISMATCH",
      "El usuario intentó acceder a otra empresa.",
    );
  }

  return {
    mode: "company",

    effectiveCompanyId:
      actorCompanyId,

    actorCompanyId,

    source:
      explicitCompanyId
        ? explicitSource
        : "session",

    superadminImpersonation:
      false,
  };
}
