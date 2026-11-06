"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import type { RestaurantModules } from "./restaurant-server";
import styles from "./restaurant-shell.module.css";

const entries: { label:string; href:string; module?:keyof RestaurantModules; group:string }[] = [
  {label:"Inicio", href:"/panel", group:"GENERAL"},
  {label:"Conversaciones", href:"/panel/conversaciones", module:"whatsapp", group:"WHATSAPP E IA"},
  {label:"Operador avanzado", href:"/panel/operador", module:"whatsapp", group:"WHATSAPP E IA"},
  {label:"Agente IA", href:"/panel/ia", module:"ai", group:"WHATSAPP E IA"},
  {label:"Pedidos", href:"/panel/pedidos", module:"orders", group:"RESTAURANTE"},
  {label:"Clientes", href:"/panel/clientes", module:"customers", group:"RESTAURANTE"},
  {label:"Menú digital", href:"/panel/menu", module:"catalog", group:"RESTAURANTE"},
  {label:"Códigos QR", href:"/panel/qr", module:"qr", group:"RESTAURANTE"},
  {label:"Plano de mesas", href:"/panel/plano", module:"floorplan", group:"RESTAURANTE"},
  {label:"Integraciones", href:"/panel/integraciones", module:"integrations", group:"SISTEMA"},
];

export default function RestaurantShell({modules, children}:{modules:RestaurantModules;children:ReactNode}) {
  const path = usePathname();
  const router = useRouter();
  let group = "";
  return <div className={styles.app}>
    <aside className={styles.sidebar}>
      <Link href="/panel" className={styles.brand}><span className={styles.logo}>D</span><span><strong>Delibocados</strong><small>NEUROMIND · RESTAURANTE</small></span></Link>
      <nav aria-label="Módulos habilitados">
        {entries.filter(e => !e.module || modules[e.module]).map(e => {
          const head = group !== e.group ? (group=e.group, <div key={`heading-${group}`} className={styles.group}>{group}</div>) : null;
          return <div key={e.href}>{head}<Link className={`${styles.link} ${path===e.href?styles.selected:""}`} href={e.href}>{e.label}</Link></div>;
        })}
      </nav>
      <button type="button" className={styles.logout} onClick={async()=>{
        try {await fetch("/api/restaurant-auth/logout",{method:"POST",credentials:"same-origin"});}
        finally {router.replace("/ingresar");router.refresh();}
      }}>Cerrar sesión</button>
    </aside>
    <div className={styles.content}>
      <header className={styles.top}><span>Panel empresarial</span><span>Delibocados · Colombia</span></header>
      <main className={styles.main}>{children}</main>
    </div>
  </div>;
}
