import {
  env,
} from "../../config/env.js";

import {
  isSupabaseConfigured,
  supabaseRequest,
} from "../db/supabase-rest.client.js";

export type Prompt = {
  id?: string;

  company_id?: string;

  type: string;
  title: string;
  prompt: string;

  version?: number;
  active?: boolean;

  metadata?:
    Record<string, unknown>;
};

const defaultPrompts:
  Prompt[] = [
    {
      type:
        "sales",

      title:
        "Sales Agent",

      prompt:
        "Eres un vendedor humano, cálido y directo. Vendes por WhatsApp con naturalidad. Detectas intención de compra y avanzas hacia catálogo, stock o pedido sin inventar precio ni disponibilidad.",

      active:
        true,
    },

    {
      type:
        "followup",

      title:
        "Followup Agent",

      prompt:
        "Recontacta clientes con tono humano, corto y sin presión. Usa historial, producto de interés y una llamada a la acción clara.",

      active:
        true,
    },

    {
      type:
        "recovery",

      title:
        "Recovery Agent",

      prompt:
        "Recupera clientes inactivos con tono cercano, novedades relevantes y una propuesta concreta.",

      active:
        true,
    },
  ];

const memoryPrompts =
  new Map<string, Prompt>();

for (
  const prompt
  of defaultPrompts
) {
  memoryPrompts.set(
    `${env.DEFAULT_COMPANY_ID}:${prompt.type}`,
    {
      ...prompt,

      company_id:
        env.DEFAULT_COMPANY_ID,
    },
  );
}

function promptKey(
  companyId: string,
  type: string,
) {
  return `${companyId}:${type}`;
}

export async function listPrompts(
  companyId =
    env.DEFAULT_COMPANY_ID,
) {
  if (
    !isSupabaseConfigured()
  ) {
    return Array
      .from(
        memoryPrompts.values(),
      )
      .filter(
        (prompt) =>
          prompt.company_id
          === companyId,
      );
  }

  try {
    const rows =
      await supabaseRequest<
        Prompt[]
      >({
        table:
          "ai_prompts",

        query:
          `?company_id=eq.${encodeURIComponent(companyId)}`
          + "&select=*"
          + "&order=type.asc",
      });

    return rows.length
      ? rows
      : defaultPrompts.map(
          (prompt) => ({
            ...prompt,

            company_id:
              companyId,
          }),
        );
  } catch (error) {
    console.error(
      "[PROMPTS DEGRADED]",
      error,
    );

    return defaultPrompts.map(
      (prompt) => ({
        ...prompt,

        company_id:
          companyId,
      }),
    );
  }
}

export async function getPrompt(
  type: string,
  companyId =
    env.DEFAULT_COMPANY_ID,
) {
  const prompts =
    await listPrompts(
      companyId,
    );

  return (
    prompts.find(
      (prompt) =>
        prompt.type
        === type,
    )
    ?? defaultPrompts[0]
  );
}

export async function upsertPrompt(
  input: Prompt,
  companyId =
    env.DEFAULT_COMPANY_ID,
) {
  const prompt: Prompt = {
    ...input,

    company_id:
      companyId,

    version:
      input.version
      ?? 1,

    active:
      input.active
      ?? true,

    metadata:
      input.metadata
      ?? {},
  };

  if (
    !isSupabaseConfigured()
  ) {
    memoryPrompts.set(
      promptKey(
        companyId,
        input.type,
      ),
      prompt,
    );

    return prompt;
  }

  const rows =
    await supabaseRequest<
      Prompt[]
    >({
      table:
        "ai_prompts",

      method:
        "POST",

      query:
        "?on_conflict=company_id,type",

      prefer:
        "resolution=merge-duplicates,return=representation",

      body: [
        prompt,
      ],
    });

  const stored =
    rows[0];

  if (!stored?.id) {
    throw new Error(
      "AI_PROMPT_UPSERT_FAILED",
    );
  }

  return stored;
}
