import { jwtVerify } from "jose";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

type UserRole =
  | "superadmin"
  | "owner"
  | "admin"
  | "supervisor"
  | "vendedor";

const publicRoutes = new Set([
  "/login",
  "/forgot-password",
  "/privacy",
  "/terms",
  "/data-deletion",

  // Captación pública de Eventos Mediterráneo
  "/organiza-tu-evento",

  // Catálogo público de espacios
  "/espacios",
]);

const vendorRoutes = [
  "/conversations",
  "/crm",
  "/catalog",
  "/panel",
];

const supervisorBlockedRoutes = [
  "/integrations",
  "/settings",
];


/* ADMIN_ONLY_CATALOG_MEDIA_V1 */
const adminOnlyRoutes = [
  "/catalog/media-missing",
];

const cookieName =
  process.env.AUTH_COOKIE_NAME ||
  "fulanitas_session";

const authSecret =
  process.env.AUTH_SECRET || "";

const secret =
  new TextEncoder().encode(authSecret);

const storeLinkSecret =
  process.env.STORE_LINK_SECRET || "";

const storeSecret =
  new TextEncoder().encode(
    storeLinkSecret,
  );

function matchesRoute(
  pathname: string,
  route: string,
) {
  return (
    pathname === route ||
    pathname.startsWith(`${route}/`)
  );
}

function defaultRoute(role: UserRole) {
  if (role === "superadmin") {
    return "/platform";
  }

  if (role === "vendedor") {
    return "/conversations";
  }

  return "/";
}

function canAccess(
  pathname: string,
  role: UserRole,
) {
  const isDashboardApi =
    matchesRoute(
      pathname,
      "/dashboard-api",
    );

  if (isDashboardApi) {
    return true;
  }


  const isAdminOnly =
    adminOnlyRoutes.some(
      (route) =>
        matchesRoute(
          pathname,
          route,
        ),
    );


  if (isAdminOnly) {
    return (
      role === "superadmin"
      || role === "owner"
      || role === "admin"
    );
  }


  const isPlatform =
    matchesRoute(pathname, "/platform");

  if (role === "superadmin") {
    return true;
  }

  if (isPlatform) {
    return false;
  }

  if (
    role === "owner" ||
    role === "admin"
  ) {
    return true;
  }

  if (role === "supervisor") {
    return !supervisorBlockedRoutes.some(
      (route) =>
        matchesRoute(pathname, route),
    );
  }

  return vendorRoutes.some(
    (route) =>
      matchesRoute(pathname, route),
  );
}

export async function proxy(
  request: NextRequest,
) {
  // DELIBOCADOS_UNIFIED_AUTH_V1
  // Validar acceso en el proxy ANTES del render de React/Next.
  if (process.env.NEXT_PUBLIC_PANEL_INSTANCE === "delibocados") {
    const p = request.nextUrl.pathname;
    if (p === "/login") return NextResponse.redirect(new URL("/ingresar", request.url));
    // Public customer QR page, with its checkout API separately fail-closed.
    if (p === "/qr-pedido") return NextResponse.next();
    if (p === "/ingresar" || p.startsWith("/api/restaurant-auth/")) {
      return NextResponse.next();
    }
    if (p === "/panel" || p.startsWith("/panel/")) {
      const originalCookie = request.headers.get("cookie") || "";
      if (!originalCookie) {
        return NextResponse.redirect(new URL("/ingresar", request.url));
      }
      try {
        const response = await fetch("http://127.0.0.1:4100/auth/session", {
          headers: { Cookie: originalCookie, Accept: "application/json" },
          cache: "no-store",
          signal: AbortSignal.timeout(7000),
        });
        if (!response.ok) {
          return NextResponse.redirect(new URL("/ingresar", request.url));
        }
        const session = await response.json();
        const user = session?.user;
        if (user?.companyId !== "delibocados" || user?.active !== true ||
            !["owner", "admin"].includes(user?.role || "")) {
          return NextResponse.redirect(new URL("/ingresar?error=empresa", request.url));
        }
        return NextResponse.next();
      } catch {
        // Backend no disponible: acceso denegado por defecto.
        return NextResponse.redirect(new URL("/ingresar", request.url));
      }
    }
  }

  // OWNER_PORTAL_ACCESS_V1
  // Las páginas son públicas; los datos requieren sesión propia.
  const ownerPath = request.nextUrl.pathname;

  if (
    ownerPath === "/propietarios" ||
    ownerPath.startsWith("/propietarios/") ||
    ownerPath === "/api/owner" ||
    ownerPath.startsWith("/api/owner/")
  ) {
    return NextResponse.next();
  }

  const { pathname } =
    request.nextUrl;

  /* =====================================================
     STORE ACCESS

     /tienda/acceso:
       público únicamente para canjear
       el link firmado enviado por WhatsApp.

     resto de /tienda:
       requiere cookie firmada válida.
     ===================================================== */

  if (
    pathname
    === "/tienda/acceso"
  ) {
    return NextResponse.next();
  }

  if (
    pathname === "/tienda"
    || pathname.startsWith(
      "/tienda/",
    )
  ) {
    const storeCookieName =
      "fulanitas_store_access";

    const storeToken =
      request.cookies
        .get(
          storeCookieName,
        )
        ?.value;

    if (
      !storeToken
      || !storeLinkSecret
    ) {
      return new NextResponse(
        "Acceso al catálogo no disponible. Solicitá un enlace nuevo desde WhatsApp.",
        {
          status:
            403,

          headers: {
            "Content-Type":
              "text/plain; charset=utf-8",

            "Cache-Control":
              "no-store",
          },
        },
      );
    }

    try {
      const {
        payload:
          storePayload,
      } =
        await jwtVerify(
          storeToken,
          storeSecret,
          {
            issuer:
              "fulanitas-store",

            audience:
              "fulanitas-storefront",

            algorithms: [
              "HS256",
            ],
          },
        );

      if (
        storePayload.companyId
          !== "fulanitas"
        || storePayload.scope
          !== "store"
      ) {
        throw new Error(
          "Invalid store session",
        );
      }

      return NextResponse.next();
    } catch {
      const response =
        new NextResponse(
          "La sesión del catálogo venció. Solicitá un enlace nuevo desde WhatsApp.",
          {
            status:
              403,

            headers: {
              "Content-Type":
                "text/plain; charset=utf-8",

              "Cache-Control":
                "no-store",
            },
          },
        );

      response.cookies.delete(
        storeCookieName,
      );

      return response;
    }
  }


  const isPublic =
    publicRoutes.has(pathname) ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname.startsWith("/eventos/");

  if (isPublic) {
    return NextResponse.next();
  }

  const token =
    request.cookies
      .get(cookieName)
      ?.value;

  if (!token || !authSecret) {
    return NextResponse.redirect(
      new URL("/login", request.url),
    );
  }

  try {
    const { payload } =
      await jwtVerify(
        token,
        secret,
        {
          issuer: "fulanitas-api",
          audience:
            "fulanitas-dashboard",
        },
      );

    const role =
      payload.role as UserRole;

    const validRoles: UserRole[] = [
      "superadmin",
      "owner",
      "admin",
      "supervisor",
      "vendedor",
    ];

    if (!validRoles.includes(role)) {
      throw new Error("Invalid role");
    }

    if (!canAccess(pathname, role)) {
      return NextResponse.redirect(
        new URL(
          defaultRoute(role),
          request.url,
        ),
      );
    }

    return NextResponse.next();
  } catch {
    const response =
      NextResponse.redirect(
        new URL(
          "/login",
          request.url,
        ),
      );

    response.cookies.delete(cookieName);

    return response;
  }
}

export const config = {
  matcher: [
    "/((?!api|dashboard-api|_next/static|_next/image|favicon.ico|robots.txt).*)",
  ],
};
