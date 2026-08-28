import {
  env,
} from "../../config/env.js";

import {
  isSupabaseConfigured,
  supabaseRequest,
} from "../db/supabase-rest.client.js";

export type OperatorAssignment = {
  id?: string;
  company_id: string;
  contact_phone: string;
  status:
    | "ai"
    | "human"
    | "paused";
  assigned_to?: string | null;
  reason?: string | null;
  taken_at?: string | null;
  released_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

const assignments =
  new Map<
    string,
    OperatorAssignment
  >();

function assignmentKey(
  companyId: string,
  phone: string,
) {
  return `${companyId}:${phone}`;
}

export async function setOperatorMode(
  input: {
    companyId: string;
    contactPhone: string;
    status:
      | "ai"
      | "human"
      | "paused";
    assignedTo?: string;
    reason?: string;
  },
): Promise<OperatorAssignment> {
  const now =
    new Date().toISOString();

  const row:
    OperatorAssignment = {
      company_id:
        input.companyId,

      contact_phone:
        input.contactPhone,

      status:
        input.status,

      assigned_to:
        input.assignedTo
        ?? null,

      reason:
        input.reason
        ?? null,

      taken_at:
        input.status === "human"
          ? now
          : null,

      released_at:
        input.status === "ai"
          ? now
          : null,

      updated_at:
        now,
    };

  if (!isSupabaseConfigured()) {
    assignments.set(
      assignmentKey(
        input.companyId,
        input.contactPhone,
      ),
      row,
    );

    return row;
  }

  const rows =
    await supabaseRequest<
      OperatorAssignment[]
    >({
      table:
        "operator_assignments",

      method:
        "POST",

      query:
        "?on_conflict=company_id,contact_phone",

      prefer:
        "resolution=merge-duplicates,"
        + "return=representation",

      body:
        [row],
    });

  const assignment =
    rows[0];

  if (!assignment) {
    throw new Error(
      "OPERATOR_MODE_UPDATE_FAILED",
    );
  }

  return assignment;
}

export async function getOperatorMode(
  phone: string,
  companyId: string,
): Promise<OperatorAssignment> {
  if (!isSupabaseConfigured()) {
    return (
      assignments.get(
        assignmentKey(
          companyId,
          phone,
        ),
      )
      ?? {
        company_id:
          companyId,

        contact_phone:
          phone,

        status:
          "ai",
      }
    );
  }

  const rows =
    await supabaseRequest<
      OperatorAssignment[]
    >({
      table:
        "operator_assignments",

      query:
        `?company_id=eq.${encodeURIComponent(companyId)}`
        + `&contact_phone=eq.${encodeURIComponent(phone)}`
        + "&select=*"
        + "&limit=1",
    });

  return (
    rows[0]
    ?? {
      company_id:
        companyId,

      contact_phone:
        phone,

      status:
        "ai",
    }
  );
}

export async function listOperatorAssignments(
  companyId =
    env.DEFAULT_COMPANY_ID,
): Promise<OperatorAssignment[]> {
  if (!isSupabaseConfigured()) {
    return Array.from(
      assignments.values(),
    ).filter(
      (assignment) =>
        assignment.company_id
        === companyId,
    );
  }

  return supabaseRequest<
    OperatorAssignment[]
  >({
    table:
      "operator_assignments",

    query:
      `?company_id=eq.${encodeURIComponent(companyId)}`
      + "&select=*"
      + "&order=updated_at.desc",
  });
}
