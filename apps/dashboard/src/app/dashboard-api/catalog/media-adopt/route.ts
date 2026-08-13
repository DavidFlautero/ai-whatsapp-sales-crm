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
  const body =
    await request.text();


  const response =
    await fetch(
      `${apiBase}/admin/catalog-media/adopt`,
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json",

          Accept:
            "application/json",

          Cookie:
            request.headers
              .get(
                "cookie",
              )
            ?? "",
        },

        body,

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
