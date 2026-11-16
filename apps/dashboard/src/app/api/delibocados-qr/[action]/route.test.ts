import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const previousInstance = process.env.NEXT_PUBLIC_PANEL_INSTANCE;
const previousGate = process.env.DELIBOCADOS_QR_CHECKOUT_ENABLED;

const endpoint = "https://panel.delibocados.online/api/delibocados-qr/order";
const payload = JSON.stringify({
  kind: "table",
  tableId: "b2acdf2a-8892-5ee6-bece-e70413c057c1",
  token: "local-test-placeholder-token-never-used-upstream",
});

function request(
  url = endpoint,
  origin = "https://panel.delibocados.online",
  body = payload,
): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body,
  });
}

const ctx = (action: string) => ({ params: Promise.resolve({ action }) });

beforeEach(() => {
  process.env.NEXT_PUBLIC_PANEL_INSTANCE = "delibocados";
  // In production the dashboard can run with this off while the API has it on.
  process.env.DELIBOCADOS_QR_CHECKOUT_ENABLED = "0";
});

afterEach(() => {
  if (previousInstance === undefined) delete process.env.NEXT_PUBLIC_PANEL_INSTANCE;
  else process.env.NEXT_PUBLIC_PANEL_INSTANCE = previousInstance;
  if (previousGate === undefined) delete process.env.DELIBOCADOS_QR_CHECKOUT_ENABLED;
  else process.env.DELIBOCADOS_QR_CHECKOUT_ENABLED = previousGate;
  vi.unstubAllGlobals();
});

describe("Delibocados QR proxy gate", () => {
  it("forwards an order even when the Next.js process flag is off", async () => {
    const upstream = vi.fn(async (url: string | URL | Request, options?: RequestInit) => {
      expect(String(url)).toBe("http://127.0.0.1:4000/public/delibocados-qr/order");
      expect(options?.method).toBe("POST");
      expect(options?.body).toBe(payload);
      return Response.json({ ok: true, order: { id: "test", number: 1 } }, { status: 201 });
    });
    vi.stubGlobal("fetch", upstream);
    const response = await POST(request(), ctx("order"));
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ ok: true, order: { number: 1 } });
    expect(upstream).toHaveBeenCalledOnce();
  });

  it("preserves a disabled-checkout rejection from the authoritative API", async () => {
    const upstream = vi.fn(async () =>
      Response.json({ ok: false, error: "QR_CHECKOUT_NOT_ENABLED" }, { status: 503 }));
    vi.stubGlobal("fetch", upstream);
    const response = await POST(request(), ctx("order"));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      ok: false,
      error: "QR_CHECKOUT_NOT_ENABLED",
    });
    expect(upstream).toHaveBeenCalledOnce();
  });

  it("rejects requests on the wrong dashboard instance", async () => {
    process.env.NEXT_PUBLIC_PANEL_INSTANCE = "another-tenant";
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);
    const response = await POST(request(), ctx("order"));
    expect(response.status).toBe(503);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("rejects a foreign browser origin without contacting the API", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);
    const response = await POST(request(endpoint, "https://example.org"), ctx("order"));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: "ORIGIN_DENIED" });
    expect(upstream).not.toHaveBeenCalled();
  });

  it("rejects unknown actions and malformed JSON before proxying", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);
    expect((await POST(request(), ctx("rotate"))).status).toBe(404);
    const badJson = await POST(request(endpoint, "https://panel.delibocados.online", "{"), ctx("order"));
    expect(badJson.status).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("rejects oversized JSON before proxying", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);
    const response = await POST(request(endpoint, "https://panel.delibocados.online", JSON.stringify({
      note: "x".repeat(15000),
    })), ctx("order"));
    expect(response.status).toBe(413);
    expect(upstream).not.toHaveBeenCalled();
  });
});
