import { getAdminOverview } from "../../lib/api";
import { AppShell } from "../../components/app-shell/AppShell";
import { Header } from "../../components/ui/Header";

export default async function PromptsPage() {
  const data = await getAdminOverview();
  const prompts = data.prompts ?? [];

  return (
    <AppShell>
      <Header kicker="PROMPT STUDIO" title="Prompts de IA" description="Configuración del comportamiento comercial de cada agente." action={<button className="btn">Guardar cambios</button>} />

      <section className="section card panel">
        <div className="form-grid">
          {prompts.map((prompt: any) => (
            <label key={prompt.type}>
              <div className="muted small" style={{ marginBottom: 8 }}>{prompt.title}</div>
              <textarea className="textarea" defaultValue={prompt.prompt} />
            </label>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
