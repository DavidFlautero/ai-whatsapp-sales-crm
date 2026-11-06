import { NextRequest } from "next/server";
import { menuProxy } from "../../../../components/restaurant-os/menu-proxy";
export async function POST(request: NextRequest) { return menuProxy(request, "catalog", "upload"); }
