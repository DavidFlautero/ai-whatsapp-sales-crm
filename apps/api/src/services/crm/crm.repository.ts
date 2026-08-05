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

  name_source?:
    | "whatsapp_profile"
    | "customer"
    | "operator"
    | "unknown";

  name_confirmed?: boolean;

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
  const previous =
    await getContactByPhone(
      input.phone,
      companyId,
    );

  const previousMetadata =
    previous?.metadata
    && typeof previous.metadata
      === "object"
      ? previous.metadata
      : {};

  const incomingMetadata =
    input.metadata
    && typeof input.metadata
      === "object"
      ? input.metadata
      : {};

  const contact: Contact = {
    company_id:
      companyId,

    phone:
      input.phone.trim(),

    ...(input.name !== undefined
      ? {
          name:
            input.name.trim(),
        }
      : {}),

    ...(input.business_name !== undefined
      ? {
          business_name:
            input.business_name.trim(),
        }
      : {}),

    ...(input.status !== undefined
      ? {
          status:
            input.status,
        }
      : {}),

    ...(input.temperature !== undefined
      ? {
          temperature:
            input.temperature,
        }
      : {}),

    ...(input.ai_score !== undefined
      ? {
          ai_score:
            input.ai_score,
        }
      : {}),

    ...(input.total_sales !== undefined
      ? {
          total_sales:
            input.total_sales,
        }
      : {}),

    ...(input.last_message !== undefined
      ? {
          last_message:
            input.last_message,
        }
      : {}),

    metadata: {
      ...previousMetadata,
      ...incomingMetadata,
    },

    last_seen_at:
      new Date().toISOString(),
  };

  if (!contact.phone) {
    throw new Error(
      "CONTACT_PHONE_REQUIRED",
    );
  }

  if (
    !isSupabaseConfigured()
  ) {
    const key =
      contactKey(
        companyId,
        contact.phone,
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

export async function updateContactIdentity(
  input: {
    phone: string;
    name?: string;
    business_name?: string;
    name_confirmed?: boolean;

    email?: string;
    country?: string;
    province?: string;
    city?: string;
    address?: string;
    postal_code?: string;
    address_reference?: string;
    notes?: string;

    customer_type?:
      | "retail"
      | "wholesaler"
      | "distributor"
      | "reseller"
      | "vip"
      | "other";

    temperature?:
      | "cold"
      | "warm"
      | "hot";

    status?:
      | "lead"
      | "customer"
      | "inactive"
      | "blocked";
  },
  companyId =
    env.DEFAULT_COMPANY_ID,
) {
  const phone =
    input.phone.trim();

  if (!phone) {
    throw new Error(
      "CONTACT_PHONE_REQUIRED",
    );
  }

  const previous =
    await getContactByPhone(
      phone,
      companyId,
    );

  const name =
    input.name
      ?.trim();

  if (
    name !== undefined
    && name.length < 2
  ) {
    throw new Error(
      "CONTACT_NAME_TOO_SHORT",
    );
  }

  const metadata = {
    ...(
      previous?.metadata
      && typeof previous.metadata
        === "object"
        ? previous.metadata
        : {}
    ),

    ...(name !== undefined
      ? {
          name_source:
            "operator",

          name_confirmed:
            input.name_confirmed
            ?? true,
        }
      : {}),

    ...(input.email !== undefined
      ? {
          email:
            input.email.trim(),
        }
      : {}),

    ...(input.country !== undefined
      ? {
          country:
            input.country.trim(),
        }
      : {}),

    ...(input.province !== undefined
      ? {
          province:
            input.province.trim(),
        }
      : {}),

    ...(input.city !== undefined
      ? {
          city:
            input.city.trim(),
        }
      : {}),

    ...(input.address !== undefined
      ? {
          address:
            input.address.trim(),
        }
      : {}),

    ...(input.postal_code !== undefined
      ? {
          postal_code:
            input.postal_code.trim(),
        }
      : {}),

    ...(input.address_reference !== undefined
      ? {
          address_reference:
            input.address_reference.trim(),
        }
      : {}),

    ...(input.customer_type !== undefined
      ? {
          customer_type:
            input.customer_type,
        }
      : {}),

    ...(input.notes !== undefined
      ? {
          notes:
            input.notes.trim(),
        }
      : {}),
  };

  return upsertContact(
    {
      phone,

      ...(name !== undefined
        ? {
            name,
          }
        : {}),

      ...(input.business_name !== undefined
        ? {
            business_name:
              input.business_name.trim(),
          }
        : {}),

      ...(input.temperature !== undefined
        ? {
            temperature:
              input.temperature,
          }
        : {}),

      ...(input.status !== undefined
        ? {
            status:
              input.status,
          }
        : {}),

      metadata,
    },
    companyId,
  );
}

