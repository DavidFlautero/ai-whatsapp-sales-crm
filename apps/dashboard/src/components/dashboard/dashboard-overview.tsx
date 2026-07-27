const metrics = [
  {
    title:"Leads activos",
    value:"128"
  },
  {
    title:"Conversaciones",
    value:"42"
  },
  {
    title:"Conversión",
    value:"18%"
  },
  {
    title:"Ventas",
    value:"USD 4.200"
  }
];

export function DashboardOverview() {
  return (
    <section
      style={{
        display:"grid",
        gridTemplateColumns:"repeat(4,minmax(0,1fr))",
        gap:18
      }}
    >
      {metrics.map((metric)=>(
        <div
          key={metric.title}
          className="enterprise-card"
          style={{padding:24}}
        >
          <div
            style={{
              color:"#94a3b8",
              fontSize:14
            }}
          >
            {metric.title}
          </div>

          <div
            style={{
              marginTop:16,
              fontSize:42,
              fontWeight:700
            }}
          >
            {metric.value}
          </div>
        </div>
      ))}
    </section>
  );
}
