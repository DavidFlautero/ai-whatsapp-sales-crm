import {
  NextRequest,
  NextResponse,
} from "next/server";

function apiBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_API_URL
    ?? "http://127.0.0.1:4000"
  ).replace(
    /\/+$/,
    "",
  );
}

export async function GET(
  request:
    NextRequest,
) {
  const cookieHeader =
    request.headers.get(
      "cookie",
    ) ?? "";

  const response =
    await fetch(
      `${apiBaseUrl()}/admin/store-hero`,
      {
        headers: {
          Accept:
            "application/json",

          Cookie:
            cookieHeader,
        },

        cache:
          "no-store",
      },
    );

  return NextResponse.json(
    await response.json(),
    {
      status:
        response.status,
    },
  );
}

export async function POST(
  request:
    NextRequest,
) {
  const cookieHeader =
    request.headers.get(
      "cookie",
    ) ?? "";

  const formData =
    await request.formData();

  const response =
    await fetch(
      `${apiBaseUrl()}/admin/store-hero`,
      {
        method:
          "POST",

        headers: {
          Cookie:
            cookieHeader,
        },

        body:
          formData,

        cache:
          "no-store",
      },
    );

  return NextResponse.json(
    await response.json(),
    {
      status:
        response.status,
    },
  );
}
