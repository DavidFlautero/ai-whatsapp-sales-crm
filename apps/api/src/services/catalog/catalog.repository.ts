import { isSupabaseConfigured, supabaseRequest } from "../db/supabase-rest.client.js";

type Product = {
  id?: string;
  sku?: string;
  name: string;
  category?: string;
  color?: string;
  size?: string;
  price?: number;
  stock?: number;
  tags?: string[];
  description?: string;
  active?: boolean;
};

const products: Product[] = [
  {
    sku: "PANT-BAGGY-NEGRO",
    name: "Pantalón Baggy Negro",
    category: "pantalones",
    color: "negro",
    size: "S/M/L/XL",
    price: 0,
    stock: 12,
    tags: ["pantalon", "baggy", "negro", "urbano"],
    description: "Pantalón urbano baggy negro para venta mayorista.",
    active: true
  },
  {
    sku: "JEAN-OVERSIZE-AZUL",
    name: "Jean Oversize Azul",
    category: "jeans",
    color: "azul",
    size: "S/M/L/XL",
    price: 0,
    stock: 8,
    tags: ["jean", "oversize", "azul", "mayorista"],
    description: "Jean oversize estilo urbano.",
    active: true
  }
];

export async function listProducts() {
  if (!isSupabaseConfigured()) return products;

  return supabaseRequest<Product[]>({
    table: "product_catalog_items",
    query: "?select=*&active=eq.true&order=created_at.desc"
  });
}

export async function upsertProduct(input: Product) {
  if (!isSupabaseConfigured()) {
    products.unshift(input);
    return input;
  }

  const rows = await supabaseRequest<Product[]>({
    table: "product_catalog_items",
    method: "POST",
    query: input.sku ? "?on_conflict=sku" : undefined,
    prefer: input.sku ? "resolution=merge-duplicates,return=representation" : "return=representation",
    body: [{
      ...input,
      active: input.active ?? true,
      updated_at: new Date().toISOString()
    }]
  });

  return rows[0];
}

export async function searchProducts(message: string) {
  const all = await listProducts();
  const msg = message.toLowerCase();

  return all
    .filter((product) => {
      const haystack = [
        product.name,
        product.category,
        product.color,
        product.size,
        product.description,
        ...(product.tags ?? [])
      ].join(" ").toLowerCase();

      return msg
        .split(/\s+/)
        .filter((word) => word.length > 2)
        .some((word) => haystack.includes(word));
    })
    .slice(0, 6);
}

export async function buildCatalogContext(message: string) {
  const matches = await searchProducts(message);

  if (!matches.length) {
    return "No hay productos específicos encontrados para esta consulta.";
  }

  return matches.map((product) => `
Producto: ${product.name}
Categoría: ${product.category ?? "-"}
Color: ${product.color ?? "-"}
Talle: ${product.size ?? "-"}
Stock: ${product.stock ?? 0}
Descripción: ${product.description ?? "-"}
`).join("\n");
}
