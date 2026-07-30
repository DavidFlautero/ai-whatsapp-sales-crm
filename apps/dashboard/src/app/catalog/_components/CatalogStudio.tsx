"use client";

import {
  ChangeEvent,
  DragEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AppShell,
} from "../../../components/app-shell/AppShell";
import {
  ApiCatalogProduct,
  availableStock,
  ColorVariant,
  GarmentProduct,
  GarmentStatus,
  ImageRole,
  ProductImage,
  productAvailableStock,
  SizeStock,
  variantAvailableStock,
  variantPhysicalStock,
} from "./catalog.types";
import "./catalog-studio.css";

const STORAGE_KEY =
  "fulanitas_catalog_studio_v2";

const standardSizes = [
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "XXL",
];

const statusLabels: Record<
  GarmentStatus,
  string
> = {
  active: "Activo",
  draft: "Borrador",
  preorder: "Preventa",
  low_stock: "Stock bajo",
  sale: "Liquidación",
  discontinued: "Discontinuado",
};

const imageRoleLabels: Record<
  ImageRole,
  string
> = {
  cover: "Portada",
  front: "Frente",
  back: "Espalda",
  detail: "Detalle",
  model: "Modelo",
  packaging: "Packaging",
};

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

const colorPresets = [
  {
    name: "Negro",
    code: "NEG",
    family: "Negro",
    hex: "#171717",
  },
  {
    name: "Azul Stone",
    code: "AZS",
    family: "Azul",
    hex: "#66788c",
  },
  {
    name: "Crudo",
    code: "CRU",
    family: "Beige",
    hex: "#ded3bc",
  },
  {
    name: "Gris",
    code: "GRS",
    family: "Gris",
    hex: "#74767b",
  },
  {
    name: "Verde Militar",
    code: "VML",
    family: "Verde",
    hex: "#59634b",
  },
  {
    name: "Bordo",
    code: "BOR",
    family: "Rojo",
    hex: "#682f3a",
  },
];

function id(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 9)}`;
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

function createSize(
  size: string,
  baseSku: string,
  colorCode: string,
  physical = 0,
): SizeStock {
  return {
    id: id("size"),
    size,
    sku: [
      baseSku || "PRODUCTO",
      colorCode || "COLOR",
      slug(size),
    ].join("-"),
    barcode: "",
    physical,
    reserved: 0,
    incoming: 0,
    damaged: 0,
    minimum: 2,
    location: "Depósito principal",
    enabled: true,
  };
}

function createColorVariant(
  productSku: string,
  preset = colorPresets[0],
): ColorVariant {
  return {
    id: id("color"),
    name: preset.name,
    code: preset.code,
    family: preset.family,
    hex: preset.hex,
    status: "active",
    images: [],
    sizes: standardSizes.map(
      (size) =>
        createSize(
          size,
          productSku,
          preset.code,
        ),
    ),
  };
}

function createBlankProduct(): GarmentProduct {
  const baseSku = `FUL-${String(
    Date.now(),
  ).slice(-6)}`;

  return {
    id: id("product"),
    baseSku,
    name: "Nuevo producto",
    shortDescription: "",
    salesDescription: "",
    whatsappDescription: "",
    category: "Jeans",
    subcategory: "",
    collection: "Colección actual",
    season: "Todo el año",
    brand: "Fulanitas",
    supplier: "",
    composition: "",
    origin: "Argentina",
    status: "draft",
    tags: [],
    colorVariants: [
      createColorVariant(baseSku),
    ],
    createdAt:
      new Date().toISOString(),
    updatedAt:
      new Date().toISOString(),
  };
}

function importApiProducts(
  apiProducts: ApiCatalogProduct[],
): GarmentProduct[] {
  if (apiProducts.length === 0) {
    const product =
      createBlankProduct();

    product.name =
      "Jean Baggy Tokio";
    product.baseSku =
      "JEAN-BAGGY-TOKIO";
    product.shortDescription =
      "Jean baggy urbano para venta mayorista.";
    product.salesDescription =
      "Modelo amplio de tiro alto, pensado para locales multimarca y revendedores.";
    product.whatsappDescription =
      "Jean Baggy Tokio disponible por talle y color. Consultanos stock mayorista.";
    product.category = "Jeans";
    product.subcategory = "Baggy";
    product.collection =
      "Urban Essentials";
    product.season =
      "Invierno 2026";
    product.status = "active";
    product.tags = [
      "baggy",
      "urbano",
      "mayorista",
    ];

    product.colorVariants = [
      createColorVariant(
        product.baseSku,
        colorPresets[0],
      ),
      createColorVariant(
        product.baseSku,
        colorPresets[1],
      ),
    ];

    return [product];
  }

  return apiProducts.map(
    (source, index) => {
      const baseSku =
        source.sku ||
        `IMPORTADO-${index + 1}`;

      const colorName =
        source.color || "Sin color";

      const preset =
        colorPresets.find(
          (item) =>
            item.name.toLowerCase() ===
            colorName.toLowerCase(),
        ) || {
          name: colorName,
          code:
            slug(colorName).slice(
              0,
              4,
            ) || "COL",
          family: colorName,
          hex: "#787b82",
        };

      const variant =
        createColorVariant(
          baseSku,
          preset,
        );

      const importedSizes = String(
        source.size || "Único",
      )
        .split("/")
        .map((size) => size.trim())
        .filter(Boolean);

      variant.sizes =
        importedSizes.map(
          (size, sizeIndex) =>
            createSize(
              size,
              baseSku,
              preset.code,
              sizeIndex === 0
                ? Number(
                    source.stock || 0,
                  )
                : 0,
            ),
        );

      return {
        id:
          source.id ||
          id("product"),
        baseSku,
        name:
          source.name ||
          "Producto importado",
        shortDescription:
          source.description || "",
        salesDescription:
          source.description || "",
        whatsappDescription:
          source.description || "",
        category:
          source.category ||
          "Sin categoría",
        subcategory: "",
        collection:
          "Catálogo importado",
        season:
          "Todo el año",
        brand: "Fulanitas",
        supplier: "",
        composition: "",
        origin: "Argentina",
        status:
          source.active === false
            ? "draft"
            : "active",
        tags:
          source.tags || [],
        colorVariants: [variant],
        createdAt:
          new Date().toISOString(),
        updatedAt:
          new Date().toISOString(),
      };
    },
  );
}

function fileToDataUrl(
  file: File,
): Promise<string> {
  return new Promise(
    (resolve, reject) => {
      const reader =
        new FileReader();

      reader.onload = () =>
        resolve(
          String(reader.result),
        );

      reader.onerror = () =>
        reject(
          new Error(
            "No se pudo leer la imagen",
          ),
        );

      reader.readAsDataURL(file);
    },
  );
}

type Props = {
  apiProducts: ApiCatalogProduct[];
};

export function CatalogStudio({
  apiProducts,
}: Props) {
  const fileInputRef =
    useRef<HTMLInputElement | null>(
      null,
    );

  const [products, setProducts] =
    useState<GarmentProduct[]>([]);

  const [
    selectedProductId,
    setSelectedProductId,
  ] = useState("");

  const [
    selectedColorId,
    setSelectedColorId,
  ] = useState("");

  const [activeTab, setActiveTab] =
    useState<
      | "general"
      | "colors"
      | "stock"
      | "media"
      | "preview"
    >("general");

  const [search, setSearch] =
    useState("");

  const [
    filterStatus,
    setFilterStatus,
  ] = useState("all");

  const [
    uploadRole,
    setUploadRole,
  ] =
    useState<ImageRole>("front");

  const [
    dragActive,
    setDragActive,
  ] = useState(false);

  const [notice, setNotice] =
    useState("");

  useEffect(() => {
    try {
      const stored =
        localStorage.getItem(
          STORAGE_KEY,
        );

      const initial =
        stored
          ? JSON.parse(stored)
          : importApiProducts(
              apiProducts,
            );

      setProducts(initial);

      if (initial[0]) {
        setSelectedProductId(
          initial[0].id,
        );

        setSelectedColorId(
          initial[0]
            .colorVariants[0]
            ?.id || "",
        );
      }
    } catch {
      const initial =
        importApiProducts(
          apiProducts,
        );

      setProducts(initial);

      if (initial[0]) {
        setSelectedProductId(
          initial[0].id,
        );

        setSelectedColorId(
          initial[0]
            .colorVariants[0]
            ?.id || "",
        );
      }
    }
  }, [apiProducts]);

  const selectedProduct =
    products.find(
      (product) =>
        product.id ===
        selectedProductId,
    ) || null;

  const selectedColor =
    selectedProduct?.colorVariants.find(
      (variant) =>
        variant.id ===
        selectedColorId,
    ) || null;

  const filteredProducts =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return products.filter(
        (product) => {
          const matchesSearch =
            !query ||
            [
              product.name,
              product.baseSku,
              product.category,
              product.collection,
              product.tags.join(" "),
            ].some((value) =>
              value
                .toLowerCase()
                .includes(query),
            );

          const matchesStatus =
            filterStatus === "all" ||
            product.status ===
              filterStatus;

          return (
            matchesSearch &&
            matchesStatus
          );
        },
      );
    }, [
      products,
      search,
      filterStatus,
    ]);

  const metrics = useMemo(() => {
    const variants =
      products.reduce(
        (total, product) =>
          total +
          product.colorVariants
            .length,
        0,
      );

    const skus =
      products.reduce(
        (total, product) =>
          total +
          product.colorVariants.reduce(
            (sum, variant) =>
              sum +
              variant.sizes
                .filter(
                  (size) =>
                    size.enabled,
                )
                .length,
            0,
          ),
        0,
      );

    const images =
      products.reduce(
        (total, product) =>
          total +
          product.colorVariants.reduce(
            (sum, variant) =>
              sum +
              variant.images.length,
            0,
          ),
        0,
      );

    const available =
      products.reduce(
        (total, product) =>
          total +
          productAvailableStock(
            product,
          ),
        0,
      );

    return {
      products: products.length,
      variants,
      skus,
      images,
      available,
    };
  }, [products]);

  function showNotice(
    message: string,
  ) {
    setNotice(message);

    window.setTimeout(
      () => setNotice(""),
      2400,
    );
  }

  function saveCatalog() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(products),
      );

      showNotice(
        "Catálogo guardado en este navegador",
      );
    } catch {
      showNotice(
        "El navegador no pudo guardar todas las imágenes. Reducí su tamaño.",
      );
    }
  }

  function updateProduct(
    updater: (
      product: GarmentProduct,
    ) => GarmentProduct,
  ) {
    setProducts((current) =>
      current.map((product) =>
        product.id ===
        selectedProductId
          ? {
              ...updater(product),
              updatedAt:
                new Date().toISOString(),
            }
          : product,
      ),
    );
  }

  function addProduct() {
    const product =
      createBlankProduct();

    setProducts((current) => [
      product,
      ...current,
    ]);

    setSelectedProductId(
      product.id,
    );

    setSelectedColorId(
      product.colorVariants[0].id,
    );

    setActiveTab("general");

    showNotice(
      "Nuevo producto creado",
    );
  }

  function duplicateProduct() {
    if (!selectedProduct) return;

    const copy: GarmentProduct = {
      ...structuredClone(
        selectedProduct,
      ),
      id: id("product"),
      baseSku: `${selectedProduct.baseSku}-COPIA`,
      name: `${selectedProduct.name} copia`,
      status: "draft",
      createdAt:
        new Date().toISOString(),
      updatedAt:
        new Date().toISOString(),
    };

    copy.colorVariants =
      copy.colorVariants.map(
        (variant) => ({
          ...variant,
          id: id("color"),
          images:
            variant.images.map(
              (image) => ({
                ...image,
                id: id("image"),
              }),
            ),
          sizes:
            variant.sizes.map(
              (size) => ({
                ...size,
                id: id("size"),
              }),
            ),
        }),
      );

    setProducts((current) => [
      copy,
      ...current,
    ]);

    setSelectedProductId(copy.id);

    setSelectedColorId(
      copy.colorVariants[0]?.id ||
        "",
    );

    showNotice(
      "Producto duplicado",
    );
  }

  function deleteProduct() {
    if (
      !selectedProduct ||
      !window.confirm(
        `¿Eliminar ${selectedProduct.name}?`,
      )
    ) {
      return;
    }

    const remaining =
      products.filter(
        (product) =>
          product.id !==
          selectedProduct.id,
      );

    setProducts(remaining);

    setSelectedProductId(
      remaining[0]?.id || "",
    );

    setSelectedColorId(
      remaining[0]
        ?.colorVariants[0]?.id || "",
    );

    showNotice(
      "Producto eliminado",
    );
  }

  function addColor() {
    if (!selectedProduct) return;

    const unusedPreset =
      colorPresets.find(
        (preset) =>
          !selectedProduct.colorVariants.some(
            (variant) =>
              variant.code ===
              preset.code,
          ),
      ) || colorPresets[0];

    const variant =
      createColorVariant(
        selectedProduct.baseSku,
        unusedPreset,
      );

    updateProduct(
      (product) => ({
        ...product,
        colorVariants: [
          ...product.colorVariants,
          variant,
        ],
      }),
    );

    setSelectedColorId(
      variant.id,
    );

    setActiveTab("colors");

    showNotice(
      "Nueva variante de color creada",
    );
  }

  function updateColor(
    updater: (
      color: ColorVariant,
    ) => ColorVariant,
  ) {
    updateProduct(
      (product) => ({
        ...product,
        colorVariants:
          product.colorVariants.map(
            (color) =>
              color.id ===
              selectedColorId
                ? updater(color)
                : color,
          ),
      }),
    );
  }

  function duplicateColor() {
    if (
      !selectedProduct ||
      !selectedColor
    ) {
      return;
    }

    const copy: ColorVariant = {
      ...structuredClone(
        selectedColor,
      ),
      id: id("color"),
      name: `${selectedColor.name} copia`,
      code: `${selectedColor.code}C`,
      images:
        selectedColor.images.map(
          (image) => ({
            ...image,
            id: id("image"),
          }),
        ),
      sizes:
        selectedColor.sizes.map(
          (size) => ({
            ...size,
            id: id("size"),
            sku: `${size.sku}-C`,
          }),
        ),
    };

    updateProduct(
      (product) => ({
        ...product,
        colorVariants: [
          ...product.colorVariants,
          copy,
        ],
      }),
    );

    setSelectedColorId(copy.id);

    showNotice(
      "Color y matriz duplicados",
    );
  }

  function deleteColor() {
    if (
      !selectedProduct ||
      !selectedColor
    ) {
      return;
    }

    if (
      selectedProduct
        .colorVariants.length <= 1
    ) {
      showNotice(
        "El producto necesita al menos un color",
      );
      return;
    }

    if (
      !window.confirm(
        `¿Eliminar la variante ${selectedColor.name}?`,
      )
    ) {
      return;
    }

    const remaining =
      selectedProduct.colorVariants.filter(
        (variant) =>
          variant.id !==
          selectedColor.id,
      );

    updateProduct(
      (product) => ({
        ...product,
        colorVariants: remaining,
      }),
    );

    setSelectedColorId(
      remaining[0]?.id || "",
    );

    showNotice(
      "Variante eliminada",
    );
  }

  function updateSize(
    sizeId: string,
    field: keyof SizeStock,
    value:
      | string
      | number
      | boolean,
  ) {
    updateColor(
      (color) => ({
        ...color,
        sizes: color.sizes.map(
          (size) =>
            size.id === sizeId
              ? {
                  ...size,
                  [field]: value,
                }
              : size,
        ),
      }),
    );
  }

  function addSize() {
    if (
      !selectedProduct ||
      !selectedColor
    ) {
      return;
    }

    const size =
      window.prompt(
        "Ingresá el nuevo talle",
        "Único",
      );

    if (!size?.trim()) return;

    updateColor(
      (color) => ({
        ...color,
        sizes: [
          ...color.sizes,
          createSize(
            size.trim(),
            selectedProduct.baseSku,
            selectedColor.code,
          ),
        ],
      }),
    );

    showNotice(
      `Talle ${size.trim()} agregado`,
    );
  }

  async function processFiles(
    files: FileList | File[],
  ) {
    if (!selectedColor) return;

    const accepted =
      Array.from(files).filter(
        (file) =>
          file.type.startsWith(
            "image/",
          ),
      );

    if (accepted.length === 0) {
      showNotice(
        "Seleccioná archivos de imagen",
      );
      return;
    }

    const maxFiles =
      accepted.slice(0, 12);

    const images =
      await Promise.all(
        maxFiles.map(
          async (
            file,
            index,
          ): Promise<ProductImage> => ({
            id: id("image"),
            url:
              await fileToDataUrl(
                file,
              ),
            name: file.name,
            role:
              selectedColor
                .images.length ===
                0 &&
              index === 0
                ? "cover"
                : uploadRole,
            isCover:
              selectedColor
                .images.length ===
                0 &&
              index === 0,
            order:
              selectedColor
                .images.length +
              index,
            createdAt:
              new Date().toISOString(),
          }),
        ),
      );

    updateColor(
      (color) => ({
        ...color,
        images: [
          ...color.images,
          ...images,
        ],
      }),
    );

    showNotice(
      `${images.length} imagen(es) agregadas a ${selectedColor.name}`,
    );
  }

  function handleFileInput(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const files =
      event.target.files;

    if (files) {
      void processFiles(files);
    }

    event.target.value = "";
  }

  function handleDrop(
    event: DragEvent<HTMLDivElement>,
  ) {
    event.preventDefault();
    setDragActive(false);

    void processFiles(
      event.dataTransfer.files,
    );
  }

  function setCover(
    imageId: string,
  ) {
    updateColor(
      (color) => ({
        ...color,
        images: color.images.map(
          (image) => ({
            ...image,
            isCover:
              image.id === imageId,
            role:
              image.id === imageId
                ? "cover"
                : image.role ===
                    "cover"
                  ? "front"
                  : image.role,
          }),
        ),
      }),
    );

    showNotice(
      "Nueva portada seleccionada",
    );
  }

  function updateImageRole(
    imageId: string,
    role: ImageRole,
  ) {
    updateColor(
      (color) => ({
        ...color,
        images: color.images.map(
          (image) =>
            image.id === imageId
              ? {
                  ...image,
                  role,
                }
              : image,
        ),
      }),
    );
  }

  function removeImage(
    imageId: string,
  ) {
    updateColor(
      (color) => {
        const remaining =
          color.images.filter(
            (image) =>
              image.id !==
              imageId,
          );

        if (
          remaining.length > 0 &&
          !remaining.some(
            (image) =>
              image.isCover,
          )
        ) {
          remaining[0] = {
            ...remaining[0],
            isCover: true,
            role: "cover",
          };
        }

        return {
          ...color,
          images: remaining,
        };
      },
    );
  }

  function moveImage(
    imageId: string,
    direction: -1 | 1,
  ) {
    updateColor(
      (color) => {
        const images = [
          ...color.images,
        ];

        const index =
          images.findIndex(
            (image) =>
              image.id === imageId,
          );

        const target =
          index + direction;

        if (
          index < 0 ||
          target < 0 ||
          target >= images.length
        ) {
          return color;
        }

        [
          images[index],
          images[target],
        ] = [
          images[target],
          images[index],
        ];

        return {
          ...color,
          images:
            images.map(
              (image, order) => ({
                ...image,
                order,
              }),
            ),
        };
      },
    );
  }

  function copyImagesToAnotherColor() {
    if (
      !selectedProduct ||
      !selectedColor
    ) {
      return;
    }

    const target =
      selectedProduct.colorVariants.find(
        (variant) =>
          variant.id !==
          selectedColor.id,
      );

    if (!target) {
      showNotice(
        "Creá otro color para copiar las imágenes",
      );
      return;
    }

    updateProduct(
      (product) => ({
        ...product,
        colorVariants:
          product.colorVariants.map(
            (variant) =>
              variant.id ===
              target.id
                ? {
                    ...variant,
                    images:
                      selectedColor.images.map(
                        (
                          image,
                          index,
                        ) => ({
                          ...image,
                          id: id(
                            "image",
                          ),
                          isCover:
                            index === 0,
                          role:
                            index === 0
                              ? "cover"
                              : image.role,
                        }),
                      ),
                  }
                : variant,
          ),
      }),
    );

    showNotice(
      `Imágenes copiadas a ${target.name}`,
    );
  }

  const coverImage =
    selectedColor?.images.find(
      (image) => image.isCover,
    ) ||
    selectedColor?.images[0] ||
    null;

  return (
    <AppShell>
      <div className="catalog-studio">
        <header className="catalog-topbar">
          <div>
            <span className="catalog-eyebrow">
              FULANITAS COMMERCE OS
            </span>

            <h1>
              Catálogo de indumentaria
            </h1>

            <p>
              Productos, colores,
              talles, SKU, stock y
              contenido visual en un
              único centro de control.
            </p>
          </div>

          <div className="catalog-top-actions">
            <button
              type="button"
              className="catalog-button secondary"
              onClick={saveCatalog}
            >
              Guardar borrador
            </button>

            <button
              type="button"
              className="catalog-button primary"
              onClick={addProduct}
            >
              + Nuevo producto
            </button>
          </div>
        </header>

        <section className="catalog-metrics">
          <article>
            <span>Productos</span>
            <strong>
              {metrics.products}
            </strong>
            <small>
              Fichas comerciales
            </small>
          </article>

          <article>
            <span>Colores</span>
            <strong>
              {metrics.variants}
            </strong>
            <small>
              Variantes activas
            </small>
          </article>

          <article>
            <span>SKU</span>
            <strong>
              {metrics.skus}
            </strong>
            <small>
              Combinaciones por talle
            </small>
          </article>

          <article>
            <span>Stock disponible</span>
            <strong>
              {metrics.available}
            </strong>
            <small>
              Unidades vendibles
            </small>
          </article>

          <article>
            <span>Imágenes</span>
            <strong>
              {metrics.images}
            </strong>
            <small>
              Organizadas por color
            </small>
          </article>
        </section>

        <section className="catalog-workspace">
          <aside className="catalog-products-panel">
            <div className="catalog-panel-header">
              <div>
                <span>
                  PRODUCTOS
                </span>
                <strong>
                  Catálogo maestro
                </strong>
              </div>

              <button
                type="button"
                onClick={addProduct}
                aria-label="Agregar producto"
              >
                +
              </button>
            </div>

            <div className="catalog-filters">
              <input
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value,
                  )
                }
                placeholder="Buscar producto, SKU o categoría"
              />

              <select
                value={filterStatus}
                onChange={(event) =>
                  setFilterStatus(
                    event.target.value,
                  )
                }
              >
                <option value="all">
                  Todos los estados
                </option>

                {Object.entries(
                  statusLabels,
                ).map(
                  ([value, label]) => (
                    <option
                      key={value}
                      value={value}
                    >
                      {label}
                    </option>
                  ),
                )}
              </select>
            </div>

            <div className="catalog-product-list">
              {filteredProducts.map(
                (product) => {
                  const firstImage =
                    product.colorVariants
                      .flatMap(
                        (variant) =>
                          variant.images,
                      )
                      .find(
                        (image) =>
                          image.isCover,
                      ) ||
                    product.colorVariants
                      .flatMap(
                        (variant) =>
                          variant.images,
                      )[0];

                  return (
                    <button
                      key={product.id}
                      type="button"
                      className={
                        product.id ===
                        selectedProductId
                          ? "catalog-product-row active"
                          : "catalog-product-row"
                      }
                      onClick={() => {
                        setSelectedProductId(
                          product.id,
                        );

                        setSelectedColorId(
                          product
                            .colorVariants[0]
                            ?.id || "",
                        );
                      }}
                    >
                      <span className="catalog-product-thumb">
                        {firstImage ? (
                          <img
                            src={
                              firstImage.url
                            }
                            alt=""
                          />
                        ) : (
                          product.name
                            .slice(0, 1)
                            .toUpperCase()
                        )}
                      </span>

                      <span className="catalog-product-copy">
                        <strong>
                          {product.name}
                        </strong>

                        <small>
                          {
                            product.baseSku
                          }
                        </small>

                        <em>
                          {
                            product
                              .colorVariants
                              .length
                          }{" "}
                          colores ·{" "}
                          {productAvailableStock(
                            product,
                          )}{" "}
                          disponibles
                        </em>
                      </span>

                      <span
                        className={`catalog-status ${product.status}`}
                      >
                        {
                          statusLabels[
                            product.status
                          ]
                        }
                      </span>
                    </button>
                  );
                },
              )}
            </div>
          </aside>

          <main className="catalog-editor">
            {!selectedProduct ? (
              <div className="catalog-empty">
                <strong>
                  No hay productos
                </strong>

                <p>
                  Creá el primer producto
                  para comenzar.
                </p>

                <button
                  type="button"
                  className="catalog-button primary"
                  onClick={addProduct}
                >
                  Crear producto
                </button>
              </div>
            ) : (
              <>
                <div className="catalog-editor-heading">
                  <div className="catalog-heading-product">
                    <div className="catalog-heading-visual">
                      {coverImage ? (
                        <img
                          src={
                            coverImage.url
                          }
                          alt=""
                        />
                      ) : (
                        selectedProduct.name
                          .slice(0, 1)
                          .toUpperCase()
                      )}
                    </div>

                    <div>
                      <span>
                        {
                          selectedProduct.baseSku
                        }
                      </span>

                      <h2>
                        {
                          selectedProduct.name
                        }
                      </h2>

                      <p>
                        {
                          selectedProduct.category
                        }
                        {selectedProduct.subcategory
                          ? ` · ${selectedProduct.subcategory}`
                          : ""}
                        {" · "}
                        {
                          selectedProduct.collection
                        }
                      </p>
                    </div>
                  </div>

                  <div className="catalog-editor-actions">
                    <button
                      type="button"
                      onClick={
                        duplicateProduct
                      }
                    >
                      Duplicar
                    </button>

                    <button
                      type="button"
                      className="danger"
                      onClick={
                        deleteProduct
                      }
                    >
                      Eliminar
                    </button>
                  </div>
                </div>

                <nav className="catalog-tabs">
                  {[
                    [
                      "general",
                      "Información",
                    ],
                    [
                      "colors",
                      "Colores",
                    ],
                    [
                      "stock",
                      "Talles y stock",
                    ],
                    [
                      "media",
                      "Fotos por color",
                    ],
                    [
                      "preview",
                      "Previsualización",
                    ],
                  ].map(
                    ([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        className={
                          activeTab ===
                          value
                            ? "active"
                            : ""
                        }
                        onClick={() =>
                          setActiveTab(
                            value as typeof activeTab,
                          )
                        }
                      >
                        {label}
                      </button>
                    ),
                  )}
                </nav>

                {activeTab ===
                "general" ? (
                  <section className="catalog-section">
                    <div className="catalog-section-title">
                      <div>
                        <span>
                          PRODUCTO BASE
                        </span>
                        <h3>
                          Información comercial
                        </h3>
                      </div>

                      <span className="catalog-section-note">
                        La información general
                        se comparte entre todos
                        los colores.
                      </span>
                    </div>

                    <div className="catalog-form-grid">
                      <label>
                        <span>
                          Nombre comercial
                        </span>
                        <input
                          value={
                            selectedProduct.name
                          }
                          onChange={(
                            event,
                          ) =>
                            updateProduct(
                              (
                                product,
                              ) => ({
                                ...product,
                                name:
                                  event
                                    .target
                                    .value,
                              }),
                            )
                          }
                        />
                      </label>

                      <label>
                        <span>
                          SKU base
                        </span>
                        <input
                          value={
                            selectedProduct.baseSku
                          }
                          onChange={(
                            event,
                          ) =>
                            updateProduct(
                              (
                                product,
                              ) => ({
                                ...product,
                                baseSku:
                                  slug(
                                    event
                                      .target
                                      .value,
                                  ),
                              }),
                            )
                          }
                        />
                      </label>

                      <label>
                        <span>
                          Categoría
                        </span>
                        <select
                          value={
                            selectedProduct.category
                          }
                          onChange={(
                            event,
                          ) =>
                            updateProduct(
                              (
                                product,
                              ) => ({
                                ...product,
                                category:
                                  event
                                    .target
                                    .value,
                              }),
                            )
                          }
                        >
                          {categories.map(
                            (
                              category,
                            ) => (
                              <option
                                key={
                                  category
                                }
                              >
                                {
                                  category
                                }
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
                            selectedProduct.subcategory
                          }
                          placeholder="Baggy, cargo, oversize..."
                          onChange={(
                            event,
                          ) =>
                            updateProduct(
                              (
                                product,
                              ) => ({
                                ...product,
                                subcategory:
                                  event
                                    .target
                                    .value,
                              }),
                            )
                          }
                        />
                      </label>

                      <label>
                        <span>
                          Colección
                        </span>
                        <input
                          value={
                            selectedProduct.collection
                          }
                          onChange={(
                            event,
                          ) =>
                            updateProduct(
                              (
                                product,
                              ) => ({
                                ...product,
                                collection:
                                  event
                                    .target
                                    .value,
                              }),
                            )
                          }
                        />
                      </label>

                      <label>
                        <span>
                          Temporada
                        </span>
                        <input
                          value={
                            selectedProduct.season
                          }
                          onChange={(
                            event,
                          ) =>
                            updateProduct(
                              (
                                product,
                              ) => ({
                                ...product,
                                season:
                                  event
                                    .target
                                    .value,
                              }),
                            )
                          }
                        />
                      </label>

                      <label>
                        <span>
                          Marca
                        </span>
                        <input
                          value={
                            selectedProduct.brand
                          }
                          onChange={(
                            event,
                          ) =>
                            updateProduct(
                              (
                                product,
                              ) => ({
                                ...product,
                                brand:
                                  event
                                    .target
                                    .value,
                              }),
                            )
                          }
                        />
                      </label>

                      <label>
                        <span>
                          Proveedor
                        </span>
                        <input
                          value={
                            selectedProduct.supplier
                          }
                          placeholder="Proveedor o fábrica"
                          onChange={(
                            event,
                          ) =>
                            updateProduct(
                              (
                                product,
                              ) => ({
                                ...product,
                                supplier:
                                  event
                                    .target
                                    .value,
                              }),
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
                            selectedProduct.composition
                          }
                          placeholder="98% algodón, 2% elastano"
                          onChange={(
                            event,
                          ) =>
                            updateProduct(
                              (
                                product,
                              ) => ({
                                ...product,
                                composition:
                                  event
                                    .target
                                    .value,
                              }),
                            )
                          }
                        />
                      </label>

                      <label>
                        <span>
                          Origen
                        </span>
                        <input
                          value={
                            selectedProduct.origin
                          }
                          onChange={(
                            event,
                          ) =>
                            updateProduct(
                              (
                                product,
                              ) => ({
                                ...product,
                                origin:
                                  event
                                    .target
                                    .value,
                              }),
                            )
                          }
                        />
                      </label>

                      <label>
                        <span>
                          Estado
                        </span>
                        <select
                          value={
                            selectedProduct.status
                          }
                          onChange={(
                            event,
                          ) =>
                            updateProduct(
                              (
                                product,
                              ) => ({
                                ...product,
                                status:
                                  event
                                    .target
                                    .value as GarmentStatus,
                              }),
                            )
                          }
                        >
                          {Object.entries(
                            statusLabels,
                          ).map(
                            ([
                              value,
                              label,
                            ]) => (
                              <option
                                key={
                                  value
                                }
                                value={
                                  value
                                }
                              >
                                {label}
                              </option>
                            ),
                          )}
                        </select>
                      </label>

                      <label>
                        <span>
                          Etiquetas
                        </span>
                        <input
                          value={selectedProduct.tags.join(
                            ", ",
                          )}
                          placeholder="novedad, baggy, urbano"
                          onChange={(
                            event,
                          ) =>
                            updateProduct(
                              (
                                product,
                              ) => ({
                                ...product,
                                tags:
                                  event.target.value
                                    .split(
                                      ",",
                                    )
                                    .map(
                                      (
                                        tag,
                                      ) =>
                                        tag.trim(),
                                    )
                                    .filter(
                                      Boolean,
                                    ),
                              }),
                            )
                          }
                        />
                      </label>

                      <label className="full">
                        <span>
                          Descripción corta
                        </span>
                        <textarea
                          value={
                            selectedProduct.shortDescription
                          }
                          onChange={(
                            event,
                          ) =>
                            updateProduct(
                              (
                                product,
                              ) => ({
                                ...product,
                                shortDescription:
                                  event
                                    .target
                                    .value,
                              }),
                            )
                          }
                        />
                      </label>

                      <label className="full">
                        <span>
                          Argumento para vendedores
                        </span>
                        <textarea
                          value={
                            selectedProduct.salesDescription
                          }
                          onChange={(
                            event,
                          ) =>
                            updateProduct(
                              (
                                product,
                              ) => ({
                                ...product,
                                salesDescription:
                                  event
                                    .target
                                    .value,
                              }),
                            )
                          }
                        />
                      </label>

                      <label className="full">
                        <span>
                          Texto para WhatsApp
                        </span>
                        <textarea
                          value={
                            selectedProduct.whatsappDescription
                          }
                          onChange={(
                            event,
                          ) =>
                            updateProduct(
                              (
                                product,
                              ) => ({
                                ...product,
                                whatsappDescription:
                                  event
                                    .target
                                    .value,
                              }),
                            )
                          }
                        />
                      </label>
                    </div>
                  </section>
                ) : null}

                {activeTab ===
                "colors" ? (
                  <section className="catalog-section">
                    <div className="catalog-section-title">
                      <div>
                        <span>
                          VARIANTES
                        </span>
                        <h3>
                          Colores comerciales
                        </h3>
                      </div>

                      <button
                        type="button"
                        className="catalog-button primary"
                        onClick={addColor}
                      >
                        + Agregar color
                      </button>
                    </div>

                    <div className="catalog-color-layout">
                      <div className="catalog-color-list">
                        {selectedProduct.colorVariants.map(
                          (variant) => (
                            <button
                              type="button"
                              key={
                                variant.id
                              }
                              className={
                                selectedColorId ===
                                variant.id
                                  ? "active"
                                  : ""
                              }
                              onClick={() =>
                                setSelectedColorId(
                                  variant.id,
                                )
                              }
                            >
                              <i
                                style={{
                                  background:
                                    variant.hex,
                                }}
                              />

                              <span>
                                <strong>
                                  {
                                    variant.name
                                  }
                                </strong>

                                <small>
                                  {
                                    variant.code
                                  }{" "}
                                  ·{" "}
                                  {variantAvailableStock(
                                    variant,
                                  )}{" "}
                                  disponibles
                                </small>
                              </span>

                              <em>
                                {
                                  variant
                                    .images
                                    .length
                                }{" "}
                                fotos
                              </em>
                            </button>
                          ),
                        )}
                      </div>

                      {selectedColor ? (
                        <div className="catalog-color-editor">
                          <div className="catalog-color-preview">
                            <i
                              style={{
                                background:
                                  selectedColor.hex,
                              }}
                            />

                            <div>
                              <span>
                                COLOR ACTIVO
                              </span>

                              <strong>
                                {
                                  selectedColor.name
                                }
                              </strong>

                              <small>
                                {
                                  selectedColor.code
                                }{" "}
                                ·{" "}
                                {
                                  selectedColor.family
                                }
                              </small>
                            </div>
                          </div>

                          <div className="catalog-form-grid compact">
                            <label>
                              <span>
                                Nombre comercial
                              </span>
                              <input
                                value={
                                  selectedColor.name
                                }
                                onChange={(
                                  event,
                                ) =>
                                  updateColor(
                                    (
                                      color,
                                    ) => ({
                                      ...color,
                                      name:
                                        event
                                          .target
                                          .value,
                                    }),
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
                                  selectedColor.code
                                }
                                onChange={(
                                  event,
                                ) =>
                                  updateColor(
                                    (
                                      color,
                                    ) => ({
                                      ...color,
                                      code:
                                        slug(
                                          event
                                            .target
                                            .value,
                                        ).slice(
                                          0,
                                          6,
                                        ),
                                    }),
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
                                  selectedColor.family
                                }
                                onChange={(
                                  event,
                                ) =>
                                  updateColor(
                                    (
                                      color,
                                    ) => ({
                                      ...color,
                                      family:
                                        event
                                          .target
                                          .value,
                                    }),
                                  )
                                }
                              />
                            </label>

                            <label>
                              <span>
                                Muestra visual
                              </span>
                              <div className="catalog-color-input">
                                <input
                                  type="color"
                                  value={
                                    selectedColor.hex
                                  }
                                  onChange={(
                                    event,
                                  ) =>
                                    updateColor(
                                      (
                                        color,
                                      ) => ({
                                        ...color,
                                        hex:
                                          event
                                            .target
                                            .value,
                                      }),
                                    )
                                  }
                                />

                                <input
                                  value={
                                    selectedColor.hex
                                  }
                                  onChange={(
                                    event,
                                  ) =>
                                    updateColor(
                                      (
                                        color,
                                      ) => ({
                                        ...color,
                                        hex:
                                          event
                                            .target
                                            .value,
                                      }),
                                    )
                                  }
                                />
                              </div>
                            </label>

                            <label>
                              <span>
                                Estado
                              </span>
                              <select
                                value={
                                  selectedColor.status
                                }
                                onChange={(
                                  event,
                                ) =>
                                  updateColor(
                                    (
                                      color,
                                    ) => ({
                                      ...color,
                                      status:
                                        event
                                          .target
                                          .value as GarmentStatus,
                                    }),
                                  )
                                }
                              >
                                {Object.entries(
                                  statusLabels,
                                ).map(
                                  ([
                                    value,
                                    label,
                                  ]) => (
                                    <option
                                      key={
                                        value
                                      }
                                      value={
                                        value
                                      }
                                    >
                                      {
                                        label
                                      }
                                    </option>
                                  ),
                                )}
                              </select>
                            </label>
                          </div>

                          <div className="catalog-inline-actions">
                            <button
                              type="button"
                              onClick={
                                duplicateColor
                              }
                            >
                              Duplicar color
                            </button>

                            <button
                              type="button"
                              className="danger"
                              onClick={
                                deleteColor
                              }
                            >
                              Eliminar color
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </section>
                ) : null}

                {activeTab ===
                "stock" ? (
                  <section className="catalog-section">
                    <div className="catalog-section-title">
                      <div>
                        <span>
                          MATRIZ DE VARIANTES
                        </span>

                        <h3>
                          Talles, SKU y stock
                        </h3>
                      </div>

                      <button
                        type="button"
                        className="catalog-button secondary"
                        onClick={addSize}
                      >
                        + Agregar talle
                      </button>
                    </div>

                    <div className="catalog-color-selector">
                      {selectedProduct.colorVariants.map(
                        (variant) => (
                          <button
                            type="button"
                            key={
                              variant.id
                            }
                            className={
                              variant.id ===
                              selectedColorId
                                ? "active"
                                : ""
                            }
                            onClick={() =>
                              setSelectedColorId(
                                variant.id,
                              )
                            }
                          >
                            <i
                              style={{
                                background:
                                  variant.hex,
                              }}
                            />

                            {
                              variant.name
                            }
                          </button>
                        ),
                      )}
                    </div>

                    {selectedColor ? (
                      <>
                        <div className="catalog-stock-summary">
                          <article>
                            <span>
                              Stock físico
                            </span>
                            <strong>
                              {variantPhysicalStock(
                                selectedColor,
                              )}
                            </strong>
                          </article>

                          <article>
                            <span>
                              Reservado
                            </span>
                            <strong>
                              {selectedColor.sizes.reduce(
                                (
                                  total,
                                  size,
                                ) =>
                                  total +
                                  size.reserved,
                                0,
                              )}
                            </strong>
                          </article>

                          <article>
                            <span>
                              Disponible
                            </span>
                            <strong>
                              {variantAvailableStock(
                                selectedColor,
                              )}
                            </strong>
                          </article>

                          <article>
                            <span>
                              En tránsito
                            </span>
                            <strong>
                              {selectedColor.sizes.reduce(
                                (
                                  total,
                                  size,
                                ) =>
                                  total +
                                  size.incoming,
                                0,
                              )}
                            </strong>
                          </article>
                        </div>

                        <div className="catalog-table-wrap">
                          <table className="catalog-stock-table">
                            <thead>
                              <tr>
                                <th>
                                  Activo
                                </th>
                                <th>
                                  Talle
                                </th>
                                <th>SKU</th>
                                <th>
                                  Código de barras
                                </th>
                                <th>
                                  Físico
                                </th>
                                <th>
                                  Reservado
                                </th>
                                <th>
                                  Disponible
                                </th>
                                <th>
                                  En tránsito
                                </th>
                                <th>
                                  Dañado
                                </th>
                                <th>
                                  Mínimo
                                </th>
                                <th>
                                  Ubicación
                                </th>
                              </tr>
                            </thead>

                            <tbody>
                              {selectedColor.sizes.map(
                                (
                                  size,
                                ) => (
                                  <tr
                                    key={
                                      size.id
                                    }
                                  >
                                    <td>
                                      <input
                                        type="checkbox"
                                        checked={
                                          size.enabled
                                        }
                                        onChange={(
                                          event,
                                        ) =>
                                          updateSize(
                                            size.id,
                                            "enabled",
                                            event
                                              .target
                                              .checked,
                                          )
                                        }
                                      />
                                    </td>

                                    <td>
                                      <input
                                        className="small-input"
                                        value={
                                          size.size
                                        }
                                        onChange={(
                                          event,
                                        ) =>
                                          updateSize(
                                            size.id,
                                            "size",
                                            event
                                              .target
                                              .value,
                                          )
                                        }
                                      />
                                    </td>

                                    <td>
                                      <input
                                        className="sku-input"
                                        value={
                                          size.sku
                                        }
                                        onChange={(
                                          event,
                                        ) =>
                                          updateSize(
                                            size.id,
                                            "sku",
                                            slug(
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
                                        value={
                                          size.barcode
                                        }
                                        placeholder="EAN / interno"
                                        onChange={(
                                          event,
                                        ) =>
                                          updateSize(
                                            size.id,
                                            "barcode",
                                            event
                                              .target
                                              .value,
                                          )
                                        }
                                      />
                                    </td>

                                    {[
                                      "physical",
                                      "reserved",
                                      "incoming",
                                      "damaged",
                                      "minimum",
                                    ].map(
                                      (
                                        field,
                                      ) => (
                                        <td
                                          key={
                                            field
                                          }
                                        >
                                          {field ===
                                          "incoming" ? (
                                            <input
                                              type="number"
                                              min="0"
                                              value={
                                                size[
                                                  field as keyof SizeStock
                                                ] as number
                                              }
                                              onChange={(
                                                event,
                                              ) =>
                                                updateSize(
                                                  size.id,
                                                  field as keyof SizeStock,
                                                  Number(
                                                    event
                                                      .target
                                                      .value,
                                                  ),
                                                )
                                              }
                                            />
                                          ) : field ===
                                            "damaged" ? (
                                            <input
                                              type="number"
                                              min="0"
                                              value={
                                                size[
                                                  field as keyof SizeStock
                                                ] as number
                                              }
                                              onChange={(
                                                event,
                                              ) =>
                                                updateSize(
                                                  size.id,
                                                  field as keyof SizeStock,
                                                  Number(
                                                    event
                                                      .target
                                                      .value,
                                                  ),
                                                )
                                              }
                                            />
                                          ) : field ===
                                            "minimum" ? (
                                            <input
                                              type="number"
                                              min="0"
                                              value={
                                                size[
                                                  field as keyof SizeStock
                                                ] as number
                                              }
                                              onChange={(
                                                event,
                                              ) =>
                                                updateSize(
                                                  size.id,
                                                  field as keyof SizeStock,
                                                  Number(
                                                    event
                                                      .target
                                                      .value,
                                                  ),
                                                )
                                              }
                                            />
                                          ) : (
                                            <input
                                              type="number"
                                              min="0"
                                              value={
                                                size[
                                                  field as keyof SizeStock
                                                ] as number
                                              }
                                              onChange={(
                                                event,
                                              ) =>
                                                updateSize(
                                                  size.id,
                                                  field as keyof SizeStock,
                                                  Number(
                                                    event
                                                      .target
                                                      .value,
                                                  ),
                                                )
                                              }
                                            />
                                          )}
                                        </td>
                                      ),
                                    )}

                                    <td className="available-cell">
                                      {availableStock(
                                        size,
                                      )}
                                    </td>

                                    <td>
                                      <input
                                        value={
                                          size.location
                                        }
                                        onChange={(
                                          event,
                                        ) =>
                                          updateSize(
                                            size.id,
                                            "location",
                                            event
                                              .target
                                              .value,
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

                        <p className="catalog-help">
                          Disponible = físico
                          − reservado − dañado.
                          El stock en tránsito
                          todavía no se considera
                          vendible.
                        </p>
                      </>
                    ) : null}
                  </section>
                ) : null}

                {activeTab ===
                "media" ? (
                  <section className="catalog-section">
                    <div className="catalog-section-title">
                      <div>
                        <span>
                          GESTOR MULTIMEDIA
                        </span>

                        <h3>
                          Fotografías por color
                        </h3>
                      </div>

                      <div className="catalog-inline-actions">
                        <button
                          type="button"
                          onClick={
                            copyImagesToAnotherColor
                          }
                        >
                          Copiar a otro color
                        </button>

                        <button
                          type="button"
                          className="catalog-button primary"
                          onClick={() =>
                            fileInputRef.current?.click()
                          }
                        >
                          + Subir fotos
                        </button>
                      </div>
                    </div>

                    <div className="catalog-color-selector">
                      {selectedProduct.colorVariants.map(
                        (variant) => (
                          <button
                            type="button"
                            key={
                              variant.id
                            }
                            className={
                              variant.id ===
                              selectedColorId
                                ? "active"
                                : ""
                            }
                            onClick={() =>
                              setSelectedColorId(
                                variant.id,
                              )
                            }
                          >
                            <i
                              style={{
                                background:
                                  variant.hex,
                              }}
                            />

                            {
                              variant.name
                            }

                            <em>
                              {
                                variant
                                  .images
                                  .length
                              }
                            </em>
                          </button>
                        ),
                      )}
                    </div>

                    {selectedColor ? (
                      <>
                        <div className="catalog-upload-settings">
                          <label>
                            <span>
                              Tipo de fotografía
                            </span>

                            <select
                              value={
                                uploadRole
                              }
                              onChange={(
                                event,
                              ) =>
                                setUploadRole(
                                  event
                                    .target
                                    .value as ImageRole,
                                )
                              }
                            >
                              {Object.entries(
                                imageRoleLabels,
                              )
                                .filter(
                                  ([
                                    value,
                                  ]) =>
                                    value !==
                                    "cover",
                                )
                                .map(
                                  ([
                                    value,
                                    label,
                                  ]) => (
                                    <option
                                      key={
                                        value
                                      }
                                      value={
                                        value
                                      }
                                    >
                                      {
                                        label
                                      }
                                    </option>
                                  ),
                                )}
                            </select>
                          </label>

                          <span>
                            Color seleccionado:
                            <strong>
                              {" "}
                              {
                                selectedColor.name
                              }
                            </strong>
                          </span>
                        </div>

                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          multiple
                          hidden
                          onChange={
                            handleFileInput
                          }
                        />

                        <div
                          className={
                            dragActive
                              ? "catalog-dropzone active"
                              : "catalog-dropzone"
                          }
                          onDragEnter={(
                            event,
                          ) => {
                            event.preventDefault();
                            setDragActive(
                              true,
                            );
                          }}
                          onDragOver={(
                            event,
                          ) =>
                            event.preventDefault()
                          }
                          onDragLeave={() =>
                            setDragActive(
                              false,
                            )
                          }
                          onDrop={
                            handleDrop
                          }
                          onClick={() =>
                            fileInputRef.current?.click()
                          }
                        >
                          <span className="catalog-upload-icon">
                            ↑
                          </span>

                          <strong>
                            Arrastrá las
                            fotografías de{" "}
                            {
                              selectedColor.name
                            }
                          </strong>

                          <p>
                            Frente, espalda,
                            detalle, modelo y
                            packaging. Hasta 12
                            archivos por carga.
                          </p>

                          <button
                            type="button"
                          >
                            Seleccionar imágenes
                          </button>
                        </div>

                        {selectedColor.images
                          .length === 0 ? (
                          <div className="catalog-media-empty">
                            <strong>
                              Este color todavía
                              no tiene imágenes
                            </strong>

                            <p>
                              Cargá fotografías
                              específicas para que
                              el catálogo y
                              WhatsApp muestren el
                              color correcto.
                            </p>
                          </div>
                        ) : (
                          <div className="catalog-media-grid">
                            {selectedColor.images.map(
                              (
                                image,
                                index,
                              ) => (
                                <article
                                  key={
                                    image.id
                                  }
                                  className={
                                    image.isCover
                                      ? "catalog-media-card cover"
                                      : "catalog-media-card"
                                  }
                                >
                                  <div className="catalog-media-image">
                                    <img
                                      src={
                                        image.url
                                      }
                                      alt={
                                        image.name
                                      }
                                    />

                                    {image.isCover ? (
                                      <span>
                                        PORTADA
                                      </span>
                                    ) : null}

                                    <em>
                                      {index +
                                        1}
                                    </em>
                                  </div>

                                  <div className="catalog-media-body">
                                    <strong
                                      title={
                                        image.name
                                      }
                                    >
                                      {
                                        image.name
                                      }
                                    </strong>

                                    <select
                                      value={
                                        image.role
                                      }
                                      onChange={(
                                        event,
                                      ) =>
                                        updateImageRole(
                                          image.id,
                                          event
                                            .target
                                            .value as ImageRole,
                                        )
                                      }
                                    >
                                      {Object.entries(
                                        imageRoleLabels,
                                      ).map(
                                        ([
                                          value,
                                          label,
                                        ]) => (
                                          <option
                                            key={
                                              value
                                            }
                                            value={
                                              value
                                            }
                                          >
                                            {
                                              label
                                            }
                                          </option>
                                        ),
                                      )}
                                    </select>

                                    <div className="catalog-media-actions">
                                      <button
                                        type="button"
                                        disabled={
                                          index ===
                                          0
                                        }
                                        onClick={() =>
                                          moveImage(
                                            image.id,
                                            -1,
                                          )
                                        }
                                      >
                                        ←
                                      </button>

                                      <button
                                        type="button"
                                        disabled={
                                          index ===
                                          selectedColor
                                            .images
                                            .length -
                                            1
                                        }
                                        onClick={() =>
                                          moveImage(
                                            image.id,
                                            1,
                                          )
                                        }
                                      >
                                        →
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() =>
                                          setCover(
                                            image.id,
                                          )
                                        }
                                      >
                                        Portada
                                      </button>

                                      <button
                                        type="button"
                                        className="danger"
                                        onClick={() =>
                                          removeImage(
                                            image.id,
                                          )
                                        }
                                      >
                                        Eliminar
                                      </button>
                                    </div>
                                  </div>
                                </article>
                              ),
                            )}
                          </div>
                        )}
                      </>
                    ) : null}
                  </section>
                ) : null}

                {activeTab ===
                "preview" ? (
                  <section className="catalog-section">
                    <div className="catalog-section-title">
                      <div>
                        <span>
                          CATÁLOGO DEL CLIENTE
                        </span>

                        <h3>
                          Previsualización comercial
                        </h3>
                      </div>

                      <span className="catalog-section-note">
                        Vista previa antes de
                        publicar o enviar por
                        WhatsApp.
                      </span>
                    </div>

                    <article className="catalog-public-preview">
                      <div className="catalog-preview-gallery">
                        <div className="catalog-preview-main">
                          {coverImage ? (
                            <img
                              src={
                                coverImage.url
                              }
                              alt={
                                selectedProduct.name
                              }
                            />
                          ) : (
                            <div className="catalog-preview-placeholder">
                              <strong>
                                Sin portada
                              </strong>

                              <span>
                                Subí una imagen
                                para el color
                                seleccionado.
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="catalog-preview-thumbnails">
                          {selectedColor?.images
                            .slice(0, 5)
                            .map(
                              (image) => (
                                <button
                                  type="button"
                                  key={
                                    image.id
                                  }
                                  onClick={() =>
                                    setCover(
                                      image.id,
                                    )
                                  }
                                >
                                  <img
                                    src={
                                      image.url
                                    }
                                    alt=""
                                  />
                                </button>
                              ),
                            )}
                        </div>
                      </div>

                      <div className="catalog-preview-info">
                        <span className="catalog-preview-brand">
                          {
                            selectedProduct.brand
                          }
                        </span>

                        <h2>
                          {
                            selectedProduct.name
                          }
                        </h2>

                        <p>
                          {
                            selectedProduct.shortDescription
                          }
                        </p>

                        <div className="catalog-preview-meta">
                          <span>
                            {
                              selectedProduct.category
                            }
                          </span>

                          <span>
                            {
                              selectedProduct.collection
                            }
                          </span>

                          <span>
                            {
                              selectedProduct.season
                            }
                          </span>
                        </div>

                        <div className="catalog-preview-block">
                          <span>
                            Elegí un color
                          </span>

                          <div className="catalog-preview-colors">
                            {selectedProduct.colorVariants.map(
                              (
                                variant,
                              ) => (
                                <button
                                  key={
                                    variant.id
                                  }
                                  type="button"
                                  className={
                                    variant.id ===
                                    selectedColorId
                                      ? "active"
                                      : ""
                                  }
                                  onClick={() =>
                                    setSelectedColorId(
                                      variant.id,
                                    )
                                  }
                                >
                                  <i
                                    style={{
                                      background:
                                        variant.hex,
                                    }}
                                  />

                                  {
                                    variant.name
                                  }
                                </button>
                              ),
                            )}
                          </div>
                        </div>

                        <div className="catalog-preview-block">
                          <span>
                            Talles disponibles
                          </span>

                          <div className="catalog-preview-sizes">
                            {selectedColor?.sizes
                              .filter(
                                (
                                  size,
                                ) =>
                                  size.enabled,
                              )
                              .map(
                                (
                                  size,
                                ) => (
                                  <button
                                    type="button"
                                    key={
                                      size.id
                                    }
                                    disabled={
                                      availableStock(
                                        size,
                                      ) ===
                                      0
                                    }
                                  >
                                    {
                                      size.size
                                    }

                                    <small>
                                      {availableStock(
                                        size,
                                      )}
                                    </small>
                                  </button>
                                ),
                              )}
                          </div>
                        </div>

                        <div className="catalog-preview-stock">
                          <span>
                            Stock disponible
                          </span>

                          <strong>
                            {selectedColor
                              ? variantAvailableStock(
                                  selectedColor,
                                )
                              : 0}{" "}
                            unidades
                          </strong>
                        </div>

                        <button
                          type="button"
                          className="catalog-preview-cta"
                        >
                          Consultar por WhatsApp
                        </button>
                      </div>
                    </article>
                  </section>
                ) : null}
              </>
            )}
          </main>
        </section>

        {notice ? (
          <div className="catalog-notice">
            {notice}
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
