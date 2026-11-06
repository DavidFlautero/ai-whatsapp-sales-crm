import {
  supabaseRequest,
} from "../db/supabase-rest.client.js";

type MenuProduct = {
  name?: string;
  category?: string;
  description?: string;
  priceCOP?: number | string;
  available?: boolean;
  priceNeedsReview?: boolean;
};

type MenuDocument = {
  company_id: string;
  revision: number;
  payload: {
    products?: MenuProduct[];
  };
};

export async function getCompanyCatalog(
  companyId: string,
  query = ""
): Promise<string> {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(companyId)) {
    throw new Error("INVALID_COMPANY_ID");
  }

  const rows = await supabaseRequest<MenuDocument[]>({
    table: "restaurant_menu_documents",
    query:
      "?select=company_id,revision,payload" +
      "&company_id=eq." +
      encodeURIComponent(companyId) +
      "&limit=1",
  });

  const products = rows[0]?.payload?.products ?? [];

  const available = products
    .filter(p => p.available !== false)
    .map(p => ({
      name: String(p.name ?? ""),
      category: String(p.category ?? ""),
      description: String(p.description ?? ""),
      priceCOP:
        p.priceNeedsReview === true
          ? null
          : Number.isFinite(Number(p.priceCOP))
            ? Number(p.priceCOP)
            : null,
    }))
    .filter(p => p.name.trim().length > 0);

  const normalize = (value: string) =>
    value
      .toLocaleLowerCase("es-CO")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  const search = normalize(query.trim());

  const filtered = search
    ? available.filter(p => {
        const content = normalize(
          [p.name, p.category, p.description]
            .join(" ")
        );

        return content.includes(search);
      })
    : available;

  return JSON.stringify({
    companyId,
    currency: "COP",
    revision: rows[0]?.revision ?? null,
    totalAvailable: available.length,
    products: filtered.slice(0, 150),
  });
}
