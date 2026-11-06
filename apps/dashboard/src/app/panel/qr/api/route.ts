import { NextRequest } from "next/server";
import { menuProxy } from "../../../../components/restaurant-os/menu-proxy";
export async function GET(request: NextRequest) { return menuProxy(request, "qr", "qr"); }
export async function POST(request: NextRequest) { return menuProxy(request, "qr", "qr"); }
