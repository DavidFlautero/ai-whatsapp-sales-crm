import { isSupabaseConfigured, supabaseRequest } from "../db/supabase-rest.client.js";

type KnowledgeItem = {
  id?: string;
  type?: string;
  title: string;
  content: string;
  tags?: string[];
  active?: boolean;
};

const memoryKnowledge: KnowledgeItem[] = [
  {
    type: "catalog",
    title: "Catálogo base",
    content: "Fulanitas vende ropa urbana, pantalones, jeans, oversize, prendas mayoristas y novedades por temporada.",
    tags: ["catalogo", "ropa", "mayorista"],
    active: true
  }
];

export async function listKnowledgeItems() {
  if (!isSupabaseConfigured()) return memoryKnowledge;

  return supabaseRequest<KnowledgeItem[]>({
    table: "knowledge_items",
    query: "?select=*&active=eq.true&order=created_at.desc"
  });
}

export async function createKnowledgeItem(input: KnowledgeItem) {
  const item = {
    type: input.type ?? "catalog",
    title: input.title,
    content: input.content,
    tags: input.tags ?? [],
    active: input.active ?? true
  };

  if (!isSupabaseConfigured()) {
    memoryKnowledge.unshift(item);
    return item;
  }

  const rows = await supabaseRequest<KnowledgeItem[]>({
    table: "knowledge_items",
    method: "POST",
    body: [item]
  });

  return rows[0];
}

export async function buildKnowledgeContext(message: string) {
  const items = await listKnowledgeItems();
  const query = message.toLowerCase();

  const relevant = items
    .filter((item) => {
      const haystack = `${item.title} ${item.content} ${(item.tags ?? []).join(" ")}`.toLowerCase();
      return query.split(/\s+/).some((word) => word.length > 3 && haystack.includes(word));
    })
    .slice(0, 6);

  const selected = relevant.length ? relevant : items.slice(0, 3);

  if (!selected.length) return "Sin base de conocimiento cargada.";

  return selected
    .map((item) => `### ${item.title}\n${item.content}`)
    .join("\n\n");
}
