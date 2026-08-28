export type GarmentStatus =
  | "active"
  | "draft"
  | "preorder"
  | "low_stock"
  | "sale"
  | "discontinued";

export type ImageRole =
  | "cover"
  | "front"
  | "back"
  | "detail"
  | "model"
  | "packaging";

export type ProductImage = {
  id: string;
  url: string;
  name: string;
  role: ImageRole;
  isCover: boolean;
  order: number;
  createdAt: string;
};

export type SizeStock = {
  id: string;
  size: string;
  sku: string;
  barcode: string;
  physical: number;
  reserved: number;
  incoming: number;
  damaged: number;
  minimum: number;
  location: string;
  enabled: boolean;
};

export type ColorVariant = {
  id: string;
  name: string;
  code: string;
  family: string;
  hex: string;
  status: GarmentStatus;
  images: ProductImage[];
  sizes: SizeStock[];
};

export type GarmentProduct = {
  id: string;
  baseSku: string;
  name: string;
  shortDescription: string;
  salesDescription: string;
  whatsappDescription: string;
  category: string;
  subcategory: string;
  collection: string;
  season: string;
  brand: string;
  supplier: string;
  composition: string;
  origin: string;
  status: GarmentStatus;
  price: number;
  currency: string;
  tags: string[];
  colorVariants: ColorVariant[];
  createdAt: string;
  updatedAt: string;
};

export type ApiCatalogProduct = {
  id?: string;
  productId?: string;
  variantId?: string;
  sku?: string;
  baseSku?: string;
  name?: string;
  description?: string;
  category?: string;
  color?: string;
  size?: string;
  price?: number;
  currency?: string;
  stock?: number;
  incoming?: number;
  tags?: string[];
  images?: Array<{
    id?: string;
    url: string;
    name?: string;
    role?: string;
    isCover?: boolean;
    order?: number;
    createdAt?: string;
  }>;
  active?: boolean;
};

export function availableStock(size: SizeStock) {
  return Math.max(
    0,
    size.physical -
      size.reserved -
      size.damaged,
  );
}

export function variantPhysicalStock(
  variant: ColorVariant,
) {
  return variant.sizes.reduce(
    (total, size) =>
      total + size.physical,
    0,
  );
}

export function variantAvailableStock(
  variant: ColorVariant,
) {
  return variant.sizes.reduce(
    (total, size) =>
      total + availableStock(size),
    0,
  );
}

export function productAvailableStock(
  product: GarmentProduct,
) {
  return product.colorVariants.reduce(
    (total, variant) =>
      total +
      variantAvailableStock(variant),
    0,
  );
}
