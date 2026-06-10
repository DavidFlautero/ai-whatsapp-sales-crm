export function SettingsPanel() {
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
        Integrations
      </div>

      <div
        style={{
          marginTop:24,
          display:"grid",
          gap:18
        }}
      >
        <div>
          <div style={{marginBottom:8}}>
            WhatsApp Token
          </div>

          <input
            className="enterprise-input"
            defaultValue="••••••••••••"
          />
        </div>

        <div>
          <div style={{marginBottom:8}}>
            Claude API Key
          </div>

          <input
            className="enterprise-input"
            defaultValue="••••••••••••"
          />
        </div>

        <div>
          <div style={{marginBottom:8}}>
            Ninox API Key
          </div>

          <input
            className="enterprise-input"
            placeholder="Ninox key"
          />
        </div>

        <button className="enterprise-button">
          Guardar configuración
        </button>
      </div>
    </div>
  );
}
