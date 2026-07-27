import { NextResponse } from "next/server";
import { getSystemStatus } from "../../../../lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const status = await getSystemStatus();

    return NextResponse.json(status, {
      headers: {
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "No se pudo consultar el backend."
      },
      { status: 502 }
    );
  }
}
