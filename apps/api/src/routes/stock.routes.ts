import { Router } from "express";

export const stockRoutes = Router();

stockRoutes.get("/", (_req, res) => {
  res.json({ stock: [] });
});
