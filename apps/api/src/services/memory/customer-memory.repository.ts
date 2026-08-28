import {
  env,
} from "../../config/env.js";

import {
  isSupabaseConfigured,
  supabaseRequest,
} from "../db/supabase-rest.client.js";

import {
  upsertContact,
} from "../crm/crm.repository.js";

export type CustomerMemory = {
  id?: string;

  company_id?: string;
  contact_id?: string;

  contact_phone: string;

  key: string;
  value: string;

  confidence?: number;
  source?: string;

  metadata?:
    Record<string, unknown>;

  created_at?: string;
  updated_at?: string;
};

const memoryStore =
  new Map<string, CustomerMemory[]>();

function memoryKey(
  companyId: string,
  phone: string,
) {
  return `${companyId}:${phone}`;
}

export async function upsertCustomerMemory(
  input: CustomerMemory,
  companyId =
    env.DEFAULT_COMPANY_ID,
) {
  const contact =
    await upsertContact(
      {
        phone:
          input.contact_phone,
      },
      companyId,
    );

  if (!contact.id) {
    throw new Error(
      "CUSTOMER_MEMORY_CONTACT_REQUIRED",
    );
  }

  const item:
    CustomerMemory = {
      ...input,

      company_id:
        companyId,

      contact_id:
        contact.id,

      confidence:
        input.confidence
        ?? 70,

      source:
        input.source
        ?? "ai",

      metadata:
        input.metadata
        ?? {},

      updated_at:
        new Date().toISOString(),
    };

  if (
    !isSupabaseConfigured()
  ) {
    const key =
      memoryKey(
        companyId,
        input.contact_phone,
      );

    const current =
      memoryStore.get(key)
      ?? [];

    const filtered =
      current.filter(
        (memory) =>
          memory.key
          !== input.key,
      );

    const stored = {
      ...item,

      id:
        current.find(
          (memory) =>
            memory.key
            === input.key,
        )?.id
        ?? crypto.randomUUID(),
    };

    memoryStore.set(
      key,
      [
        ...filtered,
        stored,
      ],
    );

    return stored;
  }

  const rows =
    await supabaseRequest<
      CustomerMemory[]
    >({
      table:
        "customer_memories",

      method:
        "POST",

      query:
        "?on_conflict=company_id,contact_id,key",

      prefer:
        "resolution=merge-duplicates,return=representation",

      body: [
        item,
      ],
    });

  const stored =
    rows[0];

  if (!stored?.id) {
    throw new Error(
      "CUSTOMER_MEMORY_UPSERT_FAILED",
    );
  }

  return stored;
}

export async function listCustomerMemories(
  phone?: string,
  companyId =
    env.DEFAULT_COMPANY_ID,
) {
  if (
    !isSupabaseConfigured()
  ) {
    const all =
      Array
        .from(
          memoryStore.values(),
        )
        .flat();

    return phone
      ? all.filter(
          (memory) =>
            memory.company_id
              === companyId
            && memory.contact_phone
              === phone,
        )
      : all.filter(
          (memory) =>
            memory.company_id
            === companyId,
        );
  }

  const query =
    phone
      ? `?company_id=eq.${encodeURIComponent(companyId)}`
        + `&contact_phone=eq.${encodeURIComponent(phone)}`
        + "&select=*"
        + "&order=updated_at.desc"
      : `?company_id=eq.${encodeURIComponent(companyId)}`
        + "&select=*"
        + "&order=updated_at.desc"
        + "&limit=300";

  return supabaseRequest<
    CustomerMemory[]
  >({
    table:
      "customer_memories",

    query,
  });
}

export async function buildCustomerMemoryContext(
  phone: string,
  companyId =
    env.DEFAULT_COMPANY_ID,
) {
  try {
    const memories =
      await listCustomerMemories(
        phone,
        companyId,
      );

    if (
      !memories.length
    ) {
      return (
        "Cliente sin memoria "
        + "comercial previa."
      );
    }

    return memories
      .slice(
        0,
        12,
      )
      .map(
        (memory) =>
          `- ${memory.key}: `
          + `${memory.value} `
          + `(${memory.confidence ?? 70}% confianza)`,
      )
      .join(
        "\n",
      );
  } catch (error) {
    console.error(
      "[CUSTOMER MEMORY DEGRADED]",
      error,
    );

    return (
      "Memoria comercial no disponible "
      + "temporalmente."
    );
  }
}
