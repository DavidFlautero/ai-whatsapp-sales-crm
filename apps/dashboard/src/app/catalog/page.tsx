import {
  getAdminOverview,
} from "../../lib/api";
import {
  CatalogStudio,
} from "./_components/CatalogStudio";
import type {
  ApiCatalogProduct,
} from "./_components/catalog.types";

export default async function CatalogPage() {
  const data =
    await getAdminOverview();

  const catalogProducts =
    Array.isArray(
      data.catalogProducts,
    )
      ? (data.catalogProducts as ApiCatalogProduct[])
      : [];

  return (
    <CatalogStudio
      apiProducts={
        catalogProducts
      }
    />
  );
}
