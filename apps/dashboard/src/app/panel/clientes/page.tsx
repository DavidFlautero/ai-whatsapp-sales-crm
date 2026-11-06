import RestaurantData from "../../../components/restaurant-os/restaurant-data";
import {requireModule} from "../../../components/restaurant-os/restaurant-server";
export default async function Page() {await requireModule("customers");return <RestaurantData kind="customers"/>;}
