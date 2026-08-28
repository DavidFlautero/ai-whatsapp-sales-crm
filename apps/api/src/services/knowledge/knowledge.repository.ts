import {
  env,
} from "../../config/env.js";

import {
  isSupabaseConfigured,
  supabaseRequest,
} from "../db/supabase-rest.client.js";

export type KnowledgeItem = {
  id?: string;

  company_id?: string;

  type?: string;
  title: string;
  content: string;

  tags?: string[];

  source?: string;
  version?: number;

  active?: boolean;

  metadata?:
    Record<string, unknown>;
};

const memoryKnowledge:
  KnowledgeItem[] = [
    {
      company_id:
        env.DEFAULT_COMPANY_ID,

      type:
        "business",

      title:
        "Información general de Fulanitas",

      content:
        "Fulanitas comercializa prendas de moda y ropa mayorista. Antes de confirmar precio, color, talle o disponibilidad debe consultarse el catálogo y stock real.",

      tags: [
        "fulanitas",
        "ropa",
        "mayorista",
      ],

      source:
        "system",

      version:
        1,

      active:
        true,
    },
  ];

export async function listKnowledgeItems(
  companyId =
    env.DEFAULT_COMPANY_ID,
) {
  if (
    !isSupabaseConfigured()
  ) {
    return memoryKnowledge
      .filter(
        (item) =>
          item.company_id
          === companyId,
      );
  }

  try {
    return await supabaseRequest<
      KnowledgeItem[]
    >({
      table:
        "knowledge_items",

      query:
        `?company_id=eq.${encodeURIComponent(companyId)}`
        + "&active=eq.true"
        + "&select=*"
        + "&order=updated_at.desc",
    });
  } catch (error) {
    console.error(
      "[KNOWLEDGE DEGRADED]",
      error,
    );

    return memoryKnowledge
      .filter(
        (item) =>
          item.company_id
          === companyId,
      );
  }
}

export async function createKnowledgeItem(
  input: KnowledgeItem,
  companyId =
    env.DEFAULT_COMPANY_ID,
) {
  const item:
    KnowledgeItem = {
      ...input,

      company_id:
        companyId,

      type:
        input.type
        ?? "business",

      tags:
        input.tags
        ?? [],

      source:
        input.source
        ?? "manual",

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
    memoryKnowledge.unshift(
      item,
    );

    return item;
  }

  const rows =
    await supabaseRequest<
      KnowledgeItem[]
    >({
      table:
        "knowledge_items",

      method:
        "POST",

      prefer:
        "return=representation",

      body: [
        item,
      ],
    });

  const stored =
    rows[0];

  if (!stored?.id) {
    throw new Error(
      "KNOWLEDGE_ITEM_CREATE_FAILED",
    );
  }

  return stored;
}

export async function buildKnowledgeContext(
  message: string,
  companyId =
    env.DEFAULT_COMPANY_ID,
) {
  const items =
    await listKnowledgeItems(
      companyId,
    );

  const query =
    message
      .toLowerCase()
      .trim();

  const words =
    query
      .split(/\s+/)
      .filter(
        (word) =>
          word.length > 3,
      );

  const relevant =
    items
      .filter(
        (item) => {
          const haystack =
            `${item.title} `
            + `${item.content} `
            + `${(
              item.tags
              ?? []
            ).join(" ")}`
              .toLowerCase();

          return words.some(
            (word) =>
              haystack.includes(
                word,
              ),
          );
        },
      )
      .slice(
        0,
        6,
      );

  const selected =
    relevant.length
      ? relevant
      : items.slice(
          0,
          3,
        );

  if (
    !selected.length
  ) {
    return (
      "Sin base de conocimiento "
      + "específica disponible."
    );
  }

  return selected
    .map(
      (item) =>
        `### ${item.title}\n`
        + item.content,
    )
    .join(
      "\n\n",
    );
}
