import styles from "./restaurant-shell.module.css";
import {requireModule, type RestaurantModuleKey} from "./restaurant-server";
export default async function RestaurantEditor({module,title,href}:{module:RestaurantModuleKey;title:string;href:string}) {
  await requireModule(module);
  return <><h1>{title}</h1><p>El editor usa los identificadores y datos existentes del restaurante.</p>
    <a href={href} className={styles.linkButton}>Abrir editor existente</a>
    <iframe className={styles.frame} title={title} src={href}/>
  </>;
}
