import type { Request, Response } from "express";
import { listPredictiveProfiles } from "../../services/predictive/predictive-engine.service.js";
import { buildSemanticContext } from "../../services/semantic/semantic-engine.service.js";
import { generateAutonomousRecommendations } from "../../services/autonomous/autonomous-sales.service.js";
import { listTenants } from "../../services/tenant/tenant.service.js";

export async function getFutureDashboard(_req: Request, res: Response) {
  const [
    predictiveProfiles,
    autonomousRecommendations,
    tenants
  ] = await Promise.all([
    listPredictiveProfiles(),
    generateAutonomousRecommendations(),
    listTenants()
  ]);

  const semanticPreview =
    predictiveProfiles.length
      ? await buildSemanticContext(predictiveProfiles[0].contact_phone!)
      : [];

  res.json({
    ok: true,
    predictiveProfiles,
    semanticPreview,
    autonomousRecommendations,
    tenants
  });
}
