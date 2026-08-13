const contacts = [
  {
    name:"Carlos Ruiz",
    company:"Distribuidora Norte",
    total:"USD 1200",
    state:"Cliente"
  },
  {
    name:"Laura Gómez",
    company:"Moda Center",
    total:"USD 800",
    state:"Prospecto"
  },
  {
    name:"Miguel Torres",
    company:"Urban Wear",
    total:"USD 300",
    state:"Seguimiento"
  }
];

export function CRMTable() {
  return (
    <div
      className="enterprise-card"
      style={{
        padding:24
      }}
    >
      <div
        style={{
          display:"flex",
          justifyContent:"space-between",
          alignItems:"center"
        }}
      >
        <div
          style={{
            fontSize:28,
            fontWeight:700
          }}
        >
          CRM
        </div>

        <div
          style={{
            display:"flex",
            gap:12
          }}
        >
          <button className="enterprise-button">
            Export PDF
          </button>

          <button className="enterprise-button">
            Export Excel
          </button>
        </div>
      </div>

      <table
        style={{
          width:"100%",
          marginTop:24,
          borderCollapse:"collapse"
        }}
      >
        <thead>
          <tr style={{textAlign:"left"}}>
            <th style={{paddingBottom:14}}>Nombre</th>
            <th style={{paddingBottom:14}}>Empresa</th>
            <th style={{paddingBottom:14}}>Ventas</th>
            <th style={{paddingBottom:14}}>Estado</th>
          </tr>
        </thead>

        <tbody>
          {contacts.map((contact)=>(
            <tr key={contact.name}>
              <td
                style={{
                  padding:"16px 0",
                  borderTop:"1px solid rgba(255,255,255,.06)"
                }}
              >
                {contact.name}
              </td>

              <td
                style={{
                  borderTop:"1px solid rgba(255,255,255,.06)"
                }}
              >
                {contact.company}
              </td>

              <td
                style={{
                  borderTop:"1px solid rgba(255,255,255,.06)"
                }}
              >
                {contact.total}
              </td>

              <td
                style={{
                  borderTop:"1px solid rgba(255,255,255,.06)"
                }}
              >
                {contact.state}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
