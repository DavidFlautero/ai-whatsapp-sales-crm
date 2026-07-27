import { listContacts } from "../crm/crm.repository.js";
import { listConversations, listMessages } from "../conversations/conversation.repository.js";
import { getAnalyticsOverview } from "../analytics/analytics.service.js";

export async function buildCommercialReport() {
  const [contacts, conversations, messages, analytics] = await Promise.all([
    listContacts(),
    listConversations(),
    listMessages(),
    getAnalyticsOverview()
  ]);

  return {
    generatedAt: new Date().toISOString(),
    analytics,
    contacts,
    conversations,
    messages
  };
}

export async function buildContactsCsv() {
  const contacts = await listContacts();

  const header = ["name", "phone", "company", "status", "temperature", "ai_score", "last_message"].join(",");

  const rows = contacts.map((contact: any) =>
    [
      contact.name ?? "",
      contact.phone ?? "",
      contact.company ?? "",
      contact.status ?? "",
      contact.temperature ?? "",
      contact.ai_score ?? "",
      String(contact.last_message ?? "").replaceAll(",", " ")
    ].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")
  );

  return [header, ...rows].join("\n");
}

export async function buildCommercialPdfHtml() {
  const report = await buildCommercialReport();

  return `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Reporte Comercial Fulanitas</title>
  <style>
    body { font-family: Arial, sans-serif; color: #0f172a; padding: 32px; }
    h1 { font-size: 32px; margin-bottom: 4px; }
    .muted { color: #64748b; }
    .grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; margin: 24px 0; }
    .card { border: 1px solid #e2e8f0; border-radius: 14px; padding: 16px; }
    .value { font-size: 28px; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin-top: 24px; }
    th,td { border-bottom: 1px solid #e2e8f0; text-align: left; padding: 10px; }
  </style>
</head>
<body>
  <h1>Reporte Comercial Fulanitas</h1>
  <div class="muted">Generado: ${report.generatedAt}</div>

  <div class="grid">
    <div class="card"><div>Contactos</div><div class="value">${report.analytics.contacts}</div></div>
    <div class="card"><div>Conversaciones</div><div class="value">${report.analytics.conversations}</div></div>
    <div class="card"><div>Mensajes</div><div class="value">${report.analytics.messages}</div></div>
    <div class="card"><div>Pipeline</div><div class="value">USD ${report.analytics.estimatedPipelineUsd}</div></div>
  </div>

  <h2>Contactos recientes</h2>
  <table>
    <thead>
      <tr>
        <th>Nombre</th>
        <th>Teléfono</th>
        <th>Estado</th>
        <th>Temperatura</th>
        <th>Último mensaje</th>
      </tr>
    </thead>
    <tbody>
      ${report.contacts.map((c: any) => `
        <tr>
          <td>${c.name ?? "Cliente WhatsApp"}</td>
          <td>${c.phone ?? ""}</td>
          <td>${c.status ?? "lead"}</td>
          <td>${c.temperature ?? "warm"}</td>
          <td>${c.last_message ?? ""}</td>
        </tr>
      `).join("")}
    </tbody>
  </table>
</body>
</html>
`;
}
