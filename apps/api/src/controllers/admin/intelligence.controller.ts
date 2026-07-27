import type { Request, Response } from "express";
import { listGovernanceEvents } from "../../services/governance/agent-governance.service.js";
import { listQualityScores } from "../../services/quality/conversation-quality.service.js";
import { listProducts, upsertProduct } from "../../services/catalog/catalog.repository.js";

export async function getIntelligenceDashboard(_req: Request, res: Response) {
  const [governance, quality, catalog] = await Promise.all([
    listGovernanceEvents(),
    listQualityScores(),
    listProducts()
  ]);

  res.json({
    ok: true,
    governance,
    quality,
    catalog
  });
}

export async function saveCatalogProduct(req: Request, res: Response) {
  const name = String(req.body?.name ?? "").trim();

  if (!name) {
    return res.status(400).json({
      ok: false,
      error: "name is required"
    });
  }

  const product = await upsertProduct({
    sku: req.body?.sku ? String(req.body.sku) : undefined,
    name,
    category: req.body?.category ? String(req.body.category) : undefined,
    color: req.body?.color ? String(req.body.color) : undefined,
    size: req.body?.size ? String(req.body.size) : undefined,
    price: req.body?.price ? Number(req.body.price) : undefined,
    stock: req.body?.stock ? Number(req.body.stock) : 0,
    tags: Array.isArray(req.body?.tags) ? req.body.tags : [],
    description: req.body?.description ? String(req.body.description) : undefined,
    active: true
  });

  res.json({
    ok: true,
    product
  });
}
