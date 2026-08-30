import {
  supabaseRequest,
} from "../../services/db/supabase-rest.client.js";

export const PRIVACY_APPLICATION_TABLES = [
  "privacy_tenant_policies",
  "privacy_data_subjects",
  "privacy_consents",
  "privacy_requests",
  "privacy_request_items",
  "privacy_request_events",
  "privacy_legal_holds",
  "privacy_export_artifacts",
  "privacy_suppression_entries",
] as const;

export type PrivacyApplicationTable =
  (typeof PRIVACY_APPLICATION_TABLES)[number];

export type PrivacyApplicationRow =
  Record<string, unknown>;

export type PrivacyFilterOperator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "is"
  | "in"
  | "like"
  | "ilike";

export interface PrivacyFilter {
  column: string;
  operator?: PrivacyFilterOperator;
  value: string | number | boolean | null;
}

export interface PrivacySelectOptions {
  filters?: readonly PrivacyFilter[];
  select?: string;
  order?: string;
  limit?: number;
}

export class PrivacyStoreError
  extends Error {
  readonly code: string;
  readonly details: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "PrivacyStoreError";
    this.code = code;
    this.details = details;
  }
}

const SAFE_IDENTIFIER =
  /^[a-z_][a-z0-9_]*$/;

const SAFE_SELECT =
  /^[a-z0-9_(),.*:-]+$/i;

const SAFE_ORDER =
  /^[a-z0-9_]+(\.(asc|desc))?$/i;

function assertCompanyId(
  companyId: string,
): string {
  const value =
    companyId.trim();

  if (
    value.length < 1
    || value.length > 128
  ) {
    throw new PrivacyStoreError(
      "PRIVACY_INVALID_COMPANY_ID",
      "El contexto de empresa es inválido.",
    );
  }

  return value;
}

function assertTable(
  table: PrivacyApplicationTable,
): void {
  if (
    !PRIVACY_APPLICATION_TABLES
      .includes(table)
  ) {
    throw new PrivacyStoreError(
      "PRIVACY_TABLE_NOT_ALLOWED",
      "La tabla solicitada no pertenece al módulo.",
      {
        table,
      },
    );
  }
}

function assertColumn(
  column: string,
): string {
  if (!SAFE_IDENTIFIER.test(column)) {
    throw new PrivacyStoreError(
      "PRIVACY_INVALID_FILTER_COLUMN",
      "La columna del filtro es inválida.",
    );
  }

  return column;
}

function encodeValue(
  value: PrivacyFilter["value"],
): string {
  if (value === null) {
    return "null";
  }

  return encodeURIComponent(
    String(value),
  );
}

function buildQuery(
  companyId: string,
  options: PrivacySelectOptions = {},
): string {
  const tenant =
    assertCompanyId(companyId);

  const parts: string[] = [
    `company_id=eq.${encodeURIComponent(tenant)}`,
  ];

  for (
    const filter
    of options.filters ?? []
  ) {
    const column =
      assertColumn(filter.column);

    if (column === "company_id") {
      throw new PrivacyStoreError(
        "PRIVACY_COMPANY_FILTER_OVERRIDE",
        "No se puede reemplazar el filtro de empresa.",
      );
    }

    const operator =
      filter.operator ?? "eq";

    parts.push(
      `${column}=${operator}.${encodeValue(filter.value)}`,
    );
  }

  if (options.select) {
    if (!SAFE_SELECT.test(options.select)) {
      throw new PrivacyStoreError(
        "PRIVACY_INVALID_SELECT",
        "La selección de columnas es inválida.",
      );
    }

    parts.push(
      `select=${encodeURIComponent(options.select)}`,
    );
  }

  if (options.order) {
    if (!SAFE_ORDER.test(options.order)) {
      throw new PrivacyStoreError(
        "PRIVACY_INVALID_ORDER",
        "El orden solicitado es inválido.",
      );
    }

    parts.push(
      `order=${encodeURIComponent(options.order)}`,
    );
  }

  if (options.limit !== undefined) {
    const limit =
      Math.trunc(options.limit);

    if (
      limit < 1
      || limit > 500
    ) {
      throw new PrivacyStoreError(
        "PRIVACY_INVALID_LIMIT",
        "El límite debe estar entre 1 y 500.",
      );
    }

    parts.push(`limit=${limit}`);
  }

  return `?${parts.join("&")}`;
}

function assertTenantRows(
  companyId: string,
  rows:
    readonly PrivacyApplicationRow[],
): void {
  const tenant =
    assertCompanyId(companyId);

  for (const row of rows) {
    if (
      row.company_id !== undefined
      && row.company_id !== tenant
    ) {
      throw new PrivacyStoreError(
        "PRIVACY_CROSS_TENANT_WRITE_BLOCKED",
        "Se bloqueó una escritura entre empresas.",
      );
    }
  }
}

export async function selectPrivacyRows<
  T = PrivacyApplicationRow,
>(
  table: PrivacyApplicationTable,
  companyId: string,
  options: PrivacySelectOptions = {},
): Promise<T[]> {
  assertTable(table);

  return supabaseRequest<T[]>({
    table,
    query:
      buildQuery(
        companyId,
        options,
      ),
  });
}

export async function selectPrivacyRow<
  T = PrivacyApplicationRow,
>(
  table: PrivacyApplicationTable,
  companyId: string,
  options: PrivacySelectOptions = {},
): Promise<T | null> {
  const rows =
    await selectPrivacyRows<T>(
      table,
      companyId,
      {
        ...options,
        limit: 1,
      },
    );

  return rows[0] ?? null;
}

export async function insertPrivacyRows<
  T = PrivacyApplicationRow,
>(
  table: PrivacyApplicationTable,
  companyId: string,
  rows:
    readonly PrivacyApplicationRow[],
): Promise<T[]> {
  assertTable(table);

  if (rows.length < 1) {
    throw new PrivacyStoreError(
      "PRIVACY_EMPTY_INSERT",
      "No hay registros para insertar.",
    );
  }

  const tenant =
    assertCompanyId(companyId);

  const tenantRows =
    rows.map((row) => ({
      ...row,
      company_id: tenant,
    }));

  assertTenantRows(
    tenant,
    tenantRows,
  );

  return supabaseRequest<T[]>({
    table,
    method: "POST",
    body: tenantRows,
    prefer: "return=representation",
  });
}

export async function insertPrivacyRow<
  T = PrivacyApplicationRow,
>(
  table: PrivacyApplicationTable,
  companyId: string,
  row: PrivacyApplicationRow,
): Promise<T> {
  const rows =
    await insertPrivacyRows<T>(
      table,
      companyId,
      [row],
    );

  const created =
    rows[0];

  if (!created) {
    throw new PrivacyStoreError(
      "PRIVACY_INSERT_RETURNED_EMPTY",
      "La base no devolvió el registro creado.",
    );
  }

  return created;
}

export async function patchPrivacyRows<
  T = PrivacyApplicationRow,
>(
  table: PrivacyApplicationTable,
  companyId: string,
  filters: readonly PrivacyFilter[],
  patch: PrivacyApplicationRow,
): Promise<T[]> {
  assertTable(table);

  if (filters.length < 1) {
    throw new PrivacyStoreError(
      "PRIVACY_UNSCOPED_UPDATE_BLOCKED",
      "Se bloqueó una actualización sin filtros.",
    );
  }

  if (
    Object.prototype
      .hasOwnProperty.call(
        patch,
        "company_id",
      )
  ) {
    throw new PrivacyStoreError(
      "PRIVACY_COMPANY_MUTATION_BLOCKED",
      "No se puede modificar la empresa de un registro.",
    );
  }

  return supabaseRequest<T[]>({
    table,
    method: "PATCH",
    query:
      buildQuery(
        companyId,
        {
          filters,
          select: "*",
        },
      ),
    body: patch,
    prefer: "return=representation",
  });
}

/*
 * No existe deletePrivacyRows deliberadamente.
 * La supresión se ejecutará mediante funciones SQL
 * auditadas, idempotentes y con legal-hold.
 */
