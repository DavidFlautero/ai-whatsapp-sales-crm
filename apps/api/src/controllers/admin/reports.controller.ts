import type { Request, Response } from "express";
import { buildCommercialPdfHtml, buildCommercialReport, buildContactsCsv } from "../../services/reports/report.service.js";

export async function getCommercialReport(_req: Request, res: Response) {
  const report = await buildCommercialReport();
  res.json({
    ok: true,
    report
  });
}

export async function exportContactsCsv(_req: Request, res: Response) {
  const csv = await buildContactsCsv();

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=crm_contacts.csv");

  res.send(csv);
}

export async function exportReportHtml(_req: Request, res: Response) {
  const html = await buildCommercialPdfHtml();

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
}
