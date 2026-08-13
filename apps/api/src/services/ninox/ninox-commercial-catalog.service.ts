import {
  readNinoxCatalogCache,
  type CachedNinoxCatalogItem,
} from "./ninox-catalog-cache.repository.js";

import {
  getNinoxProductRule,
  type NinoxPriceList,
  type NinoxProductRule,
} from "./ninox-product-rules.repository.js";


export type CustomerSaleMode =
  | "retail"
  | "wholesale";


export type NinoxCommercialVariant = {
  technicalKey: string;

code: string;
  name: string;

  color:
    string | null;

  size:
    string | null;

  available: number;

  unitPrice: number;

  priceList:
    NinoxPriceList | null;
};


export type NinoxWholesaleCurveColor = {
  color: string | null;

  curvesAvailable: number;

  pricePerCurve: number;
};

export type NinoxWholesaleCurve = {
  sizes: string[];

  unitsPerSize: number;

  unitCountPerCurve: number;

  byColor: NinoxWholesaleCurveColor[];
};


export type NinoxCommercialProduct = {
  code: string;
  name: string;

  mode:
    CustomerSaleMode;

  rule:
    NinoxProductRule | null;

  variants:
    NinoxCommercialVariant[];

  wholesaleCurve:
    NinoxWholesaleCurve | null;
};


function priceFromList(
  item:
    CachedNinoxCatalogItem,

  priceList:
    NinoxPriceList | null,
): number {
  if (!priceList) {
    return (
      item.prices.price4
      || item.prices.price1
      || item.prices.price2
      || item.prices.price3
      || item.prices.price5
      || 0
    );
  }

  const key =
    `price${priceList}` as keyof typeof item.prices;

  const value =
    item.prices[key];

  return Number(value) || 0;
}


function variantPriceList(
  item:
    CachedNinoxCatalogItem,

  rule:
    NinoxProductRule | null,

  mode:
    CustomerSaleMode,
): NinoxPriceList | null {
  const size =
    String(
      item.sizeName ?? "",
    ).trim();

  if (rule) {
    const sizeRule =
      rule.sizePriceRules.find(
        (entry) =>
          entry.sizes.includes(
            size,
          ),
      );

    if (sizeRule) {
      return sizeRule.priceList;
    }

    if (
      mode === "wholesale"
      && rule.wholesalePriceList
    ) {
      return rule.wholesalePriceList;
    }

    if (
      mode === "retail"
      && rule.retailPriceList
    ) {
      return rule.retailPriceList;
    }
  }

  return null;
}


function buildWholesaleCurve(
  variants:
    NinoxCommercialVariant[],

  rule:
    NinoxProductRule | null,
): NinoxWholesaleCurve | null {
  const sizes =
    rule?.curveSizes
      ?? [];

  const unitsPerSize =
    rule?.unitsPerSize
      ?? 1;

  if (
    !sizes.length
    || unitsPerSize <= 0
  ) {
    return null;
  }

  const colors =
    [...new Set(
      variants.map(
        (variant) =>
          variant.color,
      ),
    )];

  const byColor =
    colors.map(
      (color) => {
        const colorVariants =
          variants.filter(
            (variant) =>
              variant.color
              === color,
          );

        const availablePerSize =
          sizes.map(
            (size) => {
              const total =
                colorVariants
                  .filter(
                    (variant) =>
                      variant.size
                      === size,
                  )
                  .reduce(
                    (sum, variant) =>
                      sum
                      + variant.available,
                    0,
                  );

              return Math.floor(
                total / unitsPerSize,
              );
            },
          );

        const curvesAvailable =
          availablePerSize.length
            ? Math.min(
                ...availablePerSize,
              )
            : 0;

        const pricePerCurve =
          sizes.reduce(
            (total, size) => {
              const variant =
                colorVariants.find(
                  (entry) =>
                    entry.size
                    === size,
                );

              return total
                + (
                  variant?.unitPrice
                  ?? 0
                )
                * unitsPerSize;
            },
            0,
          );

        return {
          color,
          curvesAvailable,
          pricePerCurve,
        };
      },
    );

  return {
    sizes,
    unitsPerSize,

    unitCountPerCurve:
      sizes.length
      * unitsPerSize,

    byColor,
  };
}


export async function getNinoxCommercialProduct(
  input: {
    companyId: string;
    externalCode: string;
    mode: CustomerSaleMode;
  },
): Promise<NinoxCommercialProduct | null> {
  const code =
    input.externalCode
      .trim()
      .toUpperCase();

  const [
    catalog,
    rule,
  ] =
    await Promise.all([
      readNinoxCatalogCache(),

      getNinoxProductRule(
        input.companyId,
        code,
      ),
    ]);

  const items =
    catalog.filter(
      (item) =>
        item.active
        && item.externalCode
          .trim()
          .toUpperCase()
          === code,
    );

  if (!items.length) {
    return null;
  }

  if (
    rule
    && input.mode === "retail"
    && !rule.retailEnabled
  ) {
    return null;
  }

  if (
    rule
    && input.mode === "wholesale"
    && !rule.wholesaleEnabled
  ) {
    return null;
  }

  const variants =
    items.map(
      (
        item,
      ): NinoxCommercialVariant => {
        const priceList =
          variantPriceList(
            item,
            rule,
            input.mode,
          );

        return {
          technicalKey:
        item.technicalKey,

      code:
            item.externalCode,

          name:
            item.name,

          color:
            item.colorName,

          size:
            item.sizeName,

          available:
            item.availableToBot,

          unitPrice:
            priceFromList(
              item,
              priceList,
            ),

          priceList,
        };
      },
    );

  return {
    code,

    name:
      items[0]?.name
      ?? code,

    mode:
      input.mode,

    rule,

    variants,

    wholesaleCurve:
      input.mode
        === "wholesale"
        ? buildWholesaleCurve(
            variants,
            rule,
          )
        : null,
  };
}
