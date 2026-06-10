import type { Request, Response } from "express";
import { listFollowups } from "../../services/followup/followup.service.js";
import { getLearningInsights } from "../../services/learning/learning-engine.service.js";
import { listCampaigns } from "../../services/campaigns/campaign.service.js";

export async function getAdvancedDashboard(_req: Request, res: Response) {
  const [followups, learning, campaigns] = await Promise.all([
    listFollowups(),
    getLearningInsights(),
    listCampaigns()
  ]);

  res.json({
    ok: true,
    followups,
    learning,
    campaigns
  });
}
