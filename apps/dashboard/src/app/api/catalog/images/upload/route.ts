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
    const formData =
      await request.formData();

    const cookieHeader =
      request.headers.get("cookie")
      ?? "";

    const response =
      await fetch(
        `${apiBaseUrl()}/admin/catalog/images/upload`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            Cookie: cookieHeader,
          },
          body: formData,
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
            : "No se pudo subir la imagen",
      },
      {
        status: 500,
      },
    );
  }
}
