import { isSupabaseConfigured, supabaseRequest } from "../db/supabase-rest.client.js";

type Tenant = {
  id?: string;
  name: string;
  slug: string;
  plan?: string;
  active?: boolean;
};

const tenants: Tenant[] = [
  {
    name: "Fulanitas",
    slug: "fulanitas",
    plan: "pro",
    active: true
  }
];

export async function createTenant(input: Tenant) {
  const tenant = {
    ...input,
    plan: input.plan ?? "starter",
    active: input.active ?? true
  };

  if (!isSupabaseConfigured()) {
    tenants.unshift(tenant);
    return tenant;
  }

  const rows = await supabaseRequest<Tenant[]>({
    table: "tenants",
    method: "POST",
    body: [tenant]
  });

  return rows[0];
}

export async function listTenants() {
  if (!isSupabaseConfigured()) {
    return tenants;
  }

  return supabaseRequest<Tenant[]>({
    table: "tenants",
    query: "?select=*&order=created_at.desc"
  });
}
