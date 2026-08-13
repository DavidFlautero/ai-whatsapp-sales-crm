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

export async function PUT(
  request: NextRequest,
  context: {
    params: Promise<{
      variantId: string;
    }>;
  },
) {
  console.log(
    "[CATALOG DASHBOARD VARIANT IMAGES] request received",
  );

  try {
    const {
      variantId,
    } = await context.params;

    const body =
      await request.json();

    const cookieHeader =
      request.headers.get("cookie")
      ?? "";

    const response =
      await fetch(
        `${apiBaseUrl()}/admin/catalog/variants/${encodeURIComponent(variantId)}/images`,
        {
          method: "PUT",
          headers: {
            "Content-Type":
              "application/json",
            Accept:
              "application/json",
            Cookie:
              cookieHeader,
          },
          body:
            JSON.stringify(body),
          cache:
            "no-store",
        },
      );

    const payload =
      await response
        .json()
        .catch(() => ({
          ok: false,
          error:
            "Respuesta inválida del servidor",
        }));

    return NextResponse.json(
      payload,
      {
        status:
          response.status,
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "No se pudieron guardar las imágenes",
      },
      {
        status: 500,
      },
    );
  }
}
