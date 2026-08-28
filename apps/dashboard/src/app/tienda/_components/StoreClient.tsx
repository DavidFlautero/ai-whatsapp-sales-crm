"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useSearchParams,
} from "next/navigation";

import type {
  CartLine,
  StoreMode,
  StoreProduct,
} from "../store.types";

import "../store.css";

type Props = {
  mode: StoreMode;
  products: StoreProduct[];
  heroImageUrl?: string | null;
};

function money(value: number) {
  return new Intl.NumberFormat(
    "es-AR",
    {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    },
  ).format(value);
}

function storageKey(mode: StoreMode) {
  return mode === "wholesale"
    ? "fulanitas_store_cart_wholesale_v1"
    : "fulanitas_store_cart_retail_v1";
}

function getPrice(
  product: StoreProduct,
  mode: StoreMode,
) {
  if (mode === "wholesale") {
    return product.price || 0;
  }

  return product.retailPrice || 0;
}

function cover(product: StoreProduct) {
  const images = [...product.images]
    .sort(
      (a, b) =>
        Number(b.isCover) -
          Number(a.isCover) ||
        (a.order || 0) -
          (b.order || 0),
    );

  return images[0]?.url || "";
}

export default function StoreClient({
  mode,
  products,
  heroImageUrl,
}: Props) {
  const searchParams =
    useSearchParams();

  const [search, setSearch] =
    useState("");

  const [category, setCategory] =
    useState("Todos");

  const [selected, setSelected] =
    useState<StoreProduct | null>(
      null,
    );

  /* STORE_PRODUCT_GALLERY_V1 */
  const [
    selectedImageUrl,
    setSelectedImageUrl,
  ] =
    useState<string | null>(
      null,
    );

  const [cartOpen, setCartOpen] =
    useState(false);

  const [cart, setCart] =
    useState<CartLine[]>([]);

  useEffect(() => {
    try {
      const raw =
        localStorage.getItem(
          storageKey(mode),
        );

      if (raw) {
        setCart(
          JSON.parse(raw),
        );
      }
    } catch {
      setCart([]);
    }
  }, [mode]);

  function persist(
    next: CartLine[],
  ) {
    setCart(next);

    localStorage.setItem(
      storageKey(mode),
      JSON.stringify(next),
    );
  }

  const groupedProducts = useMemo(
    () => {
      const groups =
        new Map<
          string,
          StoreProduct[]
        >();

      for (const product of products) {
        const key =
          product.baseSku ||
          product.productId ||
          product.id;

        const current =
          groups.get(key) || [];

        current.push(product);

        groups.set(
          key,
          current,
        );
      }

      return groups;
    },
    [products],
  );

  /*
   * Una sola tarjeta por artículo.
   *
   * Elegimos como representante la variante
   * con imagen; si no, una con stock; y si
   * tampoco hay, simplemente la primera.
   */
  const articleProducts =
    useMemo(
      () =>
        Array.from(
          groupedProducts.values(),
        )
          .map(
            (variants) =>
              [...variants]
                .sort(
                  (a, b) => {
                    const imageDiff =
                      Number(
                        b.images.length > 0,
                      ) -
                      Number(
                        a.images.length > 0,
                      );

                    if (imageDiff) {
                      return imageDiff;
                    }

                    return (
                      Number(
                        b.stock > 0,
                      ) -
                      Number(
                        a.stock > 0,
                      )
                    );
                  },
                )[0],
          )
          .filter(
            (
              product,
            ): product is StoreProduct =>
              Boolean(product),
          ),
      [groupedProducts],
    );

  const categories = useMemo(
    () => [
      "Todos",
      ...Array.from(
        new Set(
          articleProducts
            .map(
              (product) =>
                product.category,
            )
            .filter(Boolean),
        ),
      ).sort(
        (left, right) => {
          const leftCount =
            articleProducts.filter(
              (product) =>
                product.category ===
                left,
            ).length;

          const rightCount =
            articleProducts.filter(
              (product) =>
                product.category ===
                right,
            ).length;

          return (
            rightCount -
              leftCount ||
            left.localeCompare(
              right,
            )
          );
        },
      ),
    ],
    [articleProducts],
  );

  useEffect(() => {
    /* STORE_PRODUCT_SEARCH_PARAM_V1 */
    const requestedProduct =
      searchParams
        .get(
          "buscar",
        )
        ?.trim();

    if (requestedProduct) {
      setSearch(
        requestedProduct,
      );

      setCategory(
        "Todos",
      );
    }

    const requested =
      searchParams
        .get(
          "categoria",
        )
        ?.trim()
        .toUpperCase();

    if (!requested) {
      return;
    }

    const found =
      categories.find(
        (item) =>
          item.toUpperCase()
          === requested,
      );

    if (found) {
      setCategory(
        found,
      );
    }
  }, [
    searchParams,
    categories,
  ]);

  const filtered = useMemo(
    () => {
      const term =
        search
          .trim()
          .toLowerCase();

      return articleProducts.filter(
        (product) => {
          if (
            category !== "Todos" &&
            product.category !==
              category
          ) {
            return false;
          }

          if (!term) {
            return true;
          }

          const key =
            product.baseSku ||
            product.productId ||
            product.id;

          const variants =
            groupedProducts.get(
              key,
            ) || [product];

          return variants.some(
            (variant) =>
              [
                variant.name,
                variant.sku,
                variant.baseSku,
                variant.category,
                variant.color,
                variant.size,
                variant.description,
              ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase()
                .includes(term),
          );
        },
      );
    },
    [
      articleProducts,
      groupedProducts,
      search,
      category,
    ],
  );

  const categorySections =
    useMemo(
      () =>
        categories
          .filter(
            (item) =>
              item !== "Todos",
          )
          .map(
            (item) => {
              const sectionProducts =
                articleProducts.filter(
                  (product) =>
                    product.category ===
                    item,
                );

              return {
                category:
                  item,

                count:
                  sectionProducts.length,

                products:
                  sectionProducts.slice(
                    0,
                    4,
                  ),
              };
            },
          )
          .filter(
            (section) =>
              section.count > 0,
          ),
      [
        categories,
        articleProducts,
      ],
    );

  const cartQuantity =
    cart.reduce(
      (total, line) =>
        total + line.quantity,
      0,
    );

  const total =
    cart.reduce(
      (sum, line) =>
        sum +
        line.unitPrice *
          line.quantity,
      0,
    );

  function add(
    product: StoreProduct,
  ) {
    const unitPrice =
      getPrice(product, mode);

    if (
      mode === "retail" &&
      unitPrice <= 0
    ) {
      return;
    }

    if (
      mode === "wholesale" &&
      unitPrice <= 0
    ) {
      return;
    }

    const key =
      [
        product.variantId ||
          product.id,
        product.color,
        product.size,
        mode,
      ].join(":");

    const existing =
      cart.find(
        (line) =>
          line.id === key,
      );

    if (existing) {
      persist(
        cart.map(
          (line) =>
            line.id === key
              ? {
                  ...line,
                  quantity:
                    line.quantity +
                    1,
                }
              : line,
        ),
      );
    } else {
      persist([
        ...cart,
        {
          id: key,
          productId:
            product.productId ||
            product.id,
          variantId:
            product.variantId,
          sku: product.sku,
          name: product.name,
          image: cover(product),
          color: product.color,
          size: product.size,
          unitPrice,
          quantity: 1,
          mode,
        },
      ]);
    }

    setCartOpen(true);
  }

  function changeQuantity(
    id: string,
    quantity: number,
  ) {
    if (quantity <= 0) {
      persist(
        cart.filter(
          (line) =>
            line.id !== id,
        ),
      );

      return;
    }

    persist(
      cart.map(
        (line) =>
          line.id === id
            ? {
                ...line,
                quantity,
              }
            : line,
      ),
    );
  }

  function sendWhatsApp() {
    if (!cart.length) {
      return;
    }

    const title =
      mode === "wholesale"
        ? "PEDIDO MAYORISTA"
        : "PEDIDO MINORISTA";

    const lines =
      cart.map(
        (line) =>
          `• ${line.quantity} x ${line.name}` +
          ` (${line.sku})` +
          `${line.color ? ` · ${line.color}` : ""}` +
          `${line.size ? ` · ${line.size}` : ""}` +
          ` — ${money(
            line.unitPrice *
              line.quantity,
          )}`,
      );

    const message = [
      title,
      "",
      ...lines,
      "",
      `Total: ${money(total)}`,
      "",
      "Quiero confirmar este pedido.",
    ].join("\n");

    window.open(
      `https://wa.me/?text=${encodeURIComponent(
        message,
      )}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  const wholesale =
    mode === "wholesale";

  const selectedVariants =
    useMemo(
      () => {
        if (!selected) {
          return [];
        }

        const key =
          selected.baseSku ||
          selected.productId ||
          selected.id;

        return (
          groupedProducts.get(
            key,
          ) || [selected]
        );
      },
      [
        selected,
        groupedProducts,
      ],
    );

  const selectedImages =
    useMemo(
      () => {
        if (!selected) {
          return [];
        }

        const unique =
          new Map<
            string,
            StoreProduct["images"][number]
          >();

        for (
          const image
          of selected.images
        ) {
          const url =
            image.url?.trim();

          if (url && !unique.has(url)) {
            unique.set(
              url,
              image,
            );
          }
        }

        return Array.from(
          unique.values(),
        )
          .sort(
            (left, right) =>
              Number(
                right.isCover,
              )
              - Number(
                left.isCover,
              )
              || Number(
                left.order
                ?? 0,
              )
              - Number(
                right.order
                ?? 0,
              ),
          )
          .slice(
            0,
            3,
          );
      },
      [selected],
    );

  useEffect(
    () => {
      setSelectedImageUrl(
        null,
      );
    },
    [selected?.id],
  );

  const activeSelectedImage =
    selectedImages.find(
      (image) =>
        image.url
        === selectedImageUrl,
    )?.url
    ?? selectedImages[0]?.url
    ?? "";


  function renderProductCard(
    product: StoreProduct,
  ) {
    const image =
      cover(product);

    const price =
      getPrice(
        product,
        mode,
      );

    const key =
      product.baseSku ||
      product.productId ||
      product.id;

    const variants =
      groupedProducts.get(
        key,
      ) || [product];

    const totalStock =
      variants.reduce(
        (sum, variant) =>
          sum +
          Number(
            variant.stock || 0,
          ),
        0,
      );

    const colors =
      new Set(
        variants
          .map(
            (variant) =>
              variant.color,
          )
          .filter(Boolean),
      ).size;

    const sizes =
      new Set(
        variants
          .map(
            (variant) =>
              variant.size,
          )
          .filter(Boolean),
      ).size;

    return (
      <article
        className="store-card"
        key={key}
      >
        <button
          type="button"
          className="store-card-media"
          onClick={() =>
            setSelected(
              product,
            )
          }
        >
          {image ? (
            <img
              src={image}
              alt={product.name}
            />
          ) : (
            <div className="store-no-image">
              <span>
                F
              </span>

              <small>
                Imagen próximamente
              </small>
            </div>
          )}

          <span className="store-card-type">
            {wholesale
              ? "MAYORISTA"
              : "MINORISTA"}
          </span>

          {totalStock > 0 ? (
            <span className="store-card-stock available">
              Disponible
            </span>
          ) : (
            <span className="store-card-stock">
              Consultar
            </span>
          )}
        </button>

        <div className="store-card-body">
          <div className="store-card-code">
            {product.baseSku}
          </div>

          <h3>
            {product.name}
          </h3>

          <p>
            {variants.length > 1
              ? [
                  colors > 0
                    ? `${colors} colores`
                    : null,

                  sizes > 0
                    ? `${sizes} talles`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : [
                  product.color,
                  product.size,
                ]
                  .filter(Boolean)
                  .join(" · ") ||
                "Consultar variantes"}
          </p>

          <div className="store-card-bottom">
            <div className="store-card-price">
              <small>
                {wholesale
                  ? "Precio mayorista"
                  : "Precio minorista"}
              </small>

              <strong>
                {price > 0
                  ? money(price)
                  : "Consultar"}
              </strong>
            </div>

            <button
              type="button"
              aria-label="Ver producto"
              onClick={() =>
                setSelected(
                  product,
                )
              }
            >
              →
            </button>
          </div>
        </div>
      </article>
    );
  }

  return (
    <main
      className={`store-page ${
        wholesale
          ? "store-wholesale"
          : "store-retail"
      }`}
    >
      <header className="store-header">
        <a
          href="/tienda"
          className="store-logo"
        >
          <span>F</span>

          <div>
            <strong>
              FULANITAS
            </strong>

            <small>
              FÁBRICA
            </small>
          </div>
        </a>

        <nav className="store-mode-nav">
          <a
            href="/tienda/mayorista"
            className={
              wholesale
                ? "active"
                : ""
            }
          >
            Mayorista
          </a>

          <a
            href="/tienda/minorista"
            className={
              !wholesale
                ? "active"
                : ""
            }
          >
            Minorista
          </a>
        </nav>

        <button
          type="button"
          className="store-cart-button"
          onClick={() =>
            setCartOpen(true)
          }
        >
          <span>
            Carrito
          </span>

          <strong>
            {cartQuantity}
          </strong>
        </button>
      </header>

      <section className="store-hero">
        <div className="store-hero-copy">
          <span>
            {wholesale
              ? "CATÁLOGO PARA REVENDEDORES"
              : "TIENDA ONLINE"}
          </span>

          <h1>
            {wholesale
              ? "Comprá directo de fábrica."
              : "Encontrá tu próximo favorito."}
          </h1>

          <p>
            {wholesale
              ? "Colecciones, stock real y compra mayorista en un solo lugar."
              : "Comprá por unidad y elegí entre los modelos disponibles."}
          </p>

          <div className="store-hero-tags">
            {wholesale ? (
              <>
                <span>
                  Precio mayorista
                </span>
                <span>
                  Curvas y packs
                </span>
                <span>
                  Stock real
                </span>
              </>
            ) : (
              <>
                <span>
                  Compra por unidad
                </span>
                <span>
                  Stock disponible
                </span>
                <span>
                  Atención por WhatsApp
                </span>
              </>
            )}
          </div>
        </div>

        <div className="store-hero-mark">
          <span>
            {wholesale
              ? "MAYORISTA"
              : "MINORISTA"}
          </span>

          {heroImageUrl ? (
            <img
              src={heroImageUrl}
              alt="Fulanitas"
              className="store-hero-profile-image"
            />
          ) : (
            <strong>
              F
            </strong>
          )}
        </div>
      </section>

      <section className="store-toolbar">
        <label className="store-search">
          <span>
            Buscar
          </span>

          <input
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value,
              )
            }
            placeholder="Producto, código, color..."
          />
        </label>

        <div className="store-categories">
          {categories.map(
            (item) => (
              <button
                key={item}
                type="button"
                className={
                  category === item
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setCategory(item)
                }
              >
                {item}
              </button>
            ),
          )}
        </div>
      </section>

      {!search.trim() &&
      category === "Todos" ? (
        <div className="store-category-home">
          <section className="store-results-heading">
            <div>
              <span>
                COLECCIONES
              </span>

              <h2>
                Explorá por categoría
              </h2>
            </div>

            <strong>
              {articleProducts.length}{" "}
              productos
            </strong>
          </section>

          {categorySections.map(
            (section) => (
              <section
                className="store-category-section"
                key={
                  section.category
                }
              >
                <header className="store-category-section-header">
                  <div>
                    <span>
                      COLECCIÓN
                    </span>

                    <h2>
                      {
                        section.category
                      }
                    </h2>

                    <small>
                      {section.count}{" "}
                      productos
                    </small>
                  </div>

                  {section.count > 4 ? (
                    <button
                      type="button"
                      onClick={() => {
                        setCategory(
                          section.category,
                        );

                        window.scrollTo({
                          top: 520,
                          behavior:
                            "smooth",
                        });
                      }}
                    >
                      Ver todos
                      <span>
                        →
                      </span>
                    </button>
                  ) : null}
                </header>

                <div className="store-grid store-section-grid">
                  {section.products.map(
                    (
                      product,
                    ) =>
                      renderProductCard(
                        product,
                      ),
                  )}
                </div>
              </section>
            ),
          )}
        </div>
      ) : (
        <>
          <section className="store-results-heading">
            <div>
              <span>
                COLECCIÓN
              </span>

              <h2>
                {search.trim()
                  ? `Resultados para “${search.trim()}”`
                  : category}
              </h2>
            </div>

            <strong>
              {filtered.length}{" "}
              productos
            </strong>
          </section>

          {filtered.length ? (
            <section className="store-grid">
              {filtered.map(
                (
                  product,
                ) =>
                  renderProductCard(
                    product,
                  ),
              )}
            </section>
          ) : (
            <section className="store-empty">
              <strong>
                No encontramos productos.
              </strong>

              <span>
                Probá otra búsqueda o categoría.
              </span>
            </section>
          )}
        </>
      )}

      {selected ? (
        <div
          className="store-modal-backdrop"
          onMouseDown={() =>
            setSelected(null)
          }
        >
          <article
            className="store-product-modal"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <button
              type="button"
              className="store-modal-close"
              onClick={() =>
                setSelected(null)
              }
            >
              ×
            </button>

            <div className="store-modal-gallery">
              <div className="store-modal-image">
                {activeSelectedImage ? (
                  <img
                    src={
                      activeSelectedImage
                    }
                    alt={selected.name}
                  />
                ) : (
                  <div className="store-no-image big">
                    <span>
                      F
                    </span>

                    <small>
                      Sin imagen
                    </small>
                  </div>
                )}
              </div>

              {selectedImages.length > 1 ? (
                <div
                  className="store-modal-thumbnails"
                  aria-label="Fotografías del producto"
                >
                  {selectedImages.map(
                    (
                      image,
                      index,
                    ) => (
                      <button
                        key={
                          image.id
                          || image.url
                        }
                        type="button"
                        className={
                          image.url
                          === activeSelectedImage
                            ? "active"
                            : ""
                        }
                        aria-label={`Ver fotografía ${index + 1}`}
                        onClick={() =>
                          setSelectedImageUrl(
                            image.url,
                          )
                        }
                      >
                        <img
                          src={image.url}
                          alt={`${selected.name} - fotografía ${index + 1}`}
                        />

                        <span>
                          {index + 1}
                        </span>
                      </button>
                    ),
                  )}
                </div>
              ) : null}
            </div>

            <div className="store-modal-info">
              <span className="store-modal-mode">
                {wholesale
                  ? "VENTA MAYORISTA"
                  : "VENTA MINORISTA"}
              </span>

              <small className="store-modal-sku">
                {
                  selected.baseSku
                }
              </small>

              <h2>
                {selected.name}
              </h2>

              <p>
                {selected.description ||
                  "Producto disponible en Fulanitas Fábrica."}
              </p>

              {selectedVariants.length > 1 ? (
                <div className="store-variant-selector">
                  <div className="store-variant-selector-title">
                    <span>
                      ELEGÍ COLOR Y TALLE
                    </span>

                    <strong>
                      {selectedVariants.length} variantes
                    </strong>
                  </div>

                  <div className="store-variant-options">
                    {selectedVariants.map(
                      (variant) => {
                        const active =
                          (
                            variant.variantId ||
                            variant.id
                          ) ===
                          (
                            selected.variantId ||
                            selected.id
                          );

                        return (
                          <button
                            key={
                              variant.variantId ||
                              variant.id
                            }
                            type="button"
                            className={
                              active
                                ? "active"
                                : ""
                            }
                            onClick={() =>
                              setSelected(
                                variant,
                              )
                            }
                          >
                            <strong>
                              {[
                                variant.color,
                                variant.size,
                              ]
                                .filter(Boolean)
                                .join(" · ") ||
                                variant.sku}
                            </strong>

                            <small>
                              {variant.stock > 0
                                ? `${variant.stock} disponibles`
                                : "Sin stock"}
                            </small>
                          </button>
                        );
                      },
                    )}
                  </div>
                </div>
              ) : null}

              <div className="store-modal-variants">
                <div>
                  <small>
                    COLOR
                  </small>

                  <strong>
                    {selected.color ||
                      "Consultar"}
                  </strong>
                </div>

                <div>
                  <small>
                    TALLE
                  </small>

                  <strong>
                    {selected.size ||
                      "Consultar"}
                  </strong>
                </div>

                <div>
                  <small>
                    STOCK
                  </small>

                  <strong>
                    {selected.stock >
                    0
                      ? `${selected.stock} unidades`
                      : "Consultar"}
                  </strong>
                </div>
              </div>

              <div className="store-modal-price">
                <small>
                  {wholesale
                    ? "PRECIO MAYORISTA"
                    : "PRECIO MINORISTA"}
                </small>

                <strong>
                  {getPrice(
                    selected,
                    mode,
                  ) > 0
                    ? money(
                        getPrice(
                          selected,
                          mode,
                        ),
                      )
                    : "Consultar precio"}
                </strong>
              </div>

              {getPrice(
                selected,
                mode,
              ) > 0 ? (
                <button
                  type="button"
                  className="store-add-button"
                  onClick={() => {
                    add(selected);
                    setSelected(null);
                  }}
                >
                  Agregar al carrito
                </button>
              ) : (
                <a
                  className="store-add-button"
                  href={`https://wa.me/?text=${encodeURIComponent(
                    `Hola, quiero consultar el precio ${
                      wholesale
                        ? "mayorista"
                        : "minorista"
                    } de ${selected.name} (${selected.baseSku})`,
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Consultar por WhatsApp
                </a>
              )}

              {wholesale ? (
                <div className="store-wholesale-note">
                  <strong>
                    Compra mayorista
                  </strong>

                  <span>
                    Las condiciones de curvas,
                    packs y cantidades se
                    confirman al cerrar el
                    pedido.
                  </span>
                </div>
              ) : null}
            </div>
          </article>
        </div>
      ) : null}

      <div
        className={`store-cart-overlay ${
          cartOpen
            ? "open"
            : ""
        }`}
        onMouseDown={() =>
          setCartOpen(false)
        }
      />

      <aside
        className={`store-cart ${
          cartOpen
            ? "open"
            : ""
        }`}
      >
        <header>
          <div>
            <span>
              {wholesale
                ? "PEDIDO MAYORISTA"
                : "COMPRA MINORISTA"}
            </span>

            <h2>
              Tu carrito
            </h2>
          </div>

          <button
            type="button"
            onClick={() =>
              setCartOpen(false)
            }
          >
            ×
          </button>
        </header>

        <div className="store-cart-lines">
          {cart.length ? (
            cart.map(
              (line) => (
                <article
                  key={line.id}
                  className="store-cart-line"
                >
                  <div className="store-cart-thumb">
                    {line.image ? (
                      <img
                        src={
                          line.image
                        }
                        alt=""
                      />
                    ) : (
                      <span>
                        F
                      </span>
                    )}
                  </div>

                  <div className="store-cart-line-info">
                    <small>
                      {line.sku}
                    </small>

                    <strong>
                      {line.name}
                    </strong>

                    <span>
                      {[
                        line.color,
                        line.size,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>

                    <div className="store-cart-quantity">
                      <button
                        type="button"
                        onClick={() =>
                          changeQuantity(
                            line.id,
                            line.quantity -
                              1,
                          )
                        }
                      >
                        −
                      </button>

                      <strong>
                        {
                          line.quantity
                        }
                      </strong>

                      <button
                        type="button"
                        onClick={() =>
                          changeQuantity(
                            line.id,
                            line.quantity +
                              1,
                          )
                        }
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="store-cart-line-total">
                    <strong>
                      {money(
                        line.unitPrice *
                          line.quantity,
                      )}
                    </strong>

                    <button
                      type="button"
                      onClick={() =>
                        changeQuantity(
                          line.id,
                          0,
                        )
                      }
                    >
                      Quitar
                    </button>
                  </div>
                </article>
              ),
            )
          ) : (
            <div className="store-cart-empty">
              <span>
                🛍
              </span>

              <strong>
                Tu carrito está vacío
              </strong>

              <small>
                Agregá productos para
                comenzar.
              </small>
            </div>
          )}
        </div>

        <footer>
          <div className="store-cart-summary">
            <span>
              Total
            </span>

            <strong>
              {money(total)}
            </strong>
          </div>

          <button
            type="button"
            className="store-checkout"
            disabled={
              !cart.length
            }
            onClick={
              sendWhatsApp
            }
          >
            Finalizar por WhatsApp
          </button>

          <small>
            {wholesale
              ? "El pedido se enviará como compra mayorista."
              : "El pedido se enviará como compra minorista."}
          </small>
        </footer>
      </aside>
    </main>
  );
}
