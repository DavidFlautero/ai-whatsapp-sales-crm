import {
  NextRequest,
  NextResponse,
} from "next/server";

function apiBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_API_URL
    ?? "http://127.0.0.1:4000"
  ).replace(/\/+$/, "");
}

export async function POST(
  request: NextRequest,
) {
  try {
    const body = await request.json();

    const cookieHeader =
      request.headers.get("cookie") ?? "";

    const idempotencyKey =
      request.headers.get(
        "x-idempotency-key",
      )?.trim() ?? "";

    if (
      idempotencyKey.length < 16
      || idempotencyKey.length > 200
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "CATALOG_IDEMPOTENCY_KEY_INVALID",
        },
        {
          status: 400,
        },
      );
    }

    console.log(
      "[DASHBOARD PRODUCT SAVE]",
      {
        hasCookie:
          cookieHeader.length > 0,
        baseSku:
          body?.baseSku ?? null,
        name:
          body?.name ?? null,
        variants:
          Array.isArray(body?.variants)
            ? body.variants.length
            : 0,
      },
    );

    const response = await fetch(
      `${apiBaseUrl()}/admin/catalog/products/full`,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
          Accept: "application/json",
          Cookie: cookieHeader,
          "X-Idempotency-Key":
            idempotencyKey,
        },
        body: JSON.stringify(body),
        cache: "no-store",
      },
    );

    const payload =
      await response.json().catch(
        () => ({
          ok: false,
          error:
            "Respuesta inválida del servidor",
        }),
      );

    console.log(
      "[DASHBOARD PRODUCT RESPONSE]",
      {
        status:
          response.status,
        ok:
          payload?.ok ?? false,
        error:
          payload?.error ?? null,
        issues:
          payload?.issues ?? null,
      },
    );

    return NextResponse.json(
      payload,
      {
        status: response.status,
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "No se pudo crear el producto",
      },
      {
        status: 500,
      },
    );
  }
}
