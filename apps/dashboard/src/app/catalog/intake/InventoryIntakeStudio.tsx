"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AppShell,
} from "../../../components/app-shell/AppShell";

import {
  CatalogCommerceNav,
} from "../_commerce/CatalogCommerceNav";

import {
  createMovement,
  loadStorage,
  saveStorage,
  seedLocations,
  STORAGE_KEYS,
} from "../_commerce/commerce.storage";

import type {
  StockCell,
  StockLocation,
  StockMovement,
} from "../_commerce/commerce.types";

import {
  syncAllProductsToInventory,
} from "../_inventory/inventory-sync";

import "../_commerce/commerce.css";
import "./inventory-intake.css";

type IntakeLine = {
  stockCellId: string;
  quantity: number;
  unitCost: number;
};

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export default function InventoryIntakeStudio() {
  const [stock, setStock] =
    useState<StockCell[]>([]);

  const [locations, setLocations] =
    useState<StockLocation[]>([]);

  const [movements, setMovements] =
    useState<StockMovement[]>([]);

  const [
    selectedProductId,
    setSelectedProductId,
  ] = useState("");

  const [selectedColorId, setSelectedColorId] =
    useState("");

  const [locationId, setLocationId] =
    useState("location-main");

  const [supplier, setSupplier] =
    useState("");

  const [reference, setReference] =
    useState("");

  const [notes, setNotes] =
    useState("");

  const [lines, setLines] =
    useState<IntakeLine[]>([]);

  const [notice, setNotice] =
    useState("");

  useEffect(() => {
    syncAllProductsToInventory();

    const currentStock =
      loadStorage<StockCell[]>(
        STORAGE_KEYS.stock,
        [],
      );

    const currentLocations =
      loadStorage<StockLocation[]>(
        STORAGE_KEYS.locations,
        seedLocations(),
      );

    const currentMovements =
      loadStorage<StockMovement[]>(
        STORAGE_KEYS.movements,
        [],
      );

    setStock(currentStock);
    setLocations(
      currentLocations,
    );
    setMovements(
      currentMovements,
    );

    const first =
      currentStock[0];

    if (first) {
      setSelectedProductId(
        first.productId,
      );

      setSelectedColorId(
        first.colorId,
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

  const availableCells =
    useMemo(
      () =>
        stock.filter(
          (cell) =>
            cell.productId ===
              selectedProductId &&
            cell.colorId ===
              selectedColorId &&
            cell.locationId ===
              locationId,
        ),
      [
        stock,
        selectedProductId,
        selectedColorId,
        locationId,
      ],
    );

  const totalUnits =
    lines.reduce(
      (total, line) =>
        total + line.quantity,
      0,
    );

  const totalCost =
    lines.reduce(
      (total, line) =>
        total +
        line.quantity *
          line.unitCost,
      0,
    );

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

    setLines([]);
  }

  function toggleCell(
    cell: StockCell,
  ) {
    const exists =
      lines.some(
        (line) =>
          line.stockCellId ===
          cell.id,
      );

    if (exists) {
      setLines((current) =>
        current.filter(
          (line) =>
            line.stockCellId !==
            cell.id,
        ),
      );
      return;
    }

    setLines((current) => [
      ...current,
      {
        stockCellId: cell.id,
        quantity: 1,
        unitCost: 0,
      },
    ]);
  }

  function updateLine(
    stockCellId: string,
    field:
      | "quantity"
      | "unitCost",
    value: number,
  ) {
    setLines((current) =>
      current.map((line) =>
        line.stockCellId ===
        stockCellId
          ? {
              ...line,
              [field]:
                Math.max(0, value),
            }
          : line,
      ),
    );
  }

  function completeIntake() {
    if (lines.length === 0) {
      notify(
        "Seleccioná al menos un talle",
      );
      return;
    }

    if (totalUnits <= 0) {
      notify(
        "Ingresá una cantidad mayor a cero",
      );
      return;
    }

    const newMovements: StockMovement[] =
      [];

    const nextStock =
      stock.map((cell) => {
        const line =
          lines.find(
            (item) =>
              item.stockCellId ===
              cell.id,
          );

        if (!line) return cell;

        const newPhysical =
          cell.physical +
          line.quantity;

        newMovements.push(
          createMovement({
            stockCellId:
              cell.id,
            type: "purchase",
            quantity:
              line.quantity,
            previousPhysical:
              cell.physical,
            newPhysical,
            reason:
              notes ||
              "Ingreso de mercadería",
            reference,
            user:
              "Superadministrador",
          }),
        );

        return {
          ...cell,
          physical:
            newPhysical,
          incoming: Math.max(
            0,
            cell.incoming -
              line.quantity,
          ),
          updatedAt:
            new Date().toISOString(),
        };
      });

    const nextMovements = [
      ...newMovements,
      ...movements,
    ];

    setStock(nextStock);
    setMovements(
      nextMovements,
    );

    saveStorage(
      STORAGE_KEYS.stock,
      nextStock,
    );

    saveStorage(
      STORAGE_KEYS.movements,
      nextMovements,
    );

    const intakeRecord = {
      id: uid("intake"),
      supplier,
      reference,
      notes,
      locationId,
      lines,
      totalUnits,
      totalCost,
      createdAt:
        new Date().toISOString(),
    };

    const existing =
      loadStorage<any[]>(
        "fulanitas_inventory_intakes_v1",
        [],
      );

    saveStorage(
      "fulanitas_inventory_intakes_v1",
      [
        intakeRecord,
        ...existing,
      ],
    );

    setLines([]);
    setSupplier("");
    setReference("");
    setNotes("");

    notify(
      `${totalUnits} unidades ingresadas al inventario`,
    );
  }

  return (
    <AppShell>
      <div className="commerce-page">
        <header className="commerce-header">
          <div>
            <span className="commerce-kicker">
              FASE 7 · INGRESO
            </span>

            <h1>
              Ingreso de mercadería
            </h1>

            <p>
              Seleccioná la prenda, color,
              talles y cantidades recibidas
              para actualizar el inventario.
            </p>
          </div>
        </header>

        <CatalogCommerceNav />

        <section className="intake-layout">
          <main className="commerce-panel padded">
            <div className="commerce-section-heading">
              <div>
                <span>
                  MERCADERÍA RECIBIDA
                </span>

                <h2>
                  Seleccionar variantes
                </h2>
              </div>
            </div>

            <div className="commerce-form-grid">
              <label>
                <span>Producto</span>

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
                        {product.name} ·{" "}
                        {
                          product.baseSku
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
                  onChange={(event) => {
                    setSelectedColorId(
                      event.target
                        .value,
                    );
                    setLines([]);
                  }}
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
                        {color.name}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                <span>
                  Ubicación de ingreso
                </span>

                <select
                  value={locationId}
                  onChange={(event) => {
                    setLocationId(
                      event.target
                        .value,
                    );
                    setLines([]);
                  }}
                >
                  {locations.map(
                    (location) => (
                      <option
                        key={
                          location.id
                        }
                        value={
                          location.id
                        }
                      >
                        {location.name}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                <span>Proveedor</span>

                <input
                  value={supplier}
                  placeholder="Nombre del proveedor"
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
                  Factura o referencia
                </span>

                <input
                  value={reference}
                  placeholder="FAC-0001"
                  onChange={(event) =>
                    setReference(
                      event.target
                        .value,
                    )
                  }
                />
              </label>

              <label className="full">
                <span>
                  Observaciones
                </span>

                <textarea
                  value={notes}
                  placeholder="Ingreso de producción, compra a proveedor..."
                  onChange={(event) =>
                    setNotes(
                      event.target
                        .value,
                    )
                  }
                />
              </label>
            </div>

            <div className="intake-variant-grid">
              {availableCells.map(
                (cell) => {
                  const line =
                    lines.find(
                      (item) =>
                        item.stockCellId ===
                        cell.id,
                    );

                  return (
                    <article
                      key={cell.id}
                      className={
                        line
                          ? "selected"
                          : ""
                      }
                    >
                      <button
                        type="button"
                        className="intake-selector"
                        onClick={() =>
                          toggleCell(
                            cell,
                          )
                        }
                      >
                        <span>
                          Talle
                        </span>

                        <strong>
                          {cell.size}
                        </strong>

                        <small>
                          Actual:{" "}
                          {
                            cell.physical
                          }
                        </small>
                      </button>

                      {line ? (
                        <div className="intake-line-fields">
                          <label>
                            <span>
                              Cantidad
                            </span>

                            <input
                              type="number"
                              min="0"
                              value={
                                line.quantity
                              }
                              onChange={(
                                event,
                              ) =>
                                updateLine(
                                  cell.id,
                                  "quantity",
                                  Number(
                                    event
                                      .target
                                      .value,
                                  ),
                                )
                              }
                            />
                          </label>

                          <label>
                            <span>
                              Costo unitario
                            </span>

                            <input
                              type="number"
                              min="0"
                              value={
                                line.unitCost
                              }
                              onChange={(
                                event,
                              ) =>
                                updateLine(
                                  cell.id,
                                  "unitCost",
                                  Number(
                                    event
                                      .target
                                      .value,
                                  ),
                                )
                              }
                            />
                          </label>
                        </div>
                      ) : null}
                    </article>
                  );
                },
              )}
            </div>
          </main>

          <aside className="intake-summary">
            <span>
              RESUMEN DEL INGRESO
            </span>

            <h3>
              Mercadería seleccionada
            </h3>

            <div>
              <small>
                Talles seleccionados
              </small>

              <strong>
                {lines.length}
              </strong>
            </div>

            <div>
              <small>
                Total de unidades
              </small>

              <strong>
                {totalUnits}
              </strong>
            </div>

            <div>
              <small>
                Costo estimado
              </small>

              <strong>
                {new Intl.NumberFormat(
                  "es-AR",
                  {
                    style:
                      "currency",
                    currency:
                      "ARS",
                    maximumFractionDigits: 0,
                  },
                ).format(totalCost)}
              </strong>
            </div>

            <div className="intake-summary-lines">
              {lines.map((line) => {
                const cell =
                  stock.find(
                    (item) =>
                      item.id ===
                      line.stockCellId,
                  );

                if (!cell) return null;

                return (
                  <article
                    key={
                      line.stockCellId
                    }
                  >
                    <span>
                      {cell.colorName} ·{" "}
                      {cell.size}
                    </span>

                    <strong>
                      +{line.quantity}
                    </strong>
                  </article>
                );
              })}
            </div>

            <button
              type="button"
              onClick={completeIntake}
            >
              Confirmar ingreso
            </button>
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
