import {
  NextRequest,
  NextResponse,
} from "next/server";


export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";


type Context = {
  params:
    Promise<{
      path: string[];
    }>;
};


function apiOrigin() {
  return (
    process.env.INTERNAL_API_URL
    ||
    process.env.BACKEND_INTERNAL_URL
    ||
    "http://127.0.0.1:4000"
  )
    .replace(
      /\/+$/,
      "",
    )
    .replace(
      /\/api$/,
      "",
    );
}


async function handler(
  request: NextRequest,
  context: Context,
) {
  const {
    path,
  } =
    await context.params;


  const crmPath =
    path
      .map(
        part =>
          encodeURIComponent(
            part,
          ),
      )
      .join(
        "/",
      );


  /*
   * RUTA REAL DEL API CONFIRMADA:
   *
   *   :4000/crm/events/...
   *
   * NO :4000/api/crm/events/...
   */
  const upstreamUrl =
    new URL(
      `${apiOrigin()}/crm/${crmPath}`,
    );


  upstreamUrl.search =
    request.nextUrl.search;


  const headers =
    new Headers(
      request.headers,
    );


  /*
   * Conservamos:
   * cookie
   * authorization
   * x-company-id
   * etc.
   *
   * Quitamos solamente headers de transporte.
   */
  headers.delete(
    "host",
  );

  headers.delete(
    "connection",
  );

  headers.delete(
    "content-length",
  );

  headers.delete(
    "accept-encoding",
  );


  const method =
    request.method
      .toUpperCase();


  let body:
    ArrayBuffer
    | undefined;


  if (
    method !== "GET"
    &&
    method !== "HEAD"
  ) {
    body =
      await request.arrayBuffer();
  }


  try {

    const upstream =
      await fetch(
        upstreamUrl,
        {
          method,

          headers,

          body,

          cache:
            "no-store",

          redirect:
            "manual",
        },
      );


    const responseHeaders =
      new Headers(
        upstream.headers,
      );


    responseHeaders.delete(
      "content-length",
    );

    responseHeaders.delete(
      "content-encoding",
    );

    responseHeaders.delete(
      "transfer-encoding",
    );

    responseHeaders.delete(
      "connection",
    );


    responseHeaders.set(
      "cache-control",
      "no-store, no-cache, must-revalidate",
    );


    responseHeaders.set(
      "x-crm-upstream-path",
      `/crm/${crmPath}`,
    );


    return new NextResponse(
      upstream.body,
      {
        status:
          upstream.status,

        statusText:
          upstream.statusText,

        headers:
          responseHeaders,
      },
    );

  }
  catch (
    error
  ) {

    console.error(
      "[CRM PROXY FAILURE]",
      {
        path:
          crmPath,

        method,

        error,
      },
    );


    return NextResponse.json(
      {
        ok:
          false,

        error:
          "CRM_BACKEND_UNAVAILABLE",

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


export async function GET(
  request: NextRequest,
  context: Context,
) {
  return handler(
    request,
    context,
  );
}


export async function POST(
  request: NextRequest,
  context: Context,
) {
  return handler(
    request,
    context,
  );
}


export async function PATCH(
  request: NextRequest,
  context: Context,
) {
  return handler(
    request,
    context,
  );
}


export async function PUT(
  request: NextRequest,
  context: Context,
) {
  return handler(
    request,
    context,
  );
}


export async function DELETE(
  request: NextRequest,
  context: Context,
) {
  return handler(
    request,
    context,
  );
}


export async function OPTIONS(
  request: NextRequest,
  context: Context,
) {
  return handler(
    request,
    context,
  );
}


export async function HEAD(
  request: NextRequest,
  context: Context,
) {
  return handler(
    request,
    context,
  );
}
