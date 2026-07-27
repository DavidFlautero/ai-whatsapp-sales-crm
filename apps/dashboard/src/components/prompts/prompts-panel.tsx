export function PromptsPanel() {
  return (
    <div
      className="enterprise-card"
      style={{
        padding:24
      }}
    >
      <div
        style={{
          fontSize:28,
          fontWeight:700
        }}
      >
        AI Prompts
      </div>

      <div
        style={{
          marginTop:20,
          display:"grid",
          gap:18
        }}
      >
        <div>
          <div style={{marginBottom:10}}>
            Sales Prompt
          </div>

          <textarea
            className="enterprise-input"
            rows={8}
            defaultValue="Eres un agente comercial premium especializado en ventas mayoristas..."
          />
        </div>

        <div>
          <div style={{marginBottom:10}}>
            Followup Prompt
          </div>

          <textarea
            className="enterprise-input"
            rows={6}
            defaultValue="Debes recuperar leads fríos con mensajes cortos y naturales..."
          />
        </div>

        <button className="enterprise-button">
          Guardar prompts
        </button>
      </div>
    </div>
  );
}
