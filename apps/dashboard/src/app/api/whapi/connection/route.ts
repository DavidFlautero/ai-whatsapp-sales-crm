import { jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noCache = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
};

async function authorized(request: NextRequest) {
  const secret = process.env.AUTH_SECRET;

  const cookieName =
    process.env.AUTH_COOKIE_NAME ||
    "fulanitas_session";

  const token = request.cookies.get(cookieName)?.value;

  if (!secret || !token) return false;

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(secret)
    );

    const role = String(payload.role || "");

    if (role === "superadmin") {
      return true;
    }

    const company = String(
      payload.company_id ||
      payload.companyId ||
      payload.tenant_id ||
      payload.tenantId ||
      ""
    );

    const configuredCompany =
      process.env.DEFAULT_COMPANY_ID;

    return (
      ["owner", "admin"].includes(role) &&
      Boolean(company) &&
      Boolean(configuredCompany) &&
      company === configuredCompany
    );
  } catch {
    return false;
  }
}

function errorResponse(
  message: string,
  status: number
) {
  return NextResponse.json(
    { ok: false, error: message },
    { status, headers: noCache }
  );
}

export async function GET(request: NextRequest) {
  if (!(await authorized(request))) {
    return errorResponse("Acceso no autorizado", 403);
  }

  const token = process.env.WHAPI_TOKEN;

  if (!token) {
    return errorResponse(
      "WHAPI_TOKEN no disponible en dashboard",
      503
    );
  }

  const mode =
    request.nextUrl.searchParams.get("mode");

  if (mode !== "status" && mode !== "qr") {
    return errorResponse("Operacion invalida", 400);
  }

  const path = mode === "status"
    ? "/health?wakeup=false"
    : "/users/login/image";

  try {
    const response = await fetch(
      `https://gate.whapi.cloud${path}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: mode === "qr"
            ? "image/png"
            : "application/json",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!response.ok) {
      console.error(
        "[WHAPI CONNECTION]",
        mode,
        response.status
      );

      return errorResponse(
        "Whapi no pudo completar la solicitud",
        502
      );
    }

    if (mode === "qr") {
      const contentType =
        response.headers.get("content-type") || "";

      if (!contentType.includes("image/png")) {
        return errorResponse(
          "Whapi no devolvio una imagen PNG",
          502
        );
      }

      const buffer = await response.arrayBuffer();

      if (!buffer.byteLength ||
          buffer.byteLength > 2_000_000) {
        return errorResponse(
          "Imagen QR invalida",
          502
        );
      }

      return new Response(buffer, {
        status: 200,
        headers: {
          ...noCache,
          "Content-Type": "image/png",
        },
      });
    }

    const data = await response.json();

    const rawStatus =
      data.health?.status?.text ??
      data.status?.text ??
      data.status;

    const status =
      typeof rawStatus === "string" &&
      /^[A-Za-z_]+$/.test(rawStatus)
        ? rawStatus.toUpperCase()
        : "UNKNOWN";

    return NextResponse.json(
      {
        ok: true,
        status,
        connected: status === "AUTH",
      },
      { headers: noCache }
    );

  } catch {
    return errorResponse(
      "No fue posible consultar Whapi",
      502
    );
  }
}
