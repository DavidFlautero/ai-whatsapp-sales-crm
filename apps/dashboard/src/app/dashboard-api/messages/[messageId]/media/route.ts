import {
  NextResponse,
} from "next/server";

import {
  cookies,
} from "next/headers";

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
  _request: Request,
  context: {
    params:
      Promise<{
        messageId: string;
      }>;
  },
) {
  const {
    messageId,
  } =
    await context.params;

  const cookieStore =
    await cookies();

  const cookieHeader =
    cookieStore
      .getAll()
      .map(
        ({
          name,
          value,
        }) =>
          `${name}=${value}`,
      )
      .join("; ");

  const response =
    await fetch(
      `${apiBaseUrl()}/admin/messages/${encodeURIComponent(messageId)}/media`,
      {
        headers: {
          Accept:
            "*/*",

          ...(cookieHeader
            ? {
                Cookie:
                  cookieHeader,
              }
            : {}),
        },

        cache:
          "no-store",
      },
    );

  if (!response.ok) {
    const payload =
      await response
        .json()
        .catch(
          () => ({
            ok:
              false,

            error:
              "INVALID_MEDIA_RESPONSE",
          }),
        );

    return NextResponse.json(
      payload,
      {
        status:
          response.status,
      },
    );
  }

  const data =
    await response
      .arrayBuffer();

  const headers =
    new Headers();

  for (
    const name
    of [
      "content-type",
      "content-length",
      "content-disposition",
      "cache-control",
    ]
  ) {
    const value =
      response.headers.get(
        name,
      );

    if (value) {
      headers.set(
        name,
        value,
      );
    }
  }

  headers.set(
    "X-Content-Type-Options",
    "nosniff",
  );

  return new NextResponse(
    data,
    {
      status:
        200,

      headers,
    },
  );
}
