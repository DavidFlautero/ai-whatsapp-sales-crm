export function Header({
  kicker,
  title,
  description,
  action
}: {
  kicker: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="topbar">
      <div>
        <div className="kicker">{kicker}</div>
        <h1>{title}</h1>
        <p className="subtitle">{description}</p>
      </div>
      {action ? <div className="action-row">{action}</div> : null}
    </div>
  );
}
