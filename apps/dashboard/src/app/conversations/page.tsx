import { getAdminOverview } from "../../lib/api";
import { AppShell } from "../../components/app-shell/AppShell";
import { Header } from "../../components/ui/Header";

export default async function ConversationsPage() {
  const data = await getAdminOverview();
  const conversations = data.conversations ?? [];
  const messages = data.messages ?? [];

  return (
    <AppShell>
      <Header kicker="WHATSAPP LIVE CENTER" title="Conversaciones" description="Bandeja de conversaciones reales conectadas a WhatsApp." />
      <section className="grid-main section">
        <div className="card panel">
          <div className="panel-title">Conversaciones activas</div>
          <div className="chat-list" style={{ marginTop: 18 }}>
            {conversations.length === 0 ? <div className="muted">Sin conversaciones.</div> :
              conversations.map((chat: any) => (
                <div className="chat-item" key={chat.id ?? chat.contact_phone}>
                  <div className="avatar">{String(chat.contact_phone).slice(-2)}</div>
                  <div>
                    <strong>{chat.contact_phone}</strong>
                    <div className="muted small">{chat.status ?? "open"}</div>
                    <div style={{ marginTop: 6 }}>{chat.last_message ?? "-"}</div>
                  </div>
                  <span className="temperature warm">lead</span>
                </div>
              ))
            }
          </div>
        </div>

        <div className="card panel">
          <div className="panel-title">Mensajes recientes</div>
          <div className="chat-list" style={{ marginTop: 18 }}>
            {messages.slice(0, 15).map((m: any) => (
              <div className="chat-item" key={m.id ?? `${m.contact_phone}-${m.created_at}`}>
                <div className="avatar">{m.direction === "inbound" ? "IN" : "AI"}</div>
                <div>
                  <strong>{m.contact_phone}</strong>
                  <div className="muted small">{m.direction}</div>
                  <div style={{ marginTop: 6 }}>{m.body}</div>
                </div>
                <span className="temperature warm">WA</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </AppShell>
  );
}
