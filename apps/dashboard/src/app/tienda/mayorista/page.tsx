import {
  getStoreHeroImage,
} from "../store-settings.server";

import StoreClient from "../_components/StoreClient";
import {
  getStoreProducts,
} from "../store.server";

export default async function WholesaleStorePage() {
  const products =
    await getStoreProducts();

  const heroImageUrl =
    await getStoreHeroImage();

  return (
    <StoreClient
      mode="wholesale"
      products={products}
      heroImageUrl={heroImageUrl}
    />
  );
}
