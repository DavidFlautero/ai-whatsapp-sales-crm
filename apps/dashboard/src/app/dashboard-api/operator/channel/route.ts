import { NextRequest, NextResponse } from "next/server";

const INTERNAL_API = "http://127.0.0.1:4000";
const CHANNEL_PATH = "/admin/operator/channel";

async function forward(request: NextRequest, method: "GET" | "POST") {
  const cookie = request.headers.get("cookie") ?? "";
  if (!cookie) {
    return NextResponse.json({ ok: false, error: "AUTHENTICATION_REQUIRED" }, { status: 401 });
  }

  if (method === "POST") {
    if (request.headers.get("origin") !== "https://panel.delibocados.online") {
      return NextResponse.json({ ok: false, error: "INVALID_ORIGIN" }, { status: 403 });
    }
  }

  let body: string | undefined;
  if (method === "POST") {
    if (Number(request.headers.get("content-length") ?? "0") > 4096) {
      return NextResponse.json({ ok: false, error: "PAYLOAD_TOO_LARGE" }, { status: 413 });
    }
    body = await request.text();
    if (body.length > 4096) {
      return NextResponse.json({ ok: false, error: "PAYLOAD_TOO_LARGE" }, { status: 413 });
    }
  }

  try {
    const response = await fetch(`${INTERNAL_API}${CHANNEL_PATH}`, {
      method,
      headers: {
        Cookie: cookie,
        Accept: "application/json",
        ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
      },
      ...(body === undefined ? {} : { body }),
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });

    const payload = await response.json().catch(() => ({
      ok: false,
      error: "INVALID_API_RESPONSE",
    }));
    return NextResponse.json(payload, {
      status: response.status,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json({
      ok: false,
      error: "CHANNEL_API_UNAVAILABLE",
    }, { status: 503 });
  }
}

export async function GET(request: NextRequest) {
  return forward(request, "GET");
}

export async function POST(request: NextRequest) {
  return forward(request, "POST");
}
