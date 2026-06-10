export type Customer = {
  id: string;
  phone: string;
  name?: string;
  city?: string;
};

export type Product = {
  id: string;
  code: string;
  name: string;
  color?: string;
  size?: string;
  stock: number;
};

export type Order = {
  id: string;
  customerId: string;
  status: string;
};
