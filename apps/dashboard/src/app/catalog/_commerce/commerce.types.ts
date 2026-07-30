export type StockLocation = {
  id: string;
  name: string;
  type:
    | "warehouse"
    | "store"
    | "showroom"
    | "factory"
    | "transit";
  active: boolean;
};

export type StockCell = {
  id: string;
  productId: string;
  productName: string;
  baseSku: string;
  colorId: string;
  colorName: string;
  colorHex: string;
  size: string;
  sku: string;
  barcode: string;
  locationId: string;
  physical: number;
  reserved: number;
  committed: number;
  incoming: number;
  production: number;
  damaged: number;
  returned: number;
  minimum: number;
  maximum: number;
  enabled: boolean;
  updatedAt: string;
};

export type StockMovement = {
  id: string;
  stockCellId: string;
  type:
    | "purchase"
    | "production"
    | "sale"
    | "reservation"
    | "release"
    | "return"
    | "damage"
    | "adjustment"
    | "transfer";
  quantity: number;
  previousPhysical: number;
  newPhysical: number;
  reason: string;
  reference: string;
  user: string;
  createdAt: string;
};

export type CurveLine = {
  id: string;
  size: string;
  quantity: number;
};

export type WholesaleCurve = {
  id: string;
  name: string;
  code: string;
  description: string;
  productId: string | null;
  category: string;
  colorMode:
    | "single"
    | "assorted"
    | "customer_choice";
  saleMode:
    | "curve"
    | "half_curve"
    | "pack"
    | "dozen"
    | "bundle";
  minimumUnits: number;
  lines: CurveLine[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PriceList = {
  id: string;
  name: string;
  code: string;
  currency: "ARS" | "USD";
  customerType:
    | "retailer"
    | "wholesaler"
    | "distributor"
    | "vip"
    | "custom";
  taxIncluded: boolean;
  active: boolean;
};

export type ProductPrice = {
  id: string;
  productId: string;
  productName: string;
  baseSku: string;
  cost: number;
  wholesale: number;
  transfer: number;
  cash: number;
  distributor: number;
  curveUnit: number;
  dozenUnit: number;
  suggestedRetail: number;
  promotional: number;
  currency: "ARS" | "USD";
  updatedAt: string;
};

export type QuantityRule = {
  id: string;
  name: string;
  minimumQuantity: number;
  discountPercent: number;
  active: boolean;
};

export function stockAvailable(
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

export function stockProjected(
  cell: StockCell,
) {
  return (
    stockAvailable(cell) +
    cell.incoming +
    cell.production +
    cell.returned
  );
}

export function curveTotalUnits(
  curve: WholesaleCurve,
) {
  return curve.lines.reduce(
    (total, line) =>
      total + line.quantity,
    0,
  );
}
