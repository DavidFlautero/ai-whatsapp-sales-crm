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


export async function DELETE(
  request:
    NextRequest,

  context: {
    params:
      Promise<{
        imageId:
          string;
      }>;
  },
) {
  const {
    imageId,
  } =
    await context.params;


  const response =
    await fetch(
      `${apiBase}/admin/catalog-media/images/${
        encodeURIComponent(
          imageId,
        )
      }`,
      {
        method:
          "DELETE",

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
