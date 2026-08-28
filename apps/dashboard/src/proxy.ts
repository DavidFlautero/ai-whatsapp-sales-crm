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
]);

const vendorRoutes = [
  "/conversations",
  "/crm",
  "/catalog",
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
    pathname === "/robots.txt";

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
