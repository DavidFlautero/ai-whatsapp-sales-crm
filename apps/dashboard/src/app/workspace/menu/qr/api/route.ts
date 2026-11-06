// LEGACY_FLOORPLAN_QR_BRIDGE
// El croquis preexistente usa esta ruta. Se redirige internamente al
// editor QR nativo, que valida sesión, empresa, permisos y obtiene
// los mismos registros desde PostgreSQL a través del backend 3500.
import { NextRequest } from 'next/server';
import { menuProxy } from '../../../../../components/restaurant-os/menu-proxy';

export async function GET(request: NextRequest) {
  return menuProxy(request, 'qr', 'qr');
}

export async function POST(request: NextRequest) {
  return menuProxy(request, 'qr', 'qr');
}
