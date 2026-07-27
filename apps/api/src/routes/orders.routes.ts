import { Router } from "express";

export const ordersRoutes = Router();

ordersRoutes.get("/", (_req, res) => {
  res.json({ orders: [] });
});
