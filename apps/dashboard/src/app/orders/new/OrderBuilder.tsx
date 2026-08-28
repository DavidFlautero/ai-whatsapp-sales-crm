"use client";

import Link from "next/link";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AppShell,
} from "../../../components/app-shell/AppShell";

import {
  loadStorage,
  saveStorage,
  seedPrices,
  STORAGE_KEYS,
} from "../../catalog/_commerce/commerce.storage";

import type {
  ProductPrice,
  StockCell,
} from "../../catalog/_commerce/commerce.types";

import {
  getAvailableStock,
  loadCommerceOrders,
  reserveOrderStock,
  saveCommerceOrders,
  syncAllProductsToInventory,
} from "../../catalog/_inventory/inventory-sync";

import type {
  CommerceOrder,
  CommerceOrderLine,
} from "../../catalog/_inventory/inventory-sync";

import "../../catalog/_commerce/commerce.css";
import "./order-builder.css";

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

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

export default function OrderBuilder() {
  const [stock, setStock] =
    useState<StockCell[]>([]);

  const [prices, setPrices] =
    useState<ProductPrice[]>([]);

  const [
    selectedProductId,
    setSelectedProductId,
  ] = useState("");

  const [
    selectedColorId,
    setSelectedColorId,
  ] = useState("");

  const [
    selectedCellId,
    setSelectedCellId,
  ] = useState("");

  const [quantity, setQuantity] =
    useState(1);

  const [customerName, setCustomerName] =
    useState("");

  const [businessName, setBusinessName] =
    useState("");

  const [whatsapp, setWhatsapp] =
    useState("");

  const [province, setProvince] =
    useState("");

  const [seller, setSeller] =
    useState("");

  const [priceList, setPriceList] =
    useState("Mayorista");

  const [
    paymentMethod,
    setPaymentMethod,
  ] = useState(
    "Transferencia bancaria",
  );

  const [
    shippingMethod,
    setShippingMethod,
  ] = useState("Via Cargo");

  const [shippingCost, setShippingCost] =
    useState(0);

  const [
    generalDiscount,
    setGeneralDiscount,
  ] = useState(0);

  const [notes, setNotes] =
    useState("");

  const [lines, setLines] =
    useState<CommerceOrderLine[]>(
      [],
    );

  const [notice, setNotice] =
    useState("");

  const [savedOrder, setSavedOrder] =
    useState<CommerceOrder | null>(
      null,
    );

  useEffect(() => {
    syncAllProductsToInventory();

    const loadedStock =
      loadStorage<StockCell[]>(
        STORAGE_KEYS.stock,
        [],
      );

    const loadedPrices =
      loadStorage<ProductPrice[]>(
        STORAGE_KEYS.prices,
        seedPrices(),
      );

    setStock(loadedStock);
    setPrices(loadedPrices);

    if (loadedStock[0]) {
      setSelectedProductId(
        loadedStock[0].productId,
      );

      setSelectedColorId(
        loadedStock[0].colorId,
      );

      setSelectedCellId(
        loadedStock[0].id,
      );
    }
  }, []);

  const products = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        name: string;
        baseSku: string;
      }
    >();

    stock.forEach((cell) =>
      map.set(cell.productId, {
        id: cell.productId,
        name: cell.productName,
        baseSku: cell.baseSku,
      }),
    );

    return [...map.values()];
  }, [stock]);

  const colors = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        name: string;
        hex: string;
      }
    >();

    stock
      .filter(
        (cell) =>
          cell.productId ===
          selectedProductId,
      )
      .forEach((cell) =>
        map.set(cell.colorId, {
          id: cell.colorId,
          name: cell.colorName,
          hex: cell.colorHex,
        }),
      );

    return [...map.values()];
  }, [
    stock,
    selectedProductId,
  ]);

  const variantCells = useMemo(
    () =>
      stock.filter(
        (cell) =>
          cell.productId ===
            selectedProductId &&
          cell.colorId ===
            selectedColorId &&
          cell.enabled,
      ),
    [
      stock,
      selectedProductId,
      selectedColorId,
    ],
  );

  const selectedCell =
    stock.find(
      (cell) =>
        cell.id ===
        selectedCellId,
    ) || null;

  const selectedPrice =
    prices.find(
      (price) =>
        price.productId ===
          selectedProductId ||
        price.baseSku ===
          selectedCell?.baseSku,
    ) || null;

  const unitPrice =
    selectedPrice
      ? priceList ===
        "Transferencia"
        ? selectedPrice.transfer
        : priceList ===
            "Efectivo"
          ? selectedPrice.cash
          : priceList ===
              "Distribuidor"
            ? selectedPrice.distributor
            : selectedPrice.wholesale
      : 0;

  const subtotal = lines.reduce(
    (total, line) =>
      total + line.subtotal,
    0,
  );

  const discount =
    subtotal *
    (generalDiscount / 100);

  const total =
    subtotal -
    discount +
    shippingCost;

  function notify(message: string) {
    setNotice(message);

    window.setTimeout(
      () => setNotice(""),
      2200,
    );
  }

  function changeProduct(
    productId: string,
  ) {
    setSelectedProductId(
      productId,
    );

    const first =
      stock.find(
        (cell) =>
          cell.productId ===
          productId,
      );

    setSelectedColorId(
      first?.colorId || "",
    );

    setSelectedCellId(
      first?.id || "",
    );
  }

  function changeColor(
    colorId: string,
  ) {
    setSelectedColorId(colorId);

    const first =
      stock.find(
        (cell) =>
          cell.productId ===
            selectedProductId &&
          cell.colorId ===
            colorId,
      );

    setSelectedCellId(
      first?.id || "",
    );
  }

  function addLine() {
    if (!selectedCell) {
      notify(
        "Seleccioná un talle",
      );
      return;
    }

    const available =
      getAvailableStock(
        selectedCell,
      );

    const alreadyInOrder =
      lines
        .filter(
          (line) =>
            line.stockCellId ===
            selectedCell.id,
        )
        .reduce(
          (total, line) =>
            total +
            line.quantity,
          0,
        );

    if (
      quantity <= 0 ||
      quantity +
        alreadyInOrder >
        available
    ) {
      notify(
        `Stock insuficiente. Disponible: ${available}.`,
      );
      return;
    }

    const existing =
      lines.find(
        (line) =>
          line.stockCellId ===
          selectedCell.id,
      );

    if (existing) {
      setLines((current) =>
        current.map((line) =>
          line.id ===
          existing.id
            ? {
                ...line,
                quantity:
                  line.quantity +
                  quantity,
                subtotal:
                  (line.quantity +
                    quantity) *
                  line.unitPrice *
                  (1 -
                    line.discountPercent /
                      100),
              }
            : line,
        ),
      );
    } else {
      const line: CommerceOrderLine = {
        id: uid("line"),
        stockCellId:
          selectedCell.id,
        productId:
          selectedCell.productId,
        productName:
          selectedCell.productName,
        baseSku:
          selectedCell.baseSku,
        colorId:
          selectedCell.colorId,
        colorName:
          selectedCell.colorName,
        colorHex:
          selectedCell.colorHex,
        size:
          selectedCell.size,
        sku: selectedCell.sku,
        quantity,
        unitPrice,
        discountPercent: 0,
        subtotal:
          quantity *
          unitPrice,
      };

      setLines((current) => [
        ...current,
        line,
      ]);
    }

    setQuantity(1);
    notify(
      "Variante agregada al pedido",
    );
  }

  function updateLine(
    lineId: string,
    field:
      | "quantity"
      | "unitPrice"
      | "discountPercent",
    value: number,
  ) {
    setLines((current) =>
      current.map((line) => {
        if (line.id !== lineId) {
          return line;
        }

        const next = {
          ...line,
          [field]:
            Math.max(0, value),
        };

        return {
          ...next,
          subtotal:
            next.quantity *
            next.unitPrice *
            (1 -
              next.discountPercent /
                100),
        };
      }),
    );
  }

  function removeLine(
    lineId: string,
  ) {
    setLines((current) =>
      current.filter(
        (line) =>
          line.id !== lineId,
      ),
    );
  }

  function createOrder() {
    if (!customerName.trim()) {
      notify(
        "Ingresá el nombre del cliente",
      );
      return;
    }

    if (lines.length === 0) {
      notify(
        "Agregá al menos una prenda",
      );
      return;
    }

    const now =
      new Date().toISOString();

    const orders =
      loadCommerceOrders();

    const order: CommerceOrder = {
      id: uid("order"),
      number: `PED-${String(
        orders.length + 1,
      ).padStart(5, "0")}`,
      customerName:
        customerName.trim(),
      businessName:
        businessName.trim(),
      whatsapp:
        whatsapp.trim(),
      province:
        province.trim(),
      seller:
        seller.trim(),
      priceList,
      paymentMethod,
      shippingMethod,
      notes,
      status: "draft",
      lines,
      subtotal,
      discount,
      shippingCost,
      total,
      stockReserved: false,
      createdAt: now,
      updatedAt: now,
    };

    try {
      const reserved =
        reserveOrderStock(order);

      saveCommerceOrders([
        reserved,
        ...orders,
      ]);

      setSavedOrder(
        reserved,
      );

      setStock(
        loadStorage(
          STORAGE_KEYS.stock,
          [],
        ),
      );

      notify(
        `${reserved.number} creado y stock reservado`,
      );
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "No se pudo reservar el stock",
      );
    }
  }

  return (
    <AppShell>
      <div className="commerce-page">
        <header className="commerce-header">
          <div>
            <span className="commerce-kicker">
              FASE 8 · PEDIDOS
            </span>

            <h1>
              Crear pedido mayorista
            </h1>

            <p>
              Seleccioná producto, color,
              talle y cantidad. El sistema
              validará y reservará el
              inventario automáticamente.
            </p>
          </div>

          <Link
            href="/catalog/stock"
            className="order-stock-link"
          >
            Ver inventario
          </Link>
        </header>

        <section className="order-layout">
          <main>
            <section className="commerce-panel padded">
              <div className="commerce-section-heading">
                <div>
                  <span>
                    CLIENTE
                  </span>

                  <h2>
                    Información comercial
                  </h2>
                </div>
              </div>

              <div className="commerce-form-grid">
                <label>
                  <span>
                    Nombre del cliente
                  </span>

                  <input
                    value={
                      customerName
                    }
                    onChange={(event) =>
                      setCustomerName(
                        event.target
                          .value,
                      )
                    }
                  />
                </label>

                <label>
                  <span>
                    Comercio
                  </span>

                  <input
                    value={
                      businessName
                    }
                    onChange={(event) =>
                      setBusinessName(
                        event.target
                          .value,
                      )
                    }
                  />
                </label>

                <label>
                  <span>
                    WhatsApp
                  </span>

                  <input
                    value={whatsapp}
                    onChange={(event) =>
                      setWhatsapp(
                        event.target
                          .value,
                      )
                    }
                  />
                </label>

                <label>
                  <span>
                    Provincia
                  </span>

                  <input
                    value={province}
                    onChange={(event) =>
                      setProvince(
                        event.target
                          .value,
                      )
                    }
                  />
                </label>

                <label>
                  <span>
                    Vendedor
                  </span>

                  <input
                    value={seller}
                    onChange={(event) =>
                      setSeller(
                        event.target
                          .value,
                      )
                    }
                  />
                </label>

                <label>
                  <span>
                    Lista de precios
                  </span>

                  <select
                    value={priceList}
                    onChange={(event) =>
                      setPriceList(
                        event.target
                          .value,
                      )
                    }
                  >
                    <option>
                      Mayorista
                    </option>

                    <option>
                      Transferencia
                    </option>

                    <option>
                      Efectivo
                    </option>

                    <option>
                      Distribuidor
                    </option>
                  </select>
                </label>
              </div>
            </section>

            <section className="commerce-panel padded order-product-selector">
              <div className="commerce-section-heading">
                <div>
                  <span>
                    AGREGAR PRENDA
                  </span>

                  <h2>
                    Producto, color y talle
                  </h2>
                </div>
              </div>

              <div className="order-selector-grid">
                <label>
                  <span>
                    Producto
                  </span>

                  <select
                    value={
                      selectedProductId
                    }
                    onChange={(event) =>
                      changeProduct(
                        event.target
                          .value,
                      )
                    }
                  >
                    {products.map(
                      (product) => (
                        <option
                          key={
                            product.id
                          }
                          value={
                            product.id
                          }
                        >
                          {
                            product.name
                          }
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <label>
                  <span>Color</span>

                  <select
                    value={
                      selectedColorId
                    }
                    onChange={(event) =>
                      changeColor(
                        event.target
                          .value,
                      )
                    }
                  >
                    {colors.map(
                      (color) => (
                        <option
                          key={
                            color.id
                          }
                          value={
                            color.id
                          }
                        >
                          {
                            color.name
                          }
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <label>
                  <span>Talle</span>

                  <select
                    value={
                      selectedCellId
                    }
                    onChange={(event) =>
                      setSelectedCellId(
                        event.target
                          .value,
                      )
                    }
                  >
                    {variantCells.map(
                      (cell) => (
                        <option
                          key={
                            cell.id
                          }
                          value={
                            cell.id
                          }
                          disabled={
                            getAvailableStock(
                              cell,
                            ) === 0
                          }
                        >
                          Talle{" "}
                          {cell.size} ·{" "}
                          {getAvailableStock(
                            cell,
                          )}{" "}
                          disponibles
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <label>
                  <span>
                    Cantidad
                  </span>

                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(event) =>
                      setQuantity(
                        Number(
                          event.target
                            .value,
                        ),
                      )
                    }
                  />
                </label>

                <div className="order-variant-summary">
                  <span>
                    Disponible
                  </span>

                  <strong>
                    {selectedCell
                      ? getAvailableStock(
                          selectedCell,
                        )
                      : 0}
                  </strong>

                  <small>
                    {
                      selectedCell?.sku
                    }
                  </small>
                </div>

                <button
                  type="button"
                  onClick={addLine}
                >
                  Agregar al pedido
                </button>
              </div>
            </section>

            <section className="commerce-panel order-lines-panel">
              <div className="commerce-section-heading">
                <div>
                  <span>
                    DETALLE
                  </span>

                  <h2>
                    Prendas seleccionadas
                  </h2>
                </div>
              </div>

              {lines.length === 0 ? (
                <div className="commerce-empty">
                  <strong>
                    El pedido está vacío
                  </strong>

                  <p>
                    Seleccioná una prenda,
                    color, talle y cantidad.
                  </p>
                </div>
              ) : (
                <div className="commerce-table-wrap">
                  <table className="commerce-table">
                    <thead>
                      <tr>
                        <th>
                          Producto
                        </th>

                        <th>Color</th>
                        <th>Talle</th>
                        <th>SKU</th>
                        <th>
                          Cantidad
                        </th>

                        <th>
                          Precio
                        </th>

                        <th>
                          Descuento
                        </th>

                        <th>
                          Subtotal
                        </th>

                        <th />
                      </tr>
                    </thead>

                    <tbody>
                      {lines.map(
                        (line) => (
                          <tr
                            key={line.id}
                          >
                            <td>
                              <strong>
                                {
                                  line.productName
                                }
                              </strong>
                            </td>

                            <td>
                              <span className="color-cell">
                                <i
                                  style={{
                                    background:
                                      line.colorHex,
                                  }}
                                />

                                {
                                  line.colorName
                                }
                              </span>
                            </td>

                            <td>
                              <strong>
                                {
                                  line.size
                                }
                              </strong>
                            </td>

                            <td>
                              <code>
                                {line.sku}
                              </code>
                            </td>

                            <td>
                              <input
                                type="number"
                                min="1"
                                value={
                                  line.quantity
                                }
                                onChange={(
                                  event,
                                ) =>
                                  updateLine(
                                    line.id,
                                    "quantity",
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
                                  line.unitPrice
                                }
                                onChange={(
                                  event,
                                ) =>
                                  updateLine(
                                    line.id,
                                    "unitPrice",
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
                                max="100"
                                value={
                                  line.discountPercent
                                }
                                onChange={(
                                  event,
                                ) =>
                                  updateLine(
                                    line.id,
                                    "discountPercent",
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
                              <strong>
                                {money(
                                  line.subtotal,
                                )}
                              </strong>
                            </td>

                            <td>
                              <button
                                type="button"
                                className="danger"
                                onClick={() =>
                                  removeLine(
                                    line.id,
                                  )
                                }
                              >
                                Quitar
                              </button>
                            </td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="commerce-panel padded">
              <div className="commerce-form-grid">
                <label>
                  <span>
                    Método de pago
                  </span>

                  <select
                    value={
                      paymentMethod
                    }
                    onChange={(event) =>
                      setPaymentMethod(
                        event.target
                          .value,
                      )
                    }
                  >
                    <option>
                      Transferencia bancaria
                    </option>

                    <option>
                      Mercado Pago
                    </option>

                    <option>
                      Efectivo
                    </option>

                    <option>
                      Cuenta corriente
                    </option>

                    <option>
                      Seña
                    </option>
                  </select>
                </label>

                <label>
                  <span>
                    Transporte
                  </span>

                  <select
                    value={
                      shippingMethod
                    }
                    onChange={(event) =>
                      setShippingMethod(
                        event.target
                          .value,
                      )
                    }
                  >
                    <option>
                      Via Cargo
                    </option>

                    <option>
                      Andreani
                    </option>

                    <option>
                      OCA
                    </option>

                    <option>
                      Correo Argentino
                    </option>

                    <option>
                      Buspack
                    </option>

                    <option>
                      Retiro por local
                    </option>

                    <option>
                      Comisionista
                    </option>
                  </select>
                </label>

                <label>
                  <span>
                    Envío
                  </span>

                  <input
                    type="number"
                    min="0"
                    value={
                      shippingCost
                    }
                    onChange={(event) =>
                      setShippingCost(
                        Number(
                          event.target
                            .value,
                        ),
                      )
                    }
                  />
                </label>

                <label>
                  <span>
                    Descuento general
                  </span>

                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={
                      generalDiscount
                    }
                    onChange={(event) =>
                      setGeneralDiscount(
                        Number(
                          event.target
                            .value,
                        ),
                      )
                    }
                  />
                </label>

                <label className="full">
                  <span>Notas</span>

                  <textarea
                    value={notes}
                    onChange={(event) =>
                      setNotes(
                        event.target
                          .value,
                      )
                    }
                  />
                </label>
              </div>
            </section>
          </main>

          <aside className="order-summary">
            <span>
              RESUMEN DEL PEDIDO
            </span>

            <h3>
              {savedOrder
                ? savedOrder.number
                : "Nuevo pedido"}
            </h3>

            <div>
              <small>
                Prendas
              </small>

              <strong>
                {lines.reduce(
                  (
                    total,
                    line,
                  ) =>
                    total +
                    line.quantity,
                  0,
                )}
              </strong>
            </div>

            <div>
              <small>
                Subtotal
              </small>

              <strong>
                {money(subtotal)}
              </strong>
            </div>

            <div>
              <small>
                Descuento
              </small>

              <strong>
                -{money(discount)}
              </strong>
            </div>

            <div>
              <small>Envío</small>

              <strong>
                {money(
                  shippingCost,
                )}
              </strong>
            </div>

            <div className="order-total">
              <small>Total</small>

              <strong>
                {money(total)}
              </strong>
            </div>

            {savedOrder ? (
              <div className="order-reserved">
                <strong>
                  Stock reservado
                </strong>

                <p>
                  Las unidades ya no están
                  disponibles para otros
                  pedidos.
                </p>

                <Link href="/catalog/stock">
                  Revisar inventario
                </Link>
              </div>
            ) : (
              <button
                type="button"
                onClick={createOrder}
              >
                Crear y reservar stock
              </button>
            )}
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
