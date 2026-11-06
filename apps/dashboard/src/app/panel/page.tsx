import Link from "next/link";
import { requireRestaurant } from "../../components/restaurant-os/restaurant-server";
import styles from "../../components/restaurant-os/restaurant-shell.module.css";

const cards = [
  {key:"whatsapp", label:"Conversaciones de WhatsApp",href:"/panel/conversaciones",description:"Historial, contactos y bandeja del restaurante"},
  {key:"ai",label:"Configuración del agente IA",href:"/panel/ia",description:"Instrucciones, modelo y parámetros existentes"},
  {key:"orders",label:"Pedidos",href:"/panel/pedidos",description:"Pedidos y estados reales"},
  {key:"customers",label:"Clientes",href:"/panel/clientes",description:"Contactos vinculados al restaurante"},
  {key:"catalog",label:"Menú digital",href:"/panel/menu",description:"Editor, precios y fotografías"},
  {key:"qr",label:"Mesas y códigos QR",href:"/panel/qr",description:"Identificadores y editor existentes"},
  {key:"floorplan",label:"Plano de mesas",href:"/panel/plano",description:"Croquis de mesas y pisos"},
  {key:"integrations",label:"Toteat y POS360",href:"/panel/integraciones",description:"Conectores configurables"},
] as const;

export default async function RestaurantHome() {
  const {modules} = await requireRestaurant();
  const active = cards.filter(c=>modules[c.key]===true);
  return <><h1>Resumen del restaurante</h1><p>Administración de Delibocados. Los servicios se habilitan desde el Superadmin.</p>
    {active.length===0?<div className={styles.card}>No hay módulos disponibles. Revisá la configuración desde Neuromind.</div>:null}
    <div className={styles.cards}>{active.map(c=><Link className={styles.card} key={c.key} href={c.href}><h2>{c.label}</h2><p>{c.description}</p></Link>)}</div>
  </>;
}
