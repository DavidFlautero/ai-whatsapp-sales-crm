"use client";

import type {
  GarmentProduct,
  SizeStock,
} from "../_components/catalog.types";

import type {
  StockCell,
} from "../_commerce/commerce.types";

import {
  loadStorage,
  saveStorage,
  seedLocations,
  STORAGE_KEYS,
} from "../_commerce/commerce.storage";

export const CATALOG_STORAGE_KEY =
  "fulanitas_catalog_studio_v2";

export const ORDER_STORAGE_KEY =
  "fulanitas_commerce_orders_v1";

export type CommerceOrderStatus =
  | "draft"
  | "quoted"
  | "confirmed"
  | "awaiting_payment"
  | "paid"
  | "preparing"
  | "packed"
  | "shipped"
  | "delivered"
  | "cancelled";

export type CommerceOrderLine = {
  id: string;
  stockCellId: string;
  productId: string;
  productName: string;
  baseSku: string;
  colorId: string;
  colorName: string;
  colorHex: string;
  size: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  subtotal: number;
};

export type CommerceOrder = {
  id: string;
  number: string;
  customerName: string;
  businessName: string;
  whatsapp: string;
  province: string;
  seller: string;
  priceList: string;
  paymentMethod: string;
  shippingMethod: string;
  notes: string;
  status: CommerceOrderStatus;
  lines: CommerceOrderLine[];
  subtotal: number;
  discount: number;
  shippingCost: number;
  total: number;
  stockReserved: boolean;
  createdAt: string;
  updatedAt: string;
};

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function numeric(value: unknown) {
  const number = Number(value);

  return Number.isFinite(number)
    ? Math.max(0, number)
    : 0;
}

function stockCellFromSize({
  product,
  colorId,
  colorName,
  colorHex,
  size,
  locationId,
}: {
  product: GarmentProduct;
  colorId: string;
  colorName: string;
  colorHex: string;
  size: SizeStock;
  locationId: string;
}): StockCell {
  return {
    id: uid("stock"),
    productId: product.id,
    productName: product.name,
    baseSku: product.baseSku,
    colorId,
    colorName,
    colorHex,
    size: size.size,
    sku: size.sku,
    barcode: size.barcode,
    locationId,
    physical: numeric(size.physical),
    reserved: numeric(size.reserved),
    committed: 0,
    incoming: numeric(size.incoming),
    production: 0,
    damaged: numeric(size.damaged),
    returned: 0,
    minimum: numeric(size.minimum),
    maximum: 9999,
    enabled: size.enabled,
    updatedAt: new Date().toISOString(),
  };
}

export function loadCatalogProducts(): GarmentProduct[] {
  return loadStorage<GarmentProduct[]>(
    CATALOG_STORAGE_KEY,
    [],
  );
}

export function saveCatalogProducts(
  products: GarmentProduct[],
) {
  saveStorage(
    CATALOG_STORAGE_KEY,
    products,
  );
}

export function loadCommerceOrders(): CommerceOrder[] {
  return loadStorage<CommerceOrder[]>(
    ORDER_STORAGE_KEY,
    [],
  );
}

export function saveCommerceOrders(
  orders: CommerceOrder[],
) {
  saveStorage(
    ORDER_STORAGE_KEY,
    orders,
  );
}

export function syncProductToInventory(
  product: GarmentProduct,
  locationId = "location-main",
) {
  const currentStock =
    loadStorage<StockCell[]>(
      STORAGE_KEYS.stock,
      [],
    );

  const productCells =
    product.colorVariants.flatMap(
      (color) =>
        color.sizes
          .filter((size) => size.enabled)
          .map((size) =>
            stockCellFromSize({
              product,
              colorId: color.id,
              colorName: color.name,
              colorHex: color.hex,
              size,
              locationId,
            }),
          ),
    );

  const merged = [...currentStock];

  for (const incoming of productCells) {
    const existingIndex =
      merged.findIndex(
        (cell) =>
          cell.productId ===
            incoming.productId &&
          cell.colorId ===
            incoming.colorId &&
          cell.size === incoming.size &&
          cell.locationId ===
            incoming.locationId,
      );

    if (existingIndex >= 0) {
      const existing =
        merged[existingIndex];

      merged[existingIndex] = {
        ...existing,
        productName:
          incoming.productName,
        baseSku: incoming.baseSku,
        colorName:
          incoming.colorName,
        colorHex:
          incoming.colorHex,
        sku: incoming.sku,
        barcode:
          incoming.barcode,
        physical:
          incoming.physical,
        reserved:
          incoming.reserved,
        incoming:
          incoming.incoming,
        damaged:
          incoming.damaged,
        minimum:
          incoming.minimum,
        enabled:
          incoming.enabled,
        updatedAt:
          new Date().toISOString(),
      };
    } else {
      merged.push(incoming);
    }
  }

  saveStorage(
    STORAGE_KEYS.stock,
    merged,
  );

  const currentLocations =
    loadStorage(
      STORAGE_KEYS.locations,
      [],
    );

  if (currentLocations.length === 0) {
    saveStorage(
      STORAGE_KEYS.locations,
      seedLocations(),
    );
  }

  return productCells.length;
}

export function syncAllProductsToInventory() {
  const products =
    loadCatalogProducts();

  let variants = 0;

  for (const product of products) {
    variants +=
      syncProductToInventory(
        product,
      );
  }

  return variants;
}

export function getAvailableStock(
  cell: StockCell,
) {
  return Math.max(
    0,
    cell.physical -
      cell.reserved -
      cell.committed -
      cell.damaged,
  );
}

export function reserveOrderStock(
  order: CommerceOrder,
) {
  if (order.stockReserved) {
    return order;
  }

  const stock =
    loadStorage<StockCell[]>(
      STORAGE_KEYS.stock,
      [],
    );

  for (const line of order.lines) {
    const cell =
      stock.find(
        (item) =>
          item.id ===
          line.stockCellId,
      );

    if (!cell) {
      throw new Error(
        `No se encontró el SKU ${line.sku}.`,
      );
    }

    const available =
      getAvailableStock(cell);

    if (
      line.quantity >
      available
    ) {
      throw new Error(
        `Stock insuficiente para ${line.productName}, ${line.colorName}, talle ${line.size}. Disponible: ${available}.`,
      );
    }
  }

  const nextStock =
    stock.map((cell) => {
      const line =
        order.lines.find(
          (item) =>
            item.stockCellId ===
            cell.id,
        );

      if (!line) return cell;

      return {
        ...cell,
        reserved:
          cell.reserved +
          line.quantity,
        updatedAt:
          new Date().toISOString(),
      };
    });

  saveStorage(
    STORAGE_KEYS.stock,
    nextStock,
  );

  return {
    ...order,
    stockReserved: true,
    updatedAt:
      new Date().toISOString(),
  };
}

export function releaseOrderStock(
  order: CommerceOrder,
) {
  if (!order.stockReserved) {
    return order;
  }

  const stock =
    loadStorage<StockCell[]>(
      STORAGE_KEYS.stock,
      [],
    );

  const nextStock =
    stock.map((cell) => {
      const line =
        order.lines.find(
          (item) =>
            item.stockCellId ===
            cell.id,
        );

      if (!line) return cell;

      return {
        ...cell,
        reserved: Math.max(
          0,
          cell.reserved -
            line.quantity,
        ),
        updatedAt:
          new Date().toISOString(),
      };
    });

  saveStorage(
    STORAGE_KEYS.stock,
    nextStock,
  );

  return {
    ...order,
    stockReserved: false,
    updatedAt:
      new Date().toISOString(),
  };
}

export function confirmOrderStock(
  order: CommerceOrder,
) {
  if (!order.stockReserved) {
    throw new Error(
      "El pedido debe reservar el stock antes de confirmarlo.",
    );
  }

  const stock =
    loadStorage<StockCell[]>(
      STORAGE_KEYS.stock,
      [],
    );

  const nextStock =
    stock.map((cell) => {
      const line =
        order.lines.find(
          (item) =>
            item.stockCellId ===
            cell.id,
        );

      if (!line) return cell;

      return {
        ...cell,
        physical: Math.max(
          0,
          cell.physical -
            line.quantity,
        ),
        reserved: Math.max(
          0,
          cell.reserved -
            line.quantity,
        ),
        committed:
          cell.committed +
          line.quantity,
        updatedAt:
          new Date().toISOString(),
      };
    });

  saveStorage(
    STORAGE_KEYS.stock,
    nextStock,
  );

  return {
    ...order,
    stockReserved: false,
    status:
      "confirmed" as CommerceOrderStatus,
    updatedAt:
      new Date().toISOString(),
  };
}
