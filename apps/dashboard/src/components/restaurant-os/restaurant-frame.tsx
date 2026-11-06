import styles from "./restaurant-shell.module.css";
import {requireModule, type RestaurantModuleKey} from "./restaurant-server";
export default async function RestaurantFrame({module,title,slug}:{module:RestaurantModuleKey;title:string;slug:string}) {
  await requireModule(module);
  return <><h1>{title}</h1><p>Datos y configuración existentes, sin duplicación de registros.</p>
    <iframe className={styles.frame} title={title} src={`/panel/legacy/${slug}`}/>
  </>;
}
