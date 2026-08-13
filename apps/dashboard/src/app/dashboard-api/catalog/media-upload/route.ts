import {
  NextRequest,
  NextResponse,
} from "next/server";


export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";


const apiBase =
  (
    process.env
      .INTERNAL_API_URL
    || "http://127.0.0.1:4000"
  )
    .replace(
      /\/+$/,
      "",
    );


export async function POST(
  request:
    NextRequest,
) {
  const contentType =
    request.headers.get(
      "content-type",
    );


  if (!contentType) {
    return NextResponse.json(
      {
        ok:
          false,

        error:
          "CONTENT_TYPE_REQUIRED",
      },
      {
        status:
          400,
      },
    );
  }


  const response =
    await fetch(
      `${apiBase}/admin/catalog-media/images`,
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            contentType,

          Accept:
            "application/json",

          Cookie:
            request.headers
              .get(
                "cookie",
              )
            ?? "",
        },

        body:
          await request
            .arrayBuffer(),

        cache:
          "no-store",
      },
    );


  return new NextResponse(
    await response.text(),
    {
      status:
        response.status,

      headers: {
        "content-type":
          response.headers
            .get(
              "content-type",
            )
          || "application/json",
      },
    },
  );
}
