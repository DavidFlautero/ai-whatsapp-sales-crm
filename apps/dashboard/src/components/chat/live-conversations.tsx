const chats = [
  {
    name:"Carlos Ruiz",
    phone:"+57 3214239755",
    lastMessage:"Quiero precios mayoristas",
    status:"hot"
  },
  {
    name:"Laura Gómez",
    phone:"+57 3011112233",
    lastMessage:"¿Tienen stock?",
    status:"warm"
  },
  {
    name:"Miguel Torres",
    phone:"+54 91188887777",
    lastMessage:"Mándame catálogo",
    status:"cold"
  }
];

export function LiveConversations() {
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
        Live Conversations
      </div>

      <div
        style={{
          marginTop:24,
          display:"grid",
          gap:16
        }}
      >
        {chats.map((chat)=>(
          <div
            key={chat.phone}
            style={{
              display:"flex",
              justifyContent:"space-between",
              alignItems:"center",
              paddingBottom:16,
              borderBottom:"1px solid rgba(255,255,255,.06)"
            }}
          >
            <div>
              <div style={{fontWeight:600}}>
                {chat.name}
              </div>

              <div
                style={{
                  color:"#94a3b8",
                  fontSize:13,
                  marginTop:4
                }}
              >
                {chat.phone}
              </div>

              <div
                style={{
                  marginTop:8,
                  color:"#cbd5e1"
                }}
              >
                {chat.lastMessage}
              </div>
            </div>

            <div
              style={{
                padding:"8px 12px",
                borderRadius:999,
                background:
                  chat.status === "hot"
                    ? "rgba(239,68,68,.18)"
                    : chat.status === "warm"
                    ? "rgba(245,158,11,.18)"
                    : "rgba(59,130,246,.18)"
              }}
            >
              {chat.status}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
