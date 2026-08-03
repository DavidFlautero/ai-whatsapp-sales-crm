import {
  env,
} from "../../config/env.js";

import {
  isSupabaseConfigured,
  supabaseRequest,
} from "../db/supabase-rest.client.js";

export type Contact = {
  id?: string;

  company_id?: string;

  phone: string;

  name?: string;
  business_name?: string;

  status?:
    | "lead"
    | "customer"
    | "inactive"
    | "blocked";

  temperature?:
    | "cold"
    | "warm"
    | "hot";

  ai_score?: number;
  total_sales?: number;

  last_message?: string;
  last_seen_at?: string;

  metadata?:
    Record<string, unknown>;
};

const memoryContacts =
  new Map<string, Contact>();

function contactKey(
  companyId: string,
  phone: string,
) {
  return `${companyId}:${phone}`;
}

export async function upsertContact(
  input: Contact,
  companyId =
    env.DEFAULT_COMPANY_ID,
) {
  const contact: Contact = {
    ...input,

    company_id:
      companyId,

    last_seen_at:
      new Date().toISOString(),
  };

  if (
    !isSupabaseConfigured()
  ) {
    const key =
      contactKey(
        companyId,
        input.phone,
      );

    const stored = {
      ...(memoryContacts.get(key)
        ?? {}),

      ...contact,

      id:
        memoryContacts
          .get(key)
          ?.id
        ?? crypto.randomUUID(),
    };

    memoryContacts.set(
      key,
      stored,
    );

    return stored;
  }

  const rows =
    await supabaseRequest<Contact[]>({
      table:
        "crm_contacts",

      method:
        "POST",

      query:
        "?on_conflict=company_id,phone",

      prefer:
        "resolution=merge-duplicates,return=representation",

      body: [
        contact,
      ],
    });

  const stored =
    rows[0];

  if (!stored?.id) {
    throw new Error(
      "CRM_CONTACT_UPSERT_FAILED",
    );
  }

  return stored;
}

export async function getContactByPhone(
  phone: string,
  companyId =
    env.DEFAULT_COMPANY_ID,
) {
  if (
    !isSupabaseConfigured()
  ) {
    return (
      memoryContacts.get(
        contactKey(
          companyId,
          phone,
        ),
      )
      ?? null
    );
  }

  const rows =
    await supabaseRequest<Contact[]>({
      table:
        "crm_contacts",

      query:
        `?company_id=eq.${encodeURIComponent(companyId)}`
        + `&phone=eq.${encodeURIComponent(phone)}`
        + "&select=*"
        + "&limit=1",
    });

  return rows[0]
    ?? null;
}

export async function listContacts(
  companyId =
    env.DEFAULT_COMPANY_ID,
) {
  if (
    !isSupabaseConfigured()
  ) {
    return Array
      .from(
        memoryContacts.values(),
      )
      .filter(
        (contact) =>
          contact.company_id
          === companyId,
      );
  }

  return supabaseRequest<Contact[]>({
    table:
      "crm_contacts",

    query:
      `?company_id=eq.${encodeURIComponent(companyId)}`
      + "&select=*"
      + "&order=last_seen_at.desc",
  });
}
