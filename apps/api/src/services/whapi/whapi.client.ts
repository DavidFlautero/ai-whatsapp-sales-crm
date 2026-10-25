const DEFAULT_BASE =
  "https://gate.whapi.cloud";


function configuration() {
  const token =
    process.env
      .WHAPI_TOKEN
      ?.trim();


  const baseUrl =
    (
      process.env
        .WHAPI_API_URL
      ||
      DEFAULT_BASE
    )
      .replace(
        /\/+$/,
        "",
      );


  if (
    !token
  ) {
    throw new Error(
      "WHAPI_TOKEN_NOT_CONFIGURED",
    );
  }


  return {
    token,
    baseUrl,
  };
}


async function whapiRequest(
  path: string,
  options: RequestInit = {},
) {
  const {
    token,
    baseUrl,
  } =
    configuration();


  const response =
    await fetch(
      `${baseUrl}${path}`,
      {
        ...options,

        headers: {
          accept:
            "application/json",

          authorization:
            `Bearer ${token}`,

          ...(
            options.body
              ? {
                  "content-type":
                    "application/json",
                }
              : {}
          ),

          ...(
            options.headers
            ?? {}
          ),
        },
      },
    );


  const text =
    await response.text();


  let body:
    unknown =
      null;


  if (
    text
  ) {
    try {
      body =
        JSON.parse(
          text,
        );
    }
    catch {
      body =
        text;
    }
  }


  if (
    !response.ok
  ) {
    throw new Error(
      `WHAPI_HTTP_${response.status}: ${
        typeof body === "string"
          ? body
          : JSON.stringify(
              body,
            )
      }`,
    );
  }


  return body;
}


export async function getWhapiHealth() {
  return whapiRequest(
    "/health",
    {
      method:
        "GET",
    },
  );
}


export async function sendWhapiText(
  to: string,
  body: string,
) {
  const cleanTo =
    String(
      to,
    )
      .trim()
      .replace(
        /[^\d@.\-a-zA-Z]/g,
        "",
      );


  const cleanBody =
    String(
      body,
    ).trim();


  if (
    !cleanTo
    ||
    !cleanBody
  ) {
    throw new Error(
      "WHAPI_TO_AND_BODY_REQUIRED",
    );
  }


  return whapiRequest(
    "/messages/text",
    {
      method:
        "POST",

      body:
        JSON.stringify({
          to:
            cleanTo,

          body:
            cleanBody,
        }),
    },
  );
}
