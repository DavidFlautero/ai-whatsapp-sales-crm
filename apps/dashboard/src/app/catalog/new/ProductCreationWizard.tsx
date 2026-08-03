"use client";

import Link from "next/link";

import {
  useMemo,
  useState,
} from "react";

import {
  AppShell,
} from "../../../components/app-shell/AppShell";

import type {
  ColorVariant,
  GarmentProduct,
  GarmentStatus,
  SizeStock,
} from "../_components/catalog.types";

import type {
  ProductPrice,
} from "../_commerce/commerce.types";

import {
  STORAGE_KEYS,
  loadStorage,
  saveStorage,
} from "../_commerce/commerce.storage";

import {
  loadCatalogProducts,
  saveCatalogProducts,
  syncProductToInventory,
} from "../_inventory/inventory-sync";

import "../_commerce/commerce.css";
import "./product-wizard.css";

const categories = [
  "Jeans",
  "Pantalones",
  "Remeras",
  "Buzos",
  "Camperas",
  "Vestidos",
  "Conjuntos",
  "Shorts",
  "Faldas",
  "Accesorios",
];

const standardSizes = [
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "XXL",
];

const numericSizes = [
  "34",
  "36",
  "38",
  "40",
  "42",
  "44",
  "46",
  "48",
];

const childSizes = [
  "2",
  "4",
  "6",
  "8",
  "10",
  "12",
  "14",
  "16",
];

const presetColors = [
  {
    name: "Negro",
    code: "NEG",
    hex: "#171717",
    family: "Negro",
  },
  {
    name: "Azul Stone",
    code: "AZS",
    hex: "#66788c",
    family: "Azul",
  },
  {
    name: "Crudo",
    code: "CRU",
    hex: "#ded3bc",
    family: "Beige",
  },
  {
    name: "Gris",
    code: "GRS",
    hex: "#777980",
    family: "Gris",
  },
  {
    name: "Rosa",
    code: "ROS",
    hex: "#d89ca8",
    family: "Rosa",
  },
  {
    name: "Verde Militar",
    code: "VML",
    hex: "#58634b",
    family: "Verde",
  },
];

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function slug(value: string) {
  return value
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toUpperCase();
}

function createSize({
  size,
  baseSku,
  colorCode,
}: {
  size: string;
  baseSku: string;
  colorCode: string;
}): SizeStock {
  return {
    id: uid("size"),
    size,
    sku: `${baseSku}-${colorCode}-${slug(
      size,
    )}`,
    barcode: "",
    physical: 0,
    reserved: 0,
    incoming: 0,
    damaged: 0,
    minimum: 2,
    location:
      "Depósito principal",
    enabled: true,
  };
}

function createColor({
  baseSku,
  name,
  code,
  hex,
  family,
  sizes,
}: {
  baseSku: string;
  name: string;
  code: string;
  hex: string;
  family: string;
  sizes: string[];
}): ColorVariant {
  return {
    id: uid("color"),
    name,
    code,
    family,
    hex,
    status: "active",
    images: [],
    sizes: sizes.map((size) =>
      createSize({
        size,
        baseSku,
        colorCode: code,
      }),
    ),
  };
}

export default function ProductCreationWizard() {
  const initialSku = `FUL-${String(
    Date.now(),
  ).slice(-6)}`;

  const [step, setStep] =
    useState(1);

  const [name, setName] =
    useState("");

  const [baseSku, setBaseSku] =
    useState(initialSku);

  const [category, setCategory] =
    useState("Jeans");

  const [
    subcategory,
    setSubcategory,
  ] = useState("");

  const [
    collection,
    setCollection,
  ] = useState(
    "Colección actual",
  );

  const [season, setSeason] =
    useState("Todo el año");

  const [brand, setBrand] =
    useState("Fulanitas");

  const [supplier, setSupplier] =
    useState("");

  const [
    composition,
    setComposition,
  ] = useState("");

  const [description, setDescription] =
    useState("");

  const [
    wholesalePrice,
    setWholesalePrice,
  ] = useState(0);

  const [status, setStatus] =
    useState<GarmentStatus>(
      "active",
    );

  const [sizeSystem, setSizeSystem] =
    useState<
      "letters" | "numeric" | "children"
    >("numeric");

  const [selectedSizes, setSelectedSizes] =
    useState<string[]>(
      numericSizes.slice(1, 6),
    );

  const [colors, setColors] =
    useState<ColorVariant[]>([]);

  const [notice, setNotice] =
    useState("");

  const [saved, setSaved] =
    useState(false);

  const sizeOptions =
    sizeSystem === "letters"
      ? standardSizes
      : sizeSystem === "children"
        ? childSizes
        : numericSizes;

  const totalVariants = useMemo(
    () =>
      colors.reduce(
        (total, color) =>
          total +
          color.sizes.filter(
            (size) => size.enabled,
          ).length,
        0,
      ),
    [colors],
  );

  const totalInitialStock =
    useMemo(
      () =>
        colors.reduce(
          (total, color) =>
            total +
            color.sizes.reduce(
              (sum, size) =>
                sum +
                size.physical,
              0,
            ),
          0,
        ),
      [colors],
    );

  function notify(message: string) {
    setNotice(message);

    window.setTimeout(
      () => setNotice(""),
      2200,
    );
  }

  function updateBaseSku(
    value: string,
  ) {
    const nextSku = slug(value);

    setBaseSku(nextSku);

    setColors((current) =>
      current.map((color) => ({
        ...color,
        sizes: color.sizes.map(
          (size) => ({
            ...size,
            sku: `${nextSku}-${color.code}-${slug(
              size.size,
            )}`,
          }),
        ),
      })),
    );
  }

  function toggleSize(
    size: string,
  ) {
    const exists =
      selectedSizes.includes(size);

    const nextSizes = exists
      ? selectedSizes.filter(
          (item) =>
            item !== size,
        )
      : [...selectedSizes, size];

    setSelectedSizes(nextSizes);

    setColors((current) =>
      current.map((color) => {
        const existing =
          new Map(
            color.sizes.map(
              (item) => [
                item.size,
                item,
              ],
            ),
          );

        return {
          ...color,
          sizes: nextSizes.map(
            (selectedSize) =>
              existing.get(
                selectedSize,
              ) ||
              createSize({
                size: selectedSize,
                baseSku,
                colorCode:
                  color.code,
              }),
          ),
        };
      }),
    );
  }

  function addPresetColor(
    preset: (typeof presetColors)[number],
  ) {
    if (
      colors.some(
        (color) =>
          color.code ===
          preset.code,
      )
    ) {
      notify(
        "Ese color ya está agregado",
      );
      return;
    }

    setColors((current) => [
      ...current,
      createColor({
        baseSku,
        ...preset,
        sizes: selectedSizes,
      }),
    ]);
  }

  function addCustomColor() {
    const color = createColor({
      baseSku,
      name: "Nuevo color",
      code: `COL${colors.length + 1}`,
      family: "Personalizado",
      hex: "#888888",
      sizes: selectedSizes,
    });

    setColors((current) => [
      ...current,
      color,
    ]);
  }

  function updateColor(
    colorId: string,
    field: keyof ColorVariant,
    value: string,
  ) {
    setColors((current) =>
      current.map((color) => {
        if (
          color.id !== colorId
        ) {
          return color;
        }

        const nextColor = {
          ...color,
          [field]: value,
        };

        if (field === "code") {
          const code =
            slug(value).slice(
              0,
              6,
            );

          nextColor.code = code;

          nextColor.sizes =
            color.sizes.map(
              (size) => ({
                ...size,
                sku: `${baseSku}-${code}-${slug(
                  size.size,
                )}`,
              }),
            );
        }

        return nextColor;
      }),
    );
  }

  function removeColor(
    colorId: string,
  ) {
    setColors((current) =>
      current.filter(
        (color) =>
          color.id !== colorId,
      ),
    );
  }

  function updateStock(
    colorId: string,
    sizeId: string,
    field:
      | "physical"
      | "minimum"
      | "incoming",
    value: number,
  ) {
    setColors((current) =>
      current.map((color) =>
        color.id === colorId
          ? {
              ...color,
              sizes:
                color.sizes.map(
                  (size) =>
                    size.id === sizeId
                      ? {
                          ...size,
                          [field]:
                            Math.max(
                              0,
                              value,
                            ),
                        }
                      : size,
                ),
            }
          : color,
      ),
    );
  }

  function validateCurrentStep() {
    if (step === 1) {
      if (!name.trim()) {
        notify(
          "Ingresá el nombre de la prenda",
        );
        return false;
      }

      if (!baseSku.trim()) {
        notify(
          "Ingresá un SKU base",
        );
        return false;
      }

      if (
        !Number.isFinite(
          wholesalePrice,
        )
        || wholesalePrice <= 0
      ) {
        notify(
          "Ingresá el precio mayorista en pesos argentinos",
        );
        return false;
      }
    }

    if (step === 2) {
      if (
        selectedSizes.length === 0
      ) {
        notify(
          "Seleccioná al menos un talle",
        );
        return false;
      }

      if (colors.length === 0) {
        notify(
          "Agregá al menos un color",
        );
        return false;
      }
    }

    return true;
  }

  function nextStep() {
    if (
      !validateCurrentStep()
    ) {
      return;
    }

    setStep((current) =>
      Math.min(4, current + 1),
    );
  }

  function saveProduct() {
    if (
      !name.trim() ||
      colors.length === 0
    ) {
      notify(
        "Completá la información, colores y talles",
      );
      return;
    }

    if (
      !Number.isFinite(
        wholesalePrice,
      )
      || wholesalePrice <= 0
    ) {
      notify(
        "Ingresá el precio mayorista en pesos argentinos",
      );
      return;
    }

    const now =
      new Date().toISOString();

    const product: GarmentProduct = {
      id: uid("product"),
      baseSku,
      name: name.trim(),
      shortDescription:
        description,
      salesDescription:
        description,
      whatsappDescription:
        description,
      category,
      subcategory,
      collection,
      season,
      brand,
      supplier,
      composition,
      origin: "Argentina",
      status,
      tags: [
        category.toLowerCase(),
        subcategory
          .toLowerCase()
          .trim(),
        collection
          .toLowerCase()
          .trim(),
      ].filter(Boolean),
      colorVariants: colors,
      createdAt: now,
      updatedAt: now,
    };

    const existing =
      loadCatalogProducts();

    saveCatalogProducts([
      product,
      ...existing,
    ]);

    const currentPrices =
      loadStorage<ProductPrice[]>(
        STORAGE_KEYS.prices,
        [],
      );

    const productPrice:
      ProductPrice = {
        id: uid("price"),
        productId: product.id,
        productName:
          product.name,
        baseSku:
          product.baseSku,
        cost: 0,
        wholesale:
          wholesalePrice,
        transfer:
          wholesalePrice,
        cash:
          wholesalePrice,
        distributor:
          wholesalePrice,
        curveUnit:
          wholesalePrice,
        dozenUnit:
          wholesalePrice,
        suggestedRetail:
          wholesalePrice,
        promotional: 0,
        currency: "ARS",
        updatedAt: now,
      };

    saveStorage(
      STORAGE_KEYS.prices,
      [
        productPrice,
        ...currentPrices.filter(
          (price) =>
            price.productId
            !== product.id,
        ),
      ],
    );

    const createdCells =
      syncProductToInventory(
        product,
      );

    setSaved(true);

    notify(
      `${product.name} creada a $ ${wholesalePrice.toLocaleString("es-AR")} ARS con ${createdCells} variantes de inventario`,
    );
  }

  return (
    <AppShell>
      <div className="product-wizard-page">
        <header className="commerce-header">
          <div>
            <span className="commerce-kicker">
              FASE 6 · ALTA DE PRENDA
            </span>

            <h1>
              Crear una prenda
            </h1>

            <p>
              Definí el producto, sus
              colores, talles y cantidad
              inicial para incorporarlo
              directamente al inventario.
            </p>
          </div>

          <Link
            href="/catalog"
            className="wizard-back"
          >
            Volver al catálogo
          </Link>
        </header>

        <nav className="wizard-steps">
          {(
            [
              [1, "Información"],
              [2, "Colores y talles"],
              [3, "Inventario inicial"],
              [4, "Revisión"],
            ] as const
          ).map(([stepNumber, label]) => (
            <button
              key={stepNumber}
              type="button"
              className={
                step === stepNumber
                  ? "active"
                  : step > stepNumber
                    ? "complete"
                    : ""
              }
              onClick={() =>
                setStep(stepNumber)
              }
            >
              <i>
                {step > stepNumber
                  ? "✓"
                  : stepNumber}
              </i>

              <span>{label}</span>
            </button>
          ))}
        </nav>

        <section className="wizard-layout">
          <main className="wizard-main">
            {step === 1 ? (
              <section className="wizard-card">
                <div className="wizard-card-heading">
                  <span>
                    PRODUCTO BASE
                  </span>

                  <h2>
                    Información comercial
                  </h2>

                  <p>
                    Estos datos son comunes
                    para todos los colores y
                    talles.
                  </p>
                </div>

                <div className="commerce-form-grid">
                  <label>
                    <span>
                      Nombre de la prenda
                    </span>

                    <input
                      value={name}
                      placeholder="Jean Baggy Tokio"
                      onChange={(event) =>
                        setName(
                          event.target
                            .value,
                        )
                      }
                    />
                  </label>

                  <label>
                    <span>
                      SKU base
                    </span>

                    <input
                      value={baseSku}
                      onChange={(event) =>
                        updateBaseSku(
                          event.target
                            .value,
                        )
                      }
                    />
                  </label>

                  <label>
                    <span>
                      Precio mayorista (ARS)
                    </span>

                    <input
                      type="number"
                      min="1"
                      step="1"
                      inputMode="numeric"
                      value={
                        wholesalePrice
                        || ""
                      }
                      placeholder="18500"
                      onChange={(event) =>
                        setWholesalePrice(
                          Math.max(
                            0,
                            Number(
                              event.target
                                .value,
                            ),
                          ),
                        )
                      }
                    />
                  </label>

                  <label>
                    <span>
                      Categoría
                    </span>

                    <select
                      value={category}
                      onChange={(event) =>
                        setCategory(
                          event.target
                            .value,
                        )
                      }
                    >
                      {categories.map(
                        (item) => (
                          <option
                            key={item}
                          >
                            {item}
                          </option>
                        ),
                      )}
                    </select>
                  </label>

                  <label>
                    <span>
                      Subcategoría
                    </span>

                    <input
                      value={
                        subcategory
                      }
                      placeholder="Baggy, cargo, oversize..."
                      onChange={(event) =>
                        setSubcategory(
                          event.target
                            .value,
                        )
                      }
                    />
                  </label>

                  <label>
                    <span>
                      Colección
                    </span>

                    <input
                      value={collection}
                      onChange={(event) =>
                        setCollection(
                          event.target
                            .value,
                        )
                      }
                    />
                  </label>

                  <label>
                    <span>
                      Temporada
                    </span>

                    <input
                      value={season}
                      onChange={(event) =>
                        setSeason(
                          event.target
                            .value,
                        )
                      }
                    />
                  </label>

                  <label>
                    <span>Marca</span>

                    <input
                      value={brand}
                      onChange={(event) =>
                        setBrand(
                          event.target
                            .value,
                        )
                      }
                    />
                  </label>

                  <label>
                    <span>
                      Proveedor
                    </span>

                    <input
                      value={supplier}
                      onChange={(event) =>
                        setSupplier(
                          event.target
                            .value,
                        )
                      }
                    />
                  </label>

                  <label>
                    <span>
                      Composición
                    </span>

                    <input
                      value={
                        composition
                      }
                      placeholder="98% algodón, 2% elastano"
                      onChange={(event) =>
                        setComposition(
                          event.target
                            .value,
                        )
                      }
                    />
                  </label>

                  <label>
                    <span>Estado</span>

                    <select
                      value={status}
                      onChange={(event) =>
                        setStatus(
                          event.target
                            .value as GarmentStatus,
                        )
                      }
                    >
                      <option value="active">
                        Activo
                      </option>

                      <option value="draft">
                        Borrador
                      </option>

                      <option value="preorder">
                        Preventa
                      </option>

                      <option value="sale">
                        Liquidación
                      </option>
                    </select>
                  </label>

                  <label className="full">
                    <span>
                      Descripción
                    </span>

                    <textarea
                      value={description}
                      placeholder="Descripción comercial de la prenda..."
                      onChange={(event) =>
                        setDescription(
                          event.target
                            .value,
                        )
                      }
                    />
                  </label>
                </div>
              </section>
            ) : null}

            {step === 2 ? (
              <section className="wizard-card">
                <div className="wizard-card-heading">
                  <span>
                    VARIANTES
                  </span>

                  <h2>
                    Colores y talles
                  </h2>

                  <p>
                    Cada combinación generará
                    un SKU individual y una
                    posición en inventario.
                  </p>
                </div>

                <div className="size-system">
                  <button
                    type="button"
                    className={
                      sizeSystem ===
                      "numeric"
                        ? "active"
                        : ""
                    }
                    onClick={() =>
                      setSizeSystem(
                        "numeric",
                      )
                    }
                  >
                    Numéricos
                  </button>

                  <button
                    type="button"
                    className={
                      sizeSystem ===
                      "letters"
                        ? "active"
                        : ""
                    }
                    onClick={() =>
                      setSizeSystem(
                        "letters",
                      )
                    }
                  >
                    Letras
                  </button>

                  <button
                    type="button"
                    className={
                      sizeSystem ===
                      "children"
                        ? "active"
                        : ""
                    }
                    onClick={() =>
                      setSizeSystem(
                        "children",
                      )
                    }
                  >
                    Infantiles
                  </button>
                </div>

                <div className="wizard-size-selector">
                  {sizeOptions.map(
                    (size) => (
                      <button
                        type="button"
                        key={size}
                        className={
                          selectedSizes.includes(
                            size,
                          )
                            ? "active"
                            : ""
                        }
                        onClick={() =>
                          toggleSize(size)
                        }
                      >
                        {size}
                      </button>
                    ),
                  )}
                </div>

                <div className="wizard-divider" />

                <div className="wizard-section-heading">
                  <div>
                    <span>
                      COLORES
                    </span>

                    <h3>
                      Seleccioná los colores
                      disponibles
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={
                      addCustomColor
                    }
                  >
                    + Color personalizado
                  </button>
                </div>

                <div className="color-presets">
                  {presetColors.map(
                    (preset) => (
                      <button
                        key={
                          preset.code
                        }
                        type="button"
                        onClick={() =>
                          addPresetColor(
                            preset,
                          )
                        }
                      >
                        <i
                          style={{
                            background:
                              preset.hex,
                          }}
                        />

                        <span>
                          {preset.name}
                        </span>

                        <small>
                          {preset.code}
                        </small>
                      </button>
                    ),
                  )}
                </div>

                <div className="wizard-color-editor">
                  {colors.map(
                    (color) => (
                      <article
                        key={color.id}
                      >
                        <input
                          type="color"
                          value={color.hex}
                          onChange={(event) =>
                            updateColor(
                              color.id,
                              "hex",
                              event.target
                                .value,
                            )
                          }
                        />

                        <label>
                          <span>
                            Nombre
                          </span>

                          <input
                            value={
                              color.name
                            }
                            onChange={(event) =>
                              updateColor(
                                color.id,
                                "name",
                                event.target
                                  .value,
                              )
                            }
                          />
                        </label>

                        <label>
                          <span>
                            Código
                          </span>

                          <input
                            value={
                              color.code
                            }
                            onChange={(event) =>
                              updateColor(
                                color.id,
                                "code",
                                event.target
                                  .value,
                              )
                            }
                          />
                        </label>

                        <label>
                          <span>
                            Familia
                          </span>

                          <input
                            value={
                              color.family
                            }
                            onChange={(event) =>
                              updateColor(
                                color.id,
                                "family",
                                event.target
                                  .value,
                              )
                            }
                          />
                        </label>

                        <strong>
                          {
                            color.sizes
                              .length
                          }{" "}
                          talles
                        </strong>

                        <button
                          type="button"
                          className="danger"
                          onClick={() =>
                            removeColor(
                              color.id,
                            )
                          }
                        >
                          Eliminar
                        </button>
                      </article>
                    ),
                  )}
                </div>
              </section>
            ) : null}

            {step === 3 ? (
              <section className="wizard-card">
                <div className="wizard-card-heading">
                  <span>
                    INVENTARIO INICIAL
                  </span>

                  <h2>
                    Cantidad por color y talle
                  </h2>

                  <p>
                    La cantidad ingresada quedará
                    disponible para pedidos y
                    control de inventario.
                  </p>
                </div>

                {colors.length === 0 ? (
                  <div className="commerce-empty">
                    <strong>
                      No agregaste colores
                    </strong>

                    <button
                      type="button"
                      onClick={() =>
                        setStep(2)
                      }
                    >
                      Volver a colores
                    </button>
                  </div>
                ) : (
                  <div className="initial-stock-groups">
                    {colors.map(
                      (color) => (
                        <article
                          key={color.id}
                          className="initial-stock-color"
                        >
                          <header>
                            <i
                              style={{
                                background:
                                  color.hex,
                              }}
                            />

                            <div>
                              <strong>
                                {
                                  color.name
                                }
                              </strong>

                              <span>
                                {
                                  color.code
                                }{" "}
                                ·{" "}
                                {
                                  color.sizes
                                    .length
                                }{" "}
                                talles
                              </span>
                            </div>

                            <em>
                              {color.sizes.reduce(
                                (
                                  total,
                                  size,
                                ) =>
                                  total +
                                  size.physical,
                                0,
                              )}{" "}
                              unidades
                            </em>
                          </header>

                          <div className="initial-stock-table-wrap">
                            <table>
                              <thead>
                                <tr>
                                  <th>
                                    Talle
                                  </th>

                                  <th>
                                    SKU
                                  </th>

                                  <th>
                                    Cantidad inicial
                                  </th>

                                  <th>
                                    En tránsito
                                  </th>

                                  <th>
                                    Stock mínimo
                                  </th>
                                </tr>
                              </thead>

                              <tbody>
                                {color.sizes.map(
                                  (size) => (
                                    <tr
                                      key={
                                        size.id
                                      }
                                    >
                                      <td>
                                        <strong>
                                          {
                                            size.size
                                          }
                                        </strong>
                                      </td>

                                      <td>
                                        <code>
                                          {
                                            size.sku
                                          }
                                        </code>
                                      </td>

                                      <td>
                                        <input
                                          type="number"
                                          min="0"
                                          value={
                                            size.physical
                                          }
                                          onChange={(
                                            event,
                                          ) =>
                                            updateStock(
                                              color.id,
                                              size.id,
                                              "physical",
                                              Number(
                                                event
                                                  .target
                                                  .value,
                                              ),
                                            )
                                          }
                                        />
                                      </td>

                                      <td>
                                        <input
                                          type="number"
                                          min="0"
                                          value={
                                            size.incoming
                                          }
                                          onChange={(
                                            event,
                                          ) =>
                                            updateStock(
                                              color.id,
                                              size.id,
                                              "incoming",
                                              Number(
                                                event
                                                  .target
                                                  .value,
                                              ),
                                            )
                                          }
                                        />
                                      </td>

                                      <td>
                                        <input
                                          type="number"
                                          min="0"
                                          value={
                                            size.minimum
                                          }
                                          onChange={(
                                            event,
                                          ) =>
                                            updateStock(
                                              color.id,
                                              size.id,
                                              "minimum",
                                              Number(
                                                event
                                                  .target
                                                  .value,
                                              ),
                                            )
                                          }
                                        />
                                      </td>
                                    </tr>
                                  ),
                                )}
                              </tbody>
                            </table>
                          </div>
                        </article>
                      ),
                    )}
                  </div>
                )}
              </section>
            ) : null}

            {step === 4 ? (
              <section className="wizard-card">
                <div className="wizard-card-heading">
                  <span>
                    REVISIÓN
                  </span>

                  <h2>
                    Confirmar la nueva prenda
                  </h2>

                  <p>
                    Revisá la estructura antes
                    de crear el producto y sus
                    posiciones de inventario.
                  </p>
                </div>

                <div className="wizard-review">
                  <article className="wizard-review-main">
                    <span>
                      {baseSku}
                    </span>

                    <h2>
                      {name ||
                        "Producto sin nombre"}
                    </h2>

                    <p>
                      {category}
                      {subcategory
                        ? ` · ${subcategory}`
                        : ""}
                      {" · "}
                      {collection}
                    </p>

                    <div>
                      <span>
                        Colores
                      </span>

                      <strong>
                        {colors.length}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Variantes SKU
                      </span>

                      <strong>
                        {
                          totalVariants
                        }
                      </strong>
                    </div>

                    <div>
                      <span>
                        Stock inicial
                      </span>

                      <strong>
                        {
                          totalInitialStock
                        }
                      </strong>
                    </div>
                  </article>

                  <div className="wizard-review-colors">
                    {colors.map(
                      (color) => (
                        <article
                          key={color.id}
                        >
                          <header>
                            <i
                              style={{
                                background:
                                  color.hex,
                              }}
                            />

                            <div>
                              <strong>
                                {
                                  color.name
                                }
                              </strong>

                              <span>
                                {
                                  color.code
                                }
                              </span>
                            </div>
                          </header>

                          <div>
                            {color.sizes.map(
                              (size) => (
                                <span
                                  key={
                                    size.id
                                  }
                                >
                                  {
                                    size.size
                                  }{" "}
                                  ×{" "}
                                  {
                                    size.physical
                                  }
                                </span>
                              ),
                            )}
                          </div>
                        </article>
                      ),
                    )}
                  </div>
                </div>

                {saved ? (
                  <div className="wizard-success">
                    <strong>
                      Prenda creada correctamente
                    </strong>

                    <p>
                      El producto ya figura en
                      catálogo y todas las
                      variantes fueron enviadas
                      al inventario.
                    </p>

                    <div>
                      <Link href="/catalog">
                        Ver catálogo
                      </Link>

                      <Link href="/catalog/stock">
                        Ver inventario
                      </Link>

                      <Link href="/orders/new">
                        Crear pedido
                      </Link>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="wizard-save"
                    onClick={saveProduct}
                  >
                    Crear prenda y cargar inventario
                  </button>
                )}
              </section>
            ) : null}

            <footer className="wizard-controls">
              <button
                type="button"
                disabled={step === 1}
                onClick={() =>
                  setStep((current) =>
                    Math.max(
                      1,
                      current - 1,
                    ),
                  )
                }
              >
                ← Anterior
              </button>

              {step < 4 ? (
                <button
                  type="button"
                  className="primary"
                  onClick={nextStep}
                >
                  Continuar →
                </button>
              ) : null}
            </footer>
          </main>

          <aside className="wizard-summary">
            <span>
              RESUMEN DE ALTA
            </span>

            <h3>
              {name ||
                "Nueva prenda"}
            </h3>

            <dl>
              <div>
                <dt>SKU base</dt>
                <dd>{baseSku}</dd>
              </div>

              <div>
                <dt>Categoría</dt>
                <dd>{category}</dd>
              </div>

              <div>
                <dt>Colores</dt>
                <dd>{colors.length}</dd>
              </div>

              <div>
                <dt>Talles</dt>
                <dd>
                  {
                    selectedSizes.length
                  }
                </dd>
              </div>

              <div>
                <dt>Variantes</dt>
                <dd>
                  {totalVariants}
                </dd>
              </div>

              <div>
                <dt>Stock inicial</dt>
                <dd>
                  {
                    totalInitialStock
                  }
                </dd>
              </div>
            </dl>

            <div className="wizard-summary-colors">
              {colors.map(
                (color) => (
                  <span
                    key={color.id}
                  >
                    <i
                      style={{
                        background:
                          color.hex,
                      }}
                    />

                    {color.name}
                  </span>
                ),
              )}
            </div>
          </aside>
        </section>

        {notice ? (
          <div className="commerce-notice">
            {notice}
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
