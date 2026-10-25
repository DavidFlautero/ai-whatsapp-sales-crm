import bcrypt from "bcryptjs";

import {
  env,
} from "../config/env.js";

import type {
  AuthUserRecord,
  UserRole,
} from "./auth.types.js";


export type ManagedUserAccess = {
  views: string[];
  actions: string[];
};


export type ManagedUser =
  AuthUserRecord
  & ManagedUserAccess;


function headers():
Record<string, string> {
  if (
    !env.SUPABASE_URL
    || !env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    throw new Error(
      "SUPABASE_NOT_CONFIGURED",
    );
  }

  return {
    apikey:
      env.SUPABASE_SERVICE_ROLE_KEY,

    Authorization:
      `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,

    "Content-Type":
      "application/json",

    Accept:
      "application/json",
  };
}


function endpoint(
  query = "",
): string {
  return (
    `${env.SUPABASE_URL}`
    + "/rest/v1/crm_auth_users"
    + query
  );
}


function mapRow(
  row:
    Record<string, unknown>,
): ManagedUser {
  return {
    id:
      String(row.id),

    companyId:
      String(row.company_id),

    name:
      String(row.name),

    email:
      String(row.email)
        .toLowerCase(),

    phone:
      row.phone
        ? String(row.phone)
        : null,

    passwordHash:
      String(
        row.password_hash,
      ),

    role:
      String(
        row.role,
      ) as UserRole,

    active:
      row.active !== false,

    views:
      Array.isArray(
        row.views,
      )
        ? row.views.map(String)
        : [],

    actions:
      Array.isArray(
        row.actions,
      )
        ? row.actions.map(String)
        : [],
  };
}


export async function findManagedUserByEmail(
  email: string,
): Promise<ManagedUser | null> {
  const normalized =
    email
      .trim()
      .toLowerCase();

  const response =
    await fetch(
      endpoint(
        `?email=eq.${encodeURIComponent(
          normalized,
        )}&limit=1`,
      ),
      {
        headers:
          headers(),
      },
    );

  if (!response.ok) {
    const text =
      await response.text();

    throw new Error(
      `MANAGED_USER_READ_${response.status}:${text}`,
    );
  }

  const rows =
    await response.json() as
      Array<
        Record<string, unknown>
      >;

  if (!rows[0]) {
    return null;
  }

  return mapRow(
    rows[0],
  );
}


export async function listManagedUsers(
  companyId: string,
): Promise<ManagedUser[]> {
  const response =
    await fetch(
      endpoint(
        `?company_id=eq.${encodeURIComponent(
          companyId,
        )}`
        + "&order=name.asc",
      ),
      {
        headers:
          headers(),
      },
    );

  if (!response.ok) {
    const text =
      await response.text();

    throw new Error(
      `MANAGED_USERS_LIST_${response.status}:${text}`,
    );
  }

  const rows =
    await response.json() as
      Array<
        Record<string, unknown>
      >;

  return rows.map(
    mapRow,
  );
}


export async function createManagedUser(
  input: {
    id: string;
    companyId: string;
    name: string;
    email: string;
    phone?: string | null;
    password: string;
    role: UserRole;
    views: string[];
    actions: string[];
  },
): Promise<ManagedUser> {
  const passwordHash =
    await bcrypt.hash(
      input.password,
      12,
    );

  const response =
    await fetch(
      endpoint(),
      {
        method:
          "POST",

        headers: {
          ...headers(),

          Prefer:
            "return=representation",
        },

        body:
          JSON.stringify({
            id:
              input.id,

            company_id:
              input.companyId,

            name:
              input.name
                .trim(),

            email:
              input.email
                .trim()
                .toLowerCase(),

            phone:
              input.phone
              ?? null,

            password_hash:
              passwordHash,

            role:
              input.role,

            views:
              input.views,

            actions:
              input.actions,

            active:
              true,
          }),
      },
    );

  if (!response.ok) {
    const text =
      await response.text();

    throw new Error(
      `MANAGED_USER_CREATE_${response.status}:${text}`,
    );
  }

  const rows =
    await response.json() as
      Array<
        Record<string, unknown>
      >;

  if (!rows[0]) {
    throw new Error(
      "MANAGED_USER_CREATE_EMPTY",
    );
  }

  return mapRow(
    rows[0],
  );
}


export async function patchManagedUser(
  companyId: string,
  userId: string,
  patch: {
    name?: string;
    email?: string;
    phone?: string | null;
    role?: UserRole;
    views?: string[];
    actions?: string[];
    active?: boolean;
    password?: string;
  },
): Promise<ManagedUser | null> {
  const body:
    Record<string, unknown> = {
      updated_at:
        new Date()
          .toISOString(),
    };

  if (
    patch.name
    !== undefined
  ) {
    body.name =
      patch.name.trim();
  }

  if (
    patch.email
    !== undefined
  ) {
    body.email =
      patch.email
        .trim()
        .toLowerCase();
  }

  if (
    patch.phone
    !== undefined
  ) {
    body.phone =
      patch.phone;
  }

  if (
    patch.role
    !== undefined
  ) {
    body.role =
      patch.role;
  }

  if (
    patch.views
    !== undefined
  ) {
    body.views =
      patch.views;
  }

  if (
    patch.actions
    !== undefined
  ) {
    body.actions =
      patch.actions;
  }

  if (
    patch.active
    !== undefined
  ) {
    body.active =
      patch.active;
  }

  if (
    patch.password
  ) {
    body.password_hash =
      await bcrypt.hash(
        patch.password,
        12,
      );
  }

  const response =
    await fetch(
      endpoint(
        `?company_id=eq.${encodeURIComponent(
          companyId,
        )}`
        + `&id=eq.${encodeURIComponent(
          userId,
        )}`,
      ),
      {
        method:
          "PATCH",

        headers: {
          ...headers(),

          Prefer:
            "return=representation",
        },

        body:
          JSON.stringify(
            body,
          ),
      },
    );

  if (!response.ok) {
    const text =
      await response.text();

    throw new Error(
      `MANAGED_USER_UPDATE_${response.status}:${text}`,
    );
  }

  const rows =
    await response.json() as
      Array<
        Record<string, unknown>
      >;

  if (!rows[0]) {
    return null;
  }

  return mapRow(
    rows[0],
  );
}
