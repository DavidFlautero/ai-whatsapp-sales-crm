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


export async function GET(
  request:
    NextRequest,
) {
  const response =
    await fetch(
      `${apiBase}/admin/catalog-media/gaps`,
      {
        headers: {
          Accept:
            "application/json",

          Cookie:
            request.headers
              .get(
                "cookie",
              )
            ?? "",
        },

        cache:
          "no-store",
      },
    );


  const body =
    await response.text();


  return new NextResponse(
    body,
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
