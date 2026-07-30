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
  seedStock,
  STORAGE_KEYS,
} from "../_commerce/commerce.storage";
import type {
  StockCell,
  StockLocation,
  StockMovement,
} from "../_commerce/commerce.types";
import {
  stockAvailable,
  stockProjected,
} from "../_commerce/commerce.types";
import "../_commerce/commerce.css";

export default function StockMatrixStudio() {
  const [cells, setCells] =
    useState<StockCell[]>([]);
  const [locations, setLocations] =
    useState<StockLocation[]>([]);
  const [movements, setMovements] =
    useState<StockMovement[]>([]);
  const [search, setSearch] =
    useState("");
  const [locationId, setLocationId] =
    useState("all");
  const [onlyAlerts, setOnlyAlerts] =
    useState(false);
  const [notice, setNotice] =
    useState("");

  useEffect(() => {
    setCells(
      loadStorage(
        STORAGE_KEYS.stock,
        seedStock(),
      ),
    );

    setLocations(
      loadStorage(
        STORAGE_KEYS.locations,
        seedLocations(),
      ),
    );

    setMovements(
      loadStorage(
        STORAGE_KEYS.movements,
        [],
      ),
    );
  }, []);

  const filtered = useMemo(() => {
    const query =
      search.trim().toLowerCase();

    return cells.filter((cell) => {
      const matchesQuery =
        !query ||
        [
          cell.productName,
          cell.baseSku,
          cell.colorName,
          cell.size,
          cell.sku,
          cell.barcode,
        ].some((value) =>
          value
            .toLowerCase()
            .includes(query),
        );

      const matchesLocation =
        locationId === "all" ||
        cell.locationId ===
          locationId;

      const matchesAlert =
        !onlyAlerts ||
        stockAvailable(cell) <=
          cell.minimum;

      return (
        matchesQuery &&
        matchesLocation &&
        matchesAlert
      );
    });
  }, [
    cells,
    search,
    locationId,
    onlyAlerts,
  ]);

  const summary = useMemo(() => {
    return cells.reduce(
      (result, cell) => {
        result.physical +=
          cell.physical;
        result.reserved +=
          cell.reserved;
        result.committed +=
          cell.committed;
        result.available +=
          stockAvailable(cell);
        result.projected +=
          stockProjected(cell);

        if (
          stockAvailable(cell) <=
          cell.minimum
        ) {
          result.alerts += 1;
        }

        return result;
      },
      {
        physical: 0,
        reserved: 0,
        committed: 0,
        available: 0,
        projected: 0,
        alerts: 0,
      },
    );
  }, [cells]);

  function notify(message: string) {
    setNotice(message);

    window.setTimeout(
      () => setNotice(""),
      2200,
    );
  }

  function persist(
    next: StockCell[],
  ) {
    setCells(next);

    saveStorage(
      STORAGE_KEYS.stock,
      next,
    );
  }

  function updateCell(
    cellId: string,
    field: keyof StockCell,
    value:
      | string
      | number
      | boolean,
  ) {
    const current =
      cells.find(
        (cell) =>
          cell.id === cellId,
      );

    if (!current) return;

    const next = cells.map(
      (cell) =>
        cell.id === cellId
          ? {
              ...cell,
              [field]: value,
              updatedAt:
                new Date().toISOString(),
            }
          : cell,
    );

    persist(next);
  }

  function adjustStock(
    cell: StockCell,
  ) {
    const raw = window.prompt(
      `Ajuste para ${cell.sku}. Usá positivo para sumar o negativo para restar.`,
      "0",
    );

    if (raw === null) return;

    const quantity = Number(raw);

    if (
      !Number.isFinite(quantity) ||
      quantity === 0
    ) {
      notify(
        "Ingresá una cantidad válida",
      );
      return;
    }

    const reason =
      window.prompt(
        "Motivo del ajuste",
        "Ajuste manual de inventario",
      ) || "Ajuste manual";

    const nextPhysical =
      Math.max(
        0,
        cell.physical + quantity,
      );

    const movement =
      createMovement({
        stockCellId: cell.id,
        type: "adjustment",
        quantity,
        previousPhysical:
          cell.physical,
        newPhysical:
          nextPhysical,
        reason,
        reference: "",
        user:
          "Superadministrador",
      });

    const nextMovements = [
      movement,
      ...movements,
    ];

    setMovements(nextMovements);

    saveStorage(
      STORAGE_KEYS.movements,
      nextMovements,
    );

    updateCell(
      cell.id,
      "physical",
      nextPhysical,
    );

    notify(
      "Movimiento de stock registrado",
    );
  }

  function exportCsv() {
    const rows = [
      [
        "Producto",
        "SKU",
        "Color",
        "Talle",
        "Físico",
        "Reservado",
        "Comprometido",
        "Disponible",
        "Entrante",
        "Producción",
        "Proyectado",
        "Ubicación",
      ],
      ...filtered.map((cell) => [
        cell.productName,
        cell.sku,
        cell.colorName,
        cell.size,
        String(cell.physical),
        String(cell.reserved),
        String(cell.committed),
        String(
          stockAvailable(cell),
        ),
        String(cell.incoming),
        String(cell.production),
        String(
          stockProjected(cell),
        ),
        locations.find(
          (location) =>
            location.id ===
            cell.locationId,
        )?.name || "",
      ]),
    ];

    const csv = rows
      .map((row) =>
        row
          .map(
            (value) =>
              `"${String(value).replace(
                /"/g,
                '""',
              )}"`,
          )
          .join(","),
      )
      .join("\n");

    const blob = new Blob(
      [csv],
      {
        type: "text/csv;charset=utf-8",
      },
    );

    const url =
      URL.createObjectURL(blob);

    const anchor =
      document.createElement("a");

    anchor.href = url;
    anchor.download =
      "stock-fulanitas.csv";
    anchor.click();

    URL.revokeObjectURL(url);
  }

  return (
    <AppShell>
      <div className="commerce-page">
        <header className="commerce-header">
          <div>
            <span className="commerce-kicker">
              FASE 3 · INVENTARIO
            </span>

            <h1>
              Matriz avanzada de stock
            </h1>

            <p>
              Stock por producto, color,
              talle, ubicación y estado
              operativo.
            </p>
          </div>

          <div className="commerce-actions">
            <button
              type="button"
              onClick={exportCsv}
            >
              Exportar CSV
            </button>

            <button
              type="button"
              className="primary"
              onClick={() =>
                notify(
                  "Los cambios ya se guardan automáticamente",
                )
              }
            >
              Guardar inventario
            </button>
          </div>
        </header>

        <CatalogCommerceNav />

        <section className="commerce-metrics six">
          <article>
            <span>Stock físico</span>
            <strong>
              {summary.physical}
            </strong>
            <small>
              Unidades registradas
            </small>
          </article>

          <article>
            <span>Reservado</span>
            <strong>
              {summary.reserved}
            </strong>
            <small>
              Separado para clientes
            </small>
          </article>

          <article>
            <span>Comprometido</span>
            <strong>
              {summary.committed}
            </strong>
            <small>
              Pedidos confirmados
            </small>
          </article>

          <article>
            <span>Disponible</span>
            <strong>
              {summary.available}
            </strong>
            <small>
              Vendible ahora
            </small>
          </article>

          <article>
            <span>Proyectado</span>
            <strong>
              {summary.projected}
            </strong>
            <small>
              Incluye tránsito y producción
            </small>
          </article>

          <article>
            <span>Alertas</span>
            <strong className="warning">
              {summary.alerts}
            </strong>
            <small>
              Talles bajo mínimo
            </small>
          </article>
        </section>

        <section className="commerce-panel">
          <div className="commerce-toolbar">
            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
              placeholder="Buscar producto, SKU, color o talle"
            />

            <select
              value={locationId}
              onChange={(event) =>
                setLocationId(
                  event.target.value,
                )
              }
            >
              <option value="all">
                Todas las ubicaciones
              </option>

              {locations.map(
                (location) => (
                  <option
                    key={location.id}
                    value={location.id}
                  >
                    {location.name}
                  </option>
                ),
              )}
            </select>

            <label className="commerce-check">
              <input
                type="checkbox"
                checked={onlyAlerts}
                onChange={(event) =>
                  setOnlyAlerts(
                    event.target.checked,
                  )
                }
              />

              Solo stock bajo
            </label>
          </div>

          <div className="commerce-table-wrap">
            <table className="commerce-table stock">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Color</th>
                  <th>Talle</th>
                  <th>SKU</th>
                  <th>Físico</th>
                  <th>Reservado</th>
                  <th>Comprometido</th>
                  <th>Disponible</th>
                  <th>Tránsito</th>
                  <th>Producción</th>
                  <th>Dañado</th>
                  <th>Proyectado</th>
                  <th>Mínimo</th>
                  <th>Ubicación</th>
                  <th>Acción</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((cell) => {
                  const available =
                    stockAvailable(cell);

                  const low =
                    available <=
                    cell.minimum;

                  return (
                    <tr
                      key={cell.id}
                      className={
                        low
                          ? "stock-alert"
                          : ""
                      }
                    >
                      <td>
                        <strong>
                          {
                            cell.productName
                          }
                        </strong>

                        <small>
                          {cell.baseSku}
                        </small>
                      </td>

                      <td>
                        <span className="color-cell">
                          <i
                            style={{
                              background:
                                cell.colorHex,
                            }}
                          />

                          {
                            cell.colorName
                          }
                        </span>
                      </td>

                      <td>
                        <strong>
                          {cell.size}
                        </strong>
                      </td>

                      <td>
                        <code>
                          {cell.sku}
                        </code>
                      </td>

                      {[
                        "physical",
                        "reserved",
                        "committed",
                      ].map((field) => (
                        <td key={field}>
                          <input
                            type="number"
                            min="0"
                            value={
                              cell[
                                field as keyof StockCell
                              ] as number
                            }
                            onChange={(
                              event,
                            ) =>
                              updateCell(
                                cell.id,
                                field as keyof StockCell,
                                Number(
                                  event
                                    .target
                                    .value,
                                ),
                              )
                            }
                          />
                        </td>
                      ))}

                      <td>
                        <strong
                          className={
                            low
                              ? "warning"
                              : "success"
                          }
                        >
                          {available}
                        </strong>
                      </td>

                      {[
                        "incoming",
                        "production",
                        "damaged",
                      ].map((field) => (
                        <td key={field}>
                          <input
                            type="number"
                            min="0"
                            value={
                              cell[
                                field as keyof StockCell
                              ] as number
                            }
                            onChange={(
                              event,
                            ) =>
                              updateCell(
                                cell.id,
                                field as keyof StockCell,
                                Number(
                                  event
                                    .target
                                    .value,
                                ),
                              )
                            }
                          />
                        </td>
                      ))}

                      <td>
                        <strong>
                          {stockProjected(
                            cell,
                          )}
                        </strong>
                      </td>

                      <td>
                        <input
                          type="number"
                          min="0"
                          value={
                            cell.minimum
                          }
                          onChange={(
                            event,
                          ) =>
                            updateCell(
                              cell.id,
                              "minimum",
                              Number(
                                event.target
                                  .value,
                              ),
                            )
                          }
                        />
                      </td>

                      <td>
                        <select
                          value={
                            cell.locationId
                          }
                          onChange={(
                            event,
                          ) =>
                            updateCell(
                              cell.id,
                              "locationId",
                              event.target
                                .value,
                            )
                          }
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
                                {
                                  location.name
                                }
                              </option>
                            ),
                          )}
                        </select>
                      </td>

                      <td>
                        <button
                          type="button"
                          onClick={() =>
                            adjustStock(
                              cell,
                            )
                          }
                        >
                          Ajustar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="commerce-section">
          <div className="commerce-section-heading">
            <div>
              <span>
                TRAZABILIDAD
              </span>

              <h2>
                Movimientos recientes
              </h2>
            </div>
          </div>

          <div className="commerce-panel">
            {movements.length === 0 ? (
              <div className="commerce-empty">
                <strong>
                  Todavía no hay movimientos manuales
                </strong>

                <p>
                  Los ajustes, ingresos,
                  devoluciones y transferencias
                  aparecerán acá.
                </p>
              </div>
            ) : (
              <div className="commerce-timeline">
                {movements
                  .slice(0, 20)
                  .map((movement) => (
                    <article
                      key={movement.id}
                    >
                      <span />

                      <div>
                        <strong>
                          {
                            movement.reason
                          }
                        </strong>

                        <p>
                          Cantidad:{" "}
                          {
                            movement.quantity
                          }{" "}
                          · Stock anterior:{" "}
                          {
                            movement.previousPhysical
                          }{" "}
                          · Nuevo:{" "}
                          {
                            movement.newPhysical
                          }
                        </p>
                      </div>

                      <time>
                        {new Date(
                          movement.createdAt,
                        ).toLocaleString(
                          "es-AR",
                        )}
                      </time>
                    </article>
                  ))}
              </div>
            )}
          </div>
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
