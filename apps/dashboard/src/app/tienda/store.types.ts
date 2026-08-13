export type StoreMode =
  | "wholesale"
  | "retail";

export type StoreImage = {
  id?: string;
  url: string;
  isCover?: boolean;
  order?: number;
};

export type StoreProduct = {
  id: string;
  productId?: string;
  variantId?: string;
  sku: string;
  baseSku: string;
  name: string;
  description: string;
  category: string;
  color: string;
  size: string;
  price: number;
  retailPrice?: number;
  stock: number;
  images: StoreImage[];
  active: boolean;
};

export type CartLine = {
  id: string;
  productId: string;
  variantId?: string;
  sku: string;
  name: string;
  image?: string;
  color: string;
  size: string;
  unitPrice: number;
  quantity: number;
  mode: StoreMode;
};
