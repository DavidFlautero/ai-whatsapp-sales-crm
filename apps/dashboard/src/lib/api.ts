import { cookies } from "next/headers";

export type ConnectionStatus =
  | "online"
  | "missing_config"
  | "invalid_credentials"
  | "invalid_config"
  | "degraded"
  | "unreachable"
  | "error";

export type ConnectionCheck = {
  status: ConnectionStatus;
  configured: boolean;
  checkedAt: string;
  latencyMs: number | null;
  message: string;
  details?: Record<string, string | number | boolean | null>;
};

export type SystemStatus = {
  ok: boolean;
  allOnline: boolean;
  timestamp: string;
  services: {
    whatsapp: ConnectionCheck;
    claude: ConnectionCheck;
    supabase: ConnectionCheck;
    ninox: ConnectionCheck;
    audio: ConnectionCheck;
  };
};

function getApiBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_API_URL ??
    "http://127.0.0.1:4000"
  ).replace(/\/+$/, "");
}

async function getForwardedCookieHeader(): Promise<string> {
  const cookieStore = await cookies();

  return cookieStore
    .getAll()
    .map(({ name, value }) => `${name}=${value}`)
    .join("; ");
}

async function authenticatedFetch(
  pathname: string,
  init: RequestInit = {},
) {
  const cookieHeader = await getForwardedCookieHeader();

  const headers = new Headers(init.headers);

  if (cookieHeader) {
    headers.set("Cookie", cookieHeader);
  }

  headers.set("Accept", "application/json");

  return fetch(`${getApiBaseUrl()}${pathname}`, {
    ...init,
    headers,
    cache: "no-store",
  });
}

export async function getAdminOverview() {
  const response = await authenticatedFetch(
    "/admin/overview",
  );

  if (!response.ok) {
    throw new Error(
      `Failed to load admin overview (${response.status})`,
    );
  }

  return response.json();
}

export async function getSystemStatus(): Promise<SystemStatus> {
  const response = await authenticatedFetch(
    "/admin/status",
  );

  if (!response.ok) {
    throw new Error(
      `Failed to load system status (${response.status})`,
    );
  }

  return response.json() as Promise<SystemStatus>;
}

export type CommerceOrder = {
  id: string;
  number: string;
  source?: string;

  customer_id?: string | null;

  commercial_status: string;
  payment_status: string;
  fulfillment_status: string;
  reservation_status: string;

  currency: string;
  subtotal: number | string;
  discount: number | string;
  shipping_cost: number | string;
  total: number | string;
  paid_amount: number | string;

  created_at: string;

  customer?: {
    id?: string;
    name?: string | null;
    business_name?: string | null;
    whatsapp?: string | null;
    email?: string | null;
    city?: string | null;
  } | null;

  reservation?: {
    id?: string;
    status?: string;
    expires_at?: string;
    created_at?: string;
  } | null;

  items?: Array<{
    id?: string;
    sku_snapshot?: string;
    product_name_snapshot?: string;
    color_name_snapshot?: string | null;
    size_snapshot?: string | null;
    quantity?: number;
    unit_price?: number | string;
    subtotal?: number | string;
  }>;

  item_count?: number;
};

export async function getOrders(): Promise<CommerceOrder[]> {
  const response =
    await authenticatedFetch(
      "/orders",
    );

  if (!response.ok) {
    throw new Error(
      `Failed to load orders (${response.status})`,
    );
  }

  const body =
    await response.json();

  return Array.isArray(
    body.orders,
  )
    ? body.orders
    : [];
}


export type CommerceOrderDetail =
  Omit<CommerceOrder, "items"> & {
    shipping_method?: string | null;
    shipping_address?: string | null;
    payment_method?: string | null;
    notes?: string | null;
    updated_at?: string;
    commercial_status: string;

    customer?: {
      id?: string;
      name?: string | null;
      business_name?: string | null;
      whatsapp?: string | null;
      email?: string | null;
      city?: string | null;
      address?: string | null;
    } | null;

    items: Array<{
      id: string;
      sku_snapshot: string;
      product_name_snapshot?: string;
      color_name_snapshot?: string | null;
      size_snapshot?: string | null;
      quantity: number;
      picked_quantity?: number;
      packed_quantity?: number;
      unit_price: number | string;
      subtotal: number | string;
    }>;

    payments: Array<{
      id: string;
      amount: number | string;
      method: string;
      reference?: string | null;
      status: string;
      created_at: string;
    }>;

    events: Array<{
      id: string;
      event_type: string;
      title: string;
      description?: string | null;
      actor_name?: string | null;
      actor_role?: string | null;
      created_at: string;
    }>;

    reservation?: {
      id?: string;
      status?: string;
      expires_at?: string | null;
      created_at?: string;
      converted_at?: string | null;
      released_at?: string | null;
      consumed_at?: string | null;
    } | null;

    shipment?: {
      carrier?: string | null;
      tracking_number?: string | null;
      tracking_url?: string | null;
      status?: string;
      handed_to_carrier_at?: string | null;
      shipped_at?: string | null;
      delivered_at?: string | null;
    } | null;

    packages?: Array<{
      id: string;
      package_number: number;
      total_packages: number;
      weight_kg?: number | string | null;
      dimensions?: string | null;
      package_type?: string | null;
    }>;
  };

export async function getOrderDetail(
  orderId: string,
): Promise<CommerceOrderDetail | null> {
  const response =
    await authenticatedFetch(
      `/orders/${encodeURIComponent(orderId)}`,
    );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(
      `Failed to load order (${response.status})`,
    );
  }

  const body =
    await response.json();

  return body.order
    ?? null;
}
