const items = [
  "Dashboard",
  "Conversations",
  "CRM",
  "Prompts",
  "Analytics",
  "Settings"
];

export function Sidebar() {
  return (
    <aside
      style={{
        width:280,
        padding:24,
        borderRight:"1px solid rgba(255,255,255,.08)",
        background:"rgba(2,6,23,.7)"
      }}
    >
      <div>
        <div
          style={{
            color:"#38bdf8",
            fontSize:12,
            letterSpacing:3,
            textTransform:"uppercase"
          }}
        >
          AI SALES OS
        </div>

        <div
          style={{
            fontSize:32,
            fontWeight:700,
            marginTop:10
          }}
        >
          Fulanitas
        </div>
      </div>

      <div
        style={{
          marginTop:40,
          display:"grid",
          gap:8
        }}
      >
        {items.map((item)=>(
          <a
            key={item}
            href="#"
            className="sidebar-link"
          >
            <span>{item}</span>
          </a>
        ))}
      </div>

      <div
        style={{
          marginTop:40,
          padding:18,
          borderRadius:18,
          background:"rgba(255,255,255,.04)",
          border:"1px solid rgba(255,255,255,.06)"
        }}
      >
        <div style={{fontSize:13,color:"#94a3b8"}}>
          Sistema operativo comercial IA
        </div>

        <div
          style={{
            marginTop:10,
            display:"flex",
            alignItems:"center",
            gap:10
          }}
        >
          <div
            style={{
              width:10,
              height:10,
              borderRadius:999,
              background:"#22c55e",
              boxShadow:"0 0 18px #22c55e"
            }}
          />

          <span>online</span>
        </div>
      </div>
    </aside>
  );
}
