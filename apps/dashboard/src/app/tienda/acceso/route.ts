import {
  jwtVerify,
  SignJWT,
} from "jose";

import {
  NextRequest,
  NextResponse,
} from "next/server";

const STORE_COOKIE =
  "fulanitas_store_access";

const STORE_SESSION_SECONDS =
  60 * 60;

const STORE_PUBLIC_URL =
  (
    process.env.STORE_PUBLIC_URL
    || "https://panel.fulanitasfabrica.site"
  ).replace(
    /\/+$/,
    "",
  );

function signingSecret() {
  const value =
    process.env.STORE_LINK_SECRET
      ?.trim();

  if (!value) {
    throw new Error(
      "STORE_SECRET_NOT_CONFIGURED",
    );
  }

  return new TextEncoder()
    .encode(
      value,
    );
}

function forbidden(
  message:
    string,
) {
  return new NextResponse(
    `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Acceso no disponible</title>
<style>
body{
  margin:0;
  min-height:100vh;
  display:grid;
  place-items:center;
  background:#f6f4ef;
  color:#16181d;
  font-family:Arial,Helvetica,sans-serif;
}
main{
  width:min(520px,calc(100% - 40px));
  padding:48px;
  box-sizing:border-box;
  background:#fff;
  border:1px solid #e7e4de;
  border-radius:24px;
  text-align:center;
  box-shadow:0 20px 60px rgba(20,22,27,.08);
}
strong{
  display:block;
  font-size:1.5rem;
  margin-bottom:12px;
}
p{
  margin:0;
  color:#6b6d72;
  line-height:1.6;
}
</style>
</head>
<body>
<main>
<strong>Este acceso ya no está disponible.</strong>
<p>${message}</p>
</main>
</body>
</html>`,
    {
      status:
        403,

      headers: {
        "Content-Type":
          "text/html; charset=utf-8",

        "Cache-Control":
          "no-store",
      },
    },
  );
}

export async function GET(
  request:
    NextRequest,
) {
  const token =
    request.nextUrl
      .searchParams
      .get(
        "t",
      )
      ?.trim();

  if (!token) {
    return forbidden(
      "Pedí un nuevo enlace desde WhatsApp.",
    );
  }

  try {
    const {
      payload,
    } =
      await jwtVerify(
        token,
        signingSecret(),
        {
          issuer:
            "fulanitas-store-link",

          audience:
            "fulanitas-store-entry",

          algorithms: [
            "HS256",
          ],
        },
      );

    if (
      payload.companyId
      !== "fulanitas"
    ) {
      throw new Error(
        "INVALID_COMPANY",
      );
    }

    const mode =
      payload.mode
      === "retail"
        ? "retail"
        : payload.mode
          === "wholesale"
            ? "wholesale"
            : null;

    if (!mode) {
      throw new Error(
        "INVALID_MODE",
      );
    }

    const now =
      Math.floor(
        Date.now()
        / 1000,
      );

    /*
     * El token que vino por WhatsApp muere acá.
     * Creamos una sesión independiente,
     * válida durante una hora.
     */
    const sessionToken =
      await new SignJWT({
        companyId:
          "fulanitas",

        scope:
          "store",

        entryMode:
          mode,

        entryJti:
          typeof payload.jti
          === "string"
            ? payload.jti
            : undefined,
      })
        .setProtectedHeader({
          alg:
            "HS256",

          typ:
            "JWT",
        })
        .setIssuer(
          "fulanitas-store",
        )
        .setAudience(
          "fulanitas-storefront",
        )
        .setIssuedAt(
          now,
        )
        .setExpirationTime(
          now
          + STORE_SESSION_SECONDS,
        )
        .setJti(
          crypto.randomUUID(),
        )
        .sign(
          signingSecret(),
        );

    const destination =
      new URL(
        mode === "retail"
          ? "/tienda/minorista"
          : "/tienda/mayorista",
        STORE_PUBLIC_URL,
      );

    /*
     * Conservamos categoría,
     * pero NO conservamos el token.
     */
    const category =
      request.nextUrl
        .searchParams
        .get(
          "categoria",
        )
        ?.trim();

    if (category) {
      destination
        .searchParams
        .set(
          "categoria",
          category,
        );
    }

/* STORE_ACCESS_PRODUCT_SEARCH_V1 */
const requestedProduct =
  request.nextUrl
    .searchParams
    .get(
      "buscar",
    )
    ?.replace(
      /[\u0000-\u001f\u007f]/g,
      "",
    )
    .trim()
    .slice(
      0,
      80,
    );

if (requestedProduct) {
  destination
    .searchParams
    .set(
      "buscar",
      requestedProduct,
    );
}

    const response =
      NextResponse.redirect(
        destination,
        303,
      );

    response.cookies.set(
      STORE_COOKIE,
      sessionToken,
      {
        httpOnly:
          true,

        secure:
          true,

        sameSite:
          "lax",

        path:
          "/tienda",

        maxAge:
          STORE_SESSION_SECONDS,
      },
    );

    response.headers.set(
      "Cache-Control",
      "no-store",
    );

    response.headers.set(
      "Referrer-Policy",
      "no-referrer",
    );

    return response;
  } catch (
    error
  ) {
    console.warn(
      "[STORE ACCESS DENIED]",
      error instanceof Error
        ? error.message
        : "invalid token",
    );

    return forbidden(
      "El enlace venció o no es válido. Volvé al chat y pedí el catálogo nuevamente.",
    );
  }
}
