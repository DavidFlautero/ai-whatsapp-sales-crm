"use client";

import type {
  PriceList,
  ProductPrice,
  QuantityRule,
  StockCell,
  StockLocation,
  StockMovement,
  WholesaleCurve,
} from "./commerce.types";

export const STORAGE_KEYS = {
  stock:
    "fulanitas_commerce_stock_v1",
  locations:
    "fulanitas_commerce_locations_v1",
  movements:
    "fulanitas_commerce_movements_v1",
  curves:
    "fulanitas_commerce_curves_v1",
  priceLists:
    "fulanitas_commerce_price_lists_v1",
  prices:
    "fulanitas_commerce_prices_v1",
  quantityRules:
    "fulanitas_commerce_quantity_rules_v1",
};

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export function loadStorage<T>(
  key: string,
  fallback: T,
): T {
  if (
    typeof window === "undefined"
  ) {
    return fallback;
  }

  try {
    const raw =
      window.localStorage.getItem(
        key,
      );

    return raw
      ? (JSON.parse(raw) as T)
      : fallback;
  } catch {
    return fallback;
  }
}

export function saveStorage<T>(
  key: string,
  value: T,
) {
  window.localStorage.setItem(
    key,
    JSON.stringify(value),
  );
}

export function seedLocations(): StockLocation[] {
  return [
    {
      id: "location-main",
      name: "Depósito principal",
      type: "warehouse",
      active: true,
    },
    {
      id: "location-showroom",
      name: "Showroom",
      type: "showroom",
      active: true,
    },
    {
      id: "location-factory",
      name: "Fábrica",
      type: "factory",
      active: true,
    },
    {
      id: "location-transit",
      name: "Mercadería en tránsito",
      type: "transit",
      active: true,
    },
  ];
}

export function seedStock(): StockCell[] {
  const sizes = [
    "36",
    "38",
    "40",
    "42",
    "44",
  ];

  const colors = [
    {
      id: "black",
      name: "Negro",
      hex: "#171717",
      prefix: "NEG",
    },
    {
      id: "stone",
      name: "Azul Stone",
      hex: "#66788c",
      prefix: "AZS",
    },
  ];

  return colors.flatMap(
    (color, colorIndex) =>
      sizes.map(
        (
          size,
          sizeIndex,
        ): StockCell => ({
          id: uid("stock"),
          productId:
            "jean-baggy-tokio",
          productName:
            "Jean Baggy Tokio",
          baseSku:
            "JEAN-BAGGY-TOKIO",
          colorId: color.id,
          colorName: color.name,
          colorHex: color.hex,
          size,
          sku: `JEAN-BAGGY-TOKIO-${color.prefix}-${size}`,
          barcode: "",
          locationId:
            "location-main",
          physical:
            colorIndex === 0
              ? 8 + sizeIndex * 2
              : 5 + sizeIndex,
          reserved:
            sizeIndex % 3,
          committed:
            sizeIndex === 2 ? 2 : 0,
          incoming:
            sizeIndex < 2 ? 5 : 0,
          production:
            sizeIndex > 2 ? 8 : 0,
          damaged: 0,
          returned: 0,
          minimum: 3,
          maximum: 40,
          enabled: true,
          updatedAt:
            new Date().toISOString(),
        }),
      ),
  );
}

export function seedCurves(): WholesaleCurve[] {
  return [
    {
      id: "curve-jean-standard",
      name: "Curva estándar Jean",
      code: "CURVA-JEAN-8",
      description:
        "Curva mayorista estándar de ocho prendas.",
      productId:
        "jean-baggy-tokio",
      category: "Jeans",
      colorMode: "single",
      saleMode: "curve",
      minimumUnits: 8,
      lines: [
        {
          id: uid("line"),
          size: "36",
          quantity: 1,
        },
        {
          id: uid("line"),
          size: "38",
          quantity: 2,
        },
        {
          id: uid("line"),
          size: "40",
          quantity: 2,
        },
        {
          id: uid("line"),
          size: "42",
          quantity: 2,
        },
        {
          id: uid("line"),
          size: "44",
          quantity: 1,
        },
      ],
      active: true,
      createdAt:
        new Date().toISOString(),
      updatedAt:
        new Date().toISOString(),
    },
    {
      id: "curve-pack-six",
      name: "Pack surtido 6 unidades",
      code: "PACK-SURTIDO-6",
      description:
        "Pack general para ventas rápidas por WhatsApp.",
      productId: null,
      category: "General",
      colorMode: "assorted",
      saleMode: "pack",
      minimumUnits: 6,
      lines: [
        {
          id: uid("line"),
          size: "S",
          quantity: 1,
        },
        {
          id: uid("line"),
          size: "M",
          quantity: 2,
        },
        {
          id: uid("line"),
          size: "L",
          quantity: 2,
        },
        {
          id: uid("line"),
          size: "XL",
          quantity: 1,
        },
      ],
      active: true,
      createdAt:
        new Date().toISOString(),
      updatedAt:
        new Date().toISOString(),
    },
  ];
}

export function seedPriceLists(): PriceList[] {
  return [
    {
      id: "list-wholesale",
      name: "Mayorista general",
      code: "MAYORISTA",
      currency: "ARS",
      customerType:
        "wholesaler",
      taxIncluded: true,
      active: true,
    },
    {
      id: "list-transfer",
      name: "Transferencia",
      code: "TRANSFERENCIA",
      currency: "ARS",
      customerType:
        "wholesaler",
      taxIncluded: true,
      active: true,
    },
    {
      id: "list-distributor",
      name: "Distribuidores",
      code: "DISTRIBUIDOR",
      currency: "ARS",
      customerType:
        "distributor",
      taxIncluded: true,
      active: true,
    },
  ];
}

export function seedPrices(): ProductPrice[] {
  return [
    {
      id: "price-jean-baggy",
      productId:
        "jean-baggy-tokio",
      productName:
        "Jean Baggy Tokio",
      baseSku:
        "JEAN-BAGGY-TOKIO",
      cost: 10000,
      wholesale: 18500,
      transfer: 17800,
      cash: 17500,
      distributor: 16200,
      curveUnit: 16900,
      dozenUnit: 15800,
      suggestedRetail: 32000,
      promotional: 0,
      currency: "ARS",
      updatedAt:
        new Date().toISOString(),
    },
  ];
}

export function seedQuantityRules(): QuantityRule[] {
  return [
    {
      id: "rule-3",
      name: "Desde 3 unidades",
      minimumQuantity: 3,
      discountPercent: 3,
      active: true,
    },
    {
      id: "rule-6",
      name: "Desde 6 unidades",
      minimumQuantity: 6,
      discountPercent: 5,
      active: true,
    },
    {
      id: "rule-12",
      name: "Desde 12 unidades",
      minimumQuantity: 12,
      discountPercent: 8,
      active: true,
    },
    {
      id: "rule-24",
      name: "Desde 24 unidades",
      minimumQuantity: 24,
      discountPercent: 12,
      active: true,
    },
  ];
}

export function createMovement(
  partial: Omit<
    StockMovement,
    "id" | "createdAt"
  >,
): StockMovement {
  return {
    ...partial,
    id: uid("movement"),
    createdAt:
      new Date().toISOString(),
  };
}

export function createId(
  prefix: string,
) {
  return uid(prefix);
}
