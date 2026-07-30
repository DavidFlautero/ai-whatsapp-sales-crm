import Link from "next/link";

export function PageHeader({
  kicker,
  title,
  description,
  actions,
}: {
  kicker: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="saas-header">
      <div>
        <span className="saas-kicker">{kicker}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions ? <div className="saas-actions">{actions}</div> : null}
    </header>
  );
}

export function Metric({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "success" | "warning" | "danger";
}) {
  const className = tone ? `saas-${tone}` : undefined;
  return (
    <article className="saas-metric">
      <span>{label}</span>
      <strong className={className}>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

export function SectionHeading({
  title,
  description,
  aside,
}: {
  title: string;
  description?: string;
  aside?: React.ReactNode;
}) {
  return (
    <div className="saas-section-head">
      <div>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {aside}
    </div>
  );
}

export function StatusBadge({
  children,
  tone = "success",
}: {
  children: React.ReactNode;
  tone?: "success" | "pending" | "neutral";
}) {
  return <span className={`saas-badge ${tone === "success" ? "" : tone}`}>{children}</span>;
}

export function ButtonLink({
  href,
  children,
  kind = "secondary",
}: {
  href: string;
  children: React.ReactNode;
  kind?: "primary" | "secondary" | "ghost";
}) {
  return (
    <Link href={href} className={`saas-button ${kind === "secondary" ? "" : kind}`}>
      {children}
    </Link>
  );
}

export function CompanyTabs({ active }: { active: string }) {
  const tabs = [
    ["Resumen", "/platform/companies/fulanitas"],
    ["Branding", "/platform/companies/fulanitas/branding"],
    ["Robot", "/platform/companies/fulanitas/robot"],
    ["Usuarios", "/platform/companies/fulanitas/users"],
    ["Suscripción", "/platform/companies/fulanitas/subscription"],
    ["Actividad", "/platform/companies/fulanitas/activity"],
  ];

  return (
    <nav className="saas-tabs" aria-label="Secciones de Fulanitas">
      {tabs.map(([label, href]) => (
        <Link key={href} href={href} className={active === label ? "is-active" : ""}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
