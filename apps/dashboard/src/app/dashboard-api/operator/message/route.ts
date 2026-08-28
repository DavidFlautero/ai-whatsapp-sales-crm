import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  cookies,
} from "next/headers";

function apiBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_API_URL
    ?? "http://127.0.0.1:4000"
  ).replace(/\/+$/, "");
}

export async function POST(
  request: NextRequest,
) {
  const cookieStore =
    await cookies();

  const cookieHeader =
    cookieStore
      .getAll()
      .map(
        ({ name, value }) =>
          `${name}=${value}`,
      )
      .join("; ");

  const body =
    await request.json();

  const response =
    await fetch(
      `${apiBaseUrl()}/admin/operator/message`,
      {
        method:
          "POST",

        headers: {
          Accept:
            "application/json",

          "Content-Type":
            "application/json",

          ...(cookieHeader
            ? {
                Cookie:
                  cookieHeader,
              }
            : {}),
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
        ok:
          false,

        error:
          "INVALID_API_RESPONSE",
      }));

  return NextResponse.json(
    payload,
    {
      status:
        response.status,
    },
  );
}
