import { NextRequest, NextResponse } from "next/server";

const INTERNAL_API = "http://127.0.0.1:4000/admin/restaurant-ops";
const ORIGIN = "https://panel.delibocados.online";
const ALLOWED = /^[a-zA-Z0-9/_-]+$/;

async function forward(
  request: NextRequest,
  context: { params: Promise<{ segments: string[] }> },
  method: "GET" | "POST"
) {
  const { segments } = await context.params;
  const suffix = segments.join("/");
  if (!suffix || !ALLOWED.test(suffix) || suffix.includes("..")) {
    return NextResponse.json({ ok: false, error: "INVALID_ROUTE" }, { status: 400 });
  }
  const cookie = request.headers.get("cookie") ?? "";
  if (!cookie) {
    return NextResponse.json({ ok: false, error: "AUTHENTICATION_REQUIRED" }, { status: 401 });
  }
  if (method === "POST" && request.headers.get("origin") !== ORIGIN) {
    return NextResponse.json({ ok: false, error: "INVALID_ORIGIN" }, { status: 403 });
  }
  let body: string | undefined;
  if (method === "POST") {
    if (Number(request.headers.get("content-length") ?? "0") > 16384) {
      return NextResponse.json({ ok: false, error: "PAYLOAD_TOO_LARGE" }, { status: 413 });
    }
    body = await request.text();
    if (body.length > 16384) {
      return NextResponse.json({ ok: false, error: "PAYLOAD_TOO_LARGE" }, { status: 413 });
    }
  }
  try {
    const query = method === "GET" ? request.nextUrl.search : "";
    const upstream = await fetch(INTERNAL_API + "/" + suffix + query, {
      method,
      headers: {
        Cookie: cookie,
        Accept: "application/json",
        ...(method === "POST" ? { "Content-Type": "application/json" } : {})
      },
      ...(body === undefined ? {} : { body }),
      cache: "no-store",
      signal: AbortSignal.timeout(15000)
    });
    const payload: unknown = await upstream.json().catch(
      () => ({ ok: false, error: "INVALID_BACKEND_RESPONSE" })
    );
    return NextResponse.json(payload, {
      status: upstream.status,
      headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" }
    });
  } catch {
    return NextResponse.json({ ok: false, error: "RESTAURANT_API_UNAVAILABLE" }, { status: 503 });
  }
}
export async function GET(
  request: NextRequest, context: { params: Promise<{ segments: string[] }> }
) {
  return forward(request, context, "GET");
}
export async function POST(
  request: NextRequest, context: { params: Promise<{ segments: string[] }> }
) {
  return forward(request, context, "POST");
}
