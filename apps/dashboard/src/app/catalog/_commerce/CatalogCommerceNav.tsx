"use client";

import Link from "next/link";

import {
  usePathname,
} from "next/navigation";

import "./commerce.css";

const links = [
  {
    href: "/catalog",
    label: "Productos y fotos",
  },
  {
    href: "/catalog/new",
    label: "Crear prenda",
  },
  {
    href: "/catalog/stock",
    label: "Talles y stock",
  },
  {
    href: "/catalog/intake",
    label: "Ingresar mercadería",
  },
  {
    href: "/catalog/curves",
    label: "Curvas y packs",
  },
  {
    href: "/catalog/pricing",
    label: "Precios y listas",
  },
  {
    href: "/orders/new",
    label: "Nuevo pedido",
  },
];

export function CatalogCommerceNav() {
  const pathname =
    usePathname();

  return (
    <nav className="commerce-nav">
      {links.map((link) => {
        const active =
          link.href === "/catalog"
            ? pathname ===
              "/catalog"
            : pathname.startsWith(
                link.href,
              );

        return (
          <Link
            key={link.href}
            href={link.href}
            className={
              active
                ? "active"
                : ""
            }
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
