import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";

export type RestaurantModuleKey =
  | "whatsapp" | "ai" | "orders" | "customers"
  | "catalog" | "qr" | "floorplan" | "integrations";

export type RestaurantModules = Record<RestaurantModuleKey, boolean>;
export type RestaurantContext = { modules: RestaurantModules; name: string };

const COOKIE_SERVER = "http://127.0.0.1:4100";
const LEGACY_SERVER = "http://127.0.0.1:3601";

export async function legacyCookie() {
  const store = await cookies();
  return store.getAll().map(({ name, value }) => `${name}=${value}`).join("; ");
}

export async function requireRestaurant(): Promise<RestaurantContext> {
  const cookie = await legacyCookie();
  if (!cookie) redirect("/ingresar");
  let session: { user?: { companyId?: string; role?: string; active?: boolean } };
  try {
    const response = await fetch(`${COOKIE_SERVER}/auth/session`, {
      headers: { Cookie: cookie, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(9000),
    });
    if (!response.ok) redirect("/ingresar");
    session = await response.json();
  } catch (error) {
    // No convertir una interrupción del servicio en una sesión válida.
    if (error && typeof error === "object" && "digest" in error) throw error;
    throw new Error("No se pudo verificar el acceso al restaurante");
  }
  const user = session.user;
  if (user?.companyId !== "delibocados" || user.active !== true ||
      !["owner", "admin"].includes(user.role || "")) {
    redirect("/ingresar?error=empresa");
  }
  let modules: RestaurantModules;
  try {
    const response = await fetch(`${LEGACY_SERVER}/api/restaurant/modules`, {
      headers: { Cookie: cookie, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(9000),
    });
    if (!response.ok) throw new Error(`Módulos: HTTP ${response.status}`);
    const result = await response.json();
    if (result.companyId !== "delibocados" || !result.modules) {
      throw new Error("Contexto de empresa inválido");
    }
    modules = result.modules as RestaurantModules;
  } catch {
    // Denegar acceso a módulos hasta recuperar configuración; nunca conceder todo.
    modules = { whatsapp:false, ai:false, orders:false, customers:false,
      catalog:false, qr:false, floorplan:false, integrations:false };
  }
  return { modules, name: "Delibocados" };
}

export async function requireModule(key: RestaurantModuleKey) {
  const context = await requireRestaurant();
  if (!context.modules[key]) notFound();
  return context;
}
