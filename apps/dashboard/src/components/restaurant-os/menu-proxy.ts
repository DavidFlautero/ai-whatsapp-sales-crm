import { NextRequest, NextResponse } from "next/server";

const AUTH = "http://127.0.0.1:4100";
const MODULES = "http://127.0.0.1:3601";
const EDITOR = "http://127.0.0.1:3500";
const NEW_ORIGIN = "https://panel.delibocados.online";
const OLD_ORIGIN = "https://delibocados.online";

type Module = "catalog" | "qr";

function failure(status: number, message: string) {
  return NextResponse.json({ ok: false, error: message }, {
    status,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

async function authorized(cookie: string, module: Module): Promise<boolean> {
  if (!cookie) return false;
  try {
    const sessionResponse = await fetch(`${AUTH}/auth/session`, {
      headers: { Cookie: cookie, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!sessionResponse.ok) return false;
    const session = await sessionResponse.json();
    const user = session?.user;
    if (user?.companyId !== "delibocados" || user?.active !== true ||
        !["owner", "admin"].includes(user?.role)) return false;
    const modulesResponse = await fetch(`${MODULES}/api/restaurant/modules`, {
      headers: { Cookie: cookie, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!modulesResponse.ok) return false;
    const config = await modulesResponse.json();
    return config?.companyId === "delibocados" && config?.modules?.[module] === true;
  } catch {
    return false;
  }
}

/**
 * Puente interno autenticado. El editor Python 3500 sigue conservando
 * validación de sesión, revisión optimista y publicación a PostgreSQL.
 */
export async function menuProxy(
  request: NextRequest,
  module: Module,
  operation: "catalog" | "upload" | "qr",
): Promise<NextResponse> {
  const cookie = request.headers.get("cookie") ?? "";
  if (!(await authorized(cookie, module))) return failure(401, "SESION_O_MODULO_NO_AUTORIZADO");

  const method = request.method;
  if (method !== "GET" && method !== "POST") return failure(405, "METHOD_NOT_ALLOWED");
  if (method === "GET" && operation === "upload") return failure(405, "METHOD_NOT_ALLOWED");
  if (method === "POST") {
    // Protección CSRF; no se acepta un origen de una empresa distinta.
    const origin = request.headers.get("origin") ?? "";
    if (origin !== NEW_ORIGIN) return failure(403, "ORIGEN_NO_AUTORIZADO");
    const type = request.headers.get("content-type") ?? "";
    if (!type.toLowerCase().startsWith("application/json")) return failure(415, "JSON_REQUERIDO");
  }

  const routes = {
    catalog: "/workspace/menu/api",
    upload: "/workspace/menu/upload",
    qr: "/workspace/menu/qr/api",
  };

  let body: string | undefined;
  if (method === "POST") {
    const len = Number(request.headers.get("content-length") ?? "0");
    if (len > 4_800_000) return failure(413, "SOLICITUD_DEMASIADO_GRANDE");
    body = await request.text();
    if (Buffer.byteLength(body, "utf8") > 4_800_000) return failure(413, "SOLICITUD_DEMASIADO_GRANDE");
    try { JSON.parse(body); } catch { return failure(400, "JSON_INVALIDO"); }
  }

  try {
    const upstream = await fetch(`${EDITOR}${routes[operation]}`, {
      method,
      headers: {
        Cookie: cookie,
        Accept: "application/json",
        ...(method === "POST" ? {
          "Content-Type": "application/json",
          Origin: OLD_ORIGIN,
          "Sec-Fetch-Site": "same-origin",
        } : {}),
        Host: "delibocados.online",
      },
      body,
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(operation === "upload" ? 25000 : 18000),
    });
    const contentType = upstream.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return failure(502, `RESPUESTA_EDITOR_NO_JSON_${upstream.status}`);
    }
    const payload = await upstream.text();
    return new NextResponse(payload, {
      status: upstream.status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return failure(503, "EDITOR_MENU_NO_DISPONIBLE");
  }
}
