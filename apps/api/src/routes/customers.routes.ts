import { Router } from "express";

export const customersRoutes = Router();

customersRoutes.get("/", (_req, res) => {
  res.json({ customers: [] });
});
