import {
  NextRequest,
} from "next/server";


export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";


const apiBase =
  (
    process.env
      .INTERNAL_API_URL
    ||
    "http://127.0.0.1:4000"
  )
    .replace(
      /\/+$/,
      "",
    );


export async function GET() {
  try {
    const upstream =
      await fetch(
        `${apiBase}/whapi/health`,
        {
          cache:
            "no-store",
        },
      );


    const text =
      await upstream
        .text();


    return new Response(
      text,
      {
        status:
          upstream.status,

        headers: {
          "content-type":
            upstream.headers
              .get(
                "content-type",
              )
            ??
            "application/json",
        },
      },
    );
  }
  catch (
    error
  ) {
    return Response.json(
      {
        ok:
          false,

        error:
          "WHAPI_INTERNAL_API_UNREACHABLE",

        detail:
          error
          instanceof Error
            ? error.message
            : String(
                error,
              ),
      },
      {
        status:
          502,
      },
    );
  }
}


export async function POST(
  request: NextRequest,
) {
  try {
    const body =
      await request.text();


    const secret =
      request.headers
        .get(
          "x-whapi-secret",
        )
      ??
      "";


    const upstream =
      await fetch(
        `${apiBase}/whapi/webhook`,
        {
          method:
            "POST",

          headers: {
            "content-type":
              request.headers
                .get(
                  "content-type",
                )
              ??
              "application/json",

            "x-whapi-secret":
              secret,
          },

          body,

          cache:
            "no-store",
        },
      );


    const text =
      await upstream
        .text();


    return new Response(
      text,
      {
        status:
          upstream.status,

        headers: {
          "content-type":
            upstream.headers
              .get(
                "content-type",
              )
            ??
            "application/json",
        },
      },
    );
  }
  catch (
    error
  ) {
    return Response.json(
      {
        ok:
          false,

        error:
          "WHAPI_WEBHOOK_FORWARD_FAILED",

        detail:
          error
          instanceof Error
            ? error.message
            : String(
                error,
              ),
      },
      {
        status:
          502,
      },
    );
  }
}
