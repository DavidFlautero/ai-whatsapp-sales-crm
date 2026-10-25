import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = {
  params: Promise<{ path: string[] }>;
};

type Method = "GET" | "POST" | "PATCH" | "DELETE";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function allowed(method: Method, path: string[]) {
  const route = path.join("/");
  const auth = ["auth/login", "auth/register", "auth/logout", "auth/redeem"];

  if (method === "GET") {
    if (route === "me" || route === "venues") return true;

    return (
      path.length === 3 &&
      path[0] === "venues" &&
      UUID.test(path[1]) &&
      ["calendar", "workspace"].includes(path[2])
    );
  }

  if (method === "POST" && auth.includes(route)) {
    return true;
  }

  if (
    path.length < 3 ||
    path[0] !== "venues" ||
    !UUID.test(path[1])
  ) {
    return false;
  }

  if (method === "POST") {
    return path.length === 3 &&
      ["assets", "blocks", "incidents"].includes(path[2]);
  }

  if (method === "PATCH") {
    if (path.length === 3 && path[2] === "details") {
      return true;
    }

    if (
      path.length === 5 &&
      path[2] === "blocks" &&
      UUID.test(path[3]) &&
      path[4] === "cancel"
    ) {
      return true;
    }

    if (
      path.length === 5 &&
      path[2] === "assets" &&
      UUID.test(path[3]) &&
      path[4] === "cover"
    ) {
      return true;
    }

    return (
      path.length === 4 &&
      path[2] === "inquiries" &&
      UUID.test(path[3])
    );
  }

  if (method === "DELETE") {
    return (
      path.length === 4 &&
      path[2] === "assets" &&
      UUID.test(path[3])
    );
  }

  return false;
}

function reject(error: string, status: number) {
  return NextResponse.json(
    { ok: false, error },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

async function forward(
  request: NextRequest,
  context: Context,
  method: Method
) {
  const { path } = await context.params;

  if (!Array.isArray(path) || !allowed(method, path)) {
    return reject("ROUTE_NOT_FOUND", 404);
  }

  if (method !== "GET") {
    const origin = request.headers.get("origin");
    const site = request.headers.get("sec-fetch-site");

    if (
      (origin && origin !== request.nextUrl.origin) ||
      site === "cross-site"
    ) {
      return reject("INVALID_REQUEST_ORIGIN", 403);
    }
  }

  const route = path.join("/");
  const isUpload =
    method === "POST" &&
    path.length === 3 &&
    path[0] === "venues" &&
    path[2] === "assets";

  const contentType = request.headers.get("content-type") || "";

  if (isUpload && !contentType.startsWith("multipart/form-data;")) {
    return reject("MULTIPART_REQUIRED", 415);
  }

  if (
    method !== "GET" &&
    !isUpload &&
    contentType &&
    !contentType.toLowerCase().startsWith("application/json")
  ) {
    return reject("JSON_REQUIRED", 415);
  }

  const length = Number(
    request.headers.get("content-length") || "0"
  );

  if (
    !Number.isFinite(length) ||
    length < 0 ||
    length > (isUpload ? 210 * 1024 * 1024 : 65536)
  ) {
    return reject("REQUEST_TOO_LARGE", 413);
  }

  try {
    const target = new URL(
      `http://127.0.0.1:4000/owner/${route}`
    );
    target.search = request.nextUrl.search;

    const headers = new Headers({
      Accept: "application/json",
    });

    const session =
      request.cookies.get("em_owner_session")?.value;

    if (session) {
      headers.set(
        "Cookie",
        `em_owner_session=${encodeURIComponent(session)}`
      );
    }

    const init: RequestInit & { duplex?: "half" } = {
      method,
      headers,
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(isUpload ? 180000 : 20000),
    };

    if (isUpload) {
      // Transmitir el archivo sin convertirlo a JSON.
      headers.set("Content-Type", contentType);
      init.body = request.body;
      init.duplex = "half";
    } else if (method !== "GET") {
      const body = await request.text();

      if (Buffer.byteLength(body, "utf8") > 65536) {
        return reject("REQUEST_TOO_LARGE", 413);
      }

      headers.set("Content-Type", "application/json");
      init.body = body || "{}";
    }

    const upstream = await fetch(target, init);
    const response = new NextResponse(
      await upstream.text(),
      {
        status: upstream.status,
        headers: {
          "Content-Type":
            upstream.headers.get("content-type") ||
            "application/json; charset=utf-8",
          "Cache-Control": "no-store",
        },
      }
    );

    const cookie = upstream.headers.get("set-cookie");

    if (cookie) {
      response.headers.set("set-cookie", cookie);
    }

    return response;
  } catch (error) {
    console.error(
      "[OWNER PROXY]",
      error instanceof Error ? error.message : "unknown"
    );
    return reject("OWNER_API_UNAVAILABLE", 503);
  }
}

export async function GET(
  request: NextRequest,
  context: Context
) {
  return forward(request, context, "GET");
}

export async function POST(
  request: NextRequest,
  context: Context
) {
  return forward(request, context, "POST");
}

export async function PATCH(
  request: NextRequest,
  context: Context
) {
  return forward(request, context, "PATCH");
}

export async function DELETE(
  request: NextRequest,
  context: Context
) {
  return forward(request, context, "DELETE");
}
