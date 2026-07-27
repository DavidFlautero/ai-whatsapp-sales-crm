import { listPredictiveProfiles } from "../predictive/predictive-engine.service.js";

export async function generateAutonomousRecommendations() {
  const profiles = await listPredictiveProfiles();

  const recommendations = [];

  for (const profile of profiles.slice(0, 12)) {
    const probability = profile.purchase_probability ?? 50;

    if (probability >= 80) {
      recommendations.push({
        type: "close_sale",
        priority: "high",
        phone: profile.contact_phone,
        recommendation: "Cliente listo para cierre comercial."
      });
    } else if (probability >= 60) {
      recommendations.push({
        type: "followup",
        priority: "medium",
        phone: profile.contact_phone,
        recommendation: "Enviar seguimiento en próximas horas."
      });
    } else {
      recommendations.push({
        type: "nurture",
        priority: "low",
        phone: profile.contact_phone,
        recommendation: "Mantener relación con contenido o catálogo."
      });
    }
  }

  return recommendations;
}
