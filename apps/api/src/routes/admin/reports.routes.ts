import { Router } from "express";
import { exportContactsCsv, exportReportHtml, getCommercialReport } from "../../controllers/admin/reports.controller.js";

export const adminReportsRoutes = Router();

adminReportsRoutes.get("/reports/commercial", getCommercialReport);
adminReportsRoutes.get("/reports/contacts.csv", exportContactsCsv);
adminReportsRoutes.get("/reports/commercial.html", exportReportHtml);
