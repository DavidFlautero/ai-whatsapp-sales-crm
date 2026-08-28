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
  createId,
  loadStorage,
  saveStorage,
  seedCurves,
  seedStock,
  STORAGE_KEYS,
} from "../_commerce/commerce.storage";
import type {
  CurveLine,
  StockCell,
  WholesaleCurve,
} from "../_commerce/commerce.types";
import {
  curveTotalUnits,
  stockAvailable,
} from "../_commerce/commerce.types";
import "../_commerce/commerce.css";

export default function CurvesStudio() {
  const [curves, setCurves] =
    useState<WholesaleCurve[]>([]);
  const [stock, setStock] =
    useState<StockCell[]>([]);
  const [selectedId, setSelectedId] =
    useState("");
  const [notice, setNotice] =
    useState("");

  useEffect(() => {
    const loaded =
      loadStorage(
        STORAGE_KEYS.curves,
        seedCurves(),
      );

    setCurves(loaded);
    setSelectedId(
      loaded[0]?.id || "",
    );

    setStock(
      loadStorage(
        STORAGE_KEYS.stock,
        seedStock(),
      ),
    );
  }, []);

  const selected =
    curves.find(
      (curve) =>
        curve.id === selectedId,
    ) || null;

  const stockBySize = useMemo(() => {
    const result =
      new Map<string, number>();

    stock.forEach((cell) => {
      result.set(
        cell.size,
        (result.get(cell.size) ||
          0) +
          stockAvailable(cell),
      );
    });

    return result;
  }, [stock]);

  function notify(message: string) {
    setNotice(message);

    window.setTimeout(
      () => setNotice(""),
      2200,
    );
  }

  function persist(
    next: WholesaleCurve[],
  ) {
    setCurves(next);

    saveStorage(
      STORAGE_KEYS.curves,
      next,
    );
  }

  function updateCurve(
    updater: (
      curve: WholesaleCurve,
    ) => WholesaleCurve,
  ) {
    persist(
      curves.map((curve) =>
        curve.id === selectedId
          ? {
              ...updater(curve),
              updatedAt:
                new Date().toISOString(),
            }
          : curve,
      ),
    );
  }

  function createCurve() {
    const now =
      new Date().toISOString();

    const curve: WholesaleCurve = {
      id: createId("curve"),
      name: "Nueva curva",
      code: `CURVA-${curves.length + 1}`,
      description: "",
      productId: null,
      category: "General",
      colorMode:
        "customer_choice",
      saleMode: "curve",
      minimumUnits: 1,
      lines: [
        {
          id: createId("line"),
          size: "S",
          quantity: 1,
        },
      ],
      active: true,
      createdAt: now,
      updatedAt: now,
    };

    persist([
      curve,
      ...curves,
    ]);

    setSelectedId(curve.id);
    notify("Nueva curva creada");
  }

  function duplicateCurve() {
    if (!selected) return;

    const copy: WholesaleCurve = {
      ...structuredClone(
        selected,
      ),
      id: createId("curve"),
      name: `${selected.name} copia`,
      code: `${selected.code}-COPIA`,
      lines: selected.lines.map(
        (line) => ({
          ...line,
          id: createId("line"),
        }),
      ),
      createdAt:
        new Date().toISOString(),
      updatedAt:
        new Date().toISOString(),
    };

    persist([
      copy,
      ...curves,
    ]);

    setSelectedId(copy.id);
    notify("Curva duplicada");
  }

  function deleteCurve() {
    if (
      !selected ||
      !window.confirm(
        `¿Eliminar ${selected.name}?`,
      )
    ) {
      return;
    }

    const remaining =
      curves.filter(
        (curve) =>
          curve.id !== selected.id,
      );

    persist(remaining);
    setSelectedId(
      remaining[0]?.id || "",
    );
  }

  function addLine() {
    updateCurve((curve) => ({
      ...curve,
      lines: [
        ...curve.lines,
        {
          id: createId("line"),
          size: "Único",
          quantity: 1,
        },
      ],
    }));
  }

  function updateLine(
    lineId: string,
    field: keyof CurveLine,
    value: string | number,
  ) {
    updateCurve((curve) => ({
      ...curve,
      lines: curve.lines.map(
        (line) =>
          line.id === lineId
            ? {
                ...line,
                [field]: value,
              }
            : line,
      ),
    }));
  }

  function removeLine(
    lineId: string,
  ) {
    updateCurve((curve) => ({
      ...curve,
      lines: curve.lines.filter(
        (line) =>
          line.id !== lineId,
      ),
    }));
  }

  const units = selected
    ? curveTotalUnits(selected)
    : 0;

  const possiblePacks =
    selected &&
    selected.lines.length > 0
      ? Math.min(
          ...selected.lines
            .filter(
              (line) =>
                line.quantity > 0,
            )
            .map((line) =>
              Math.floor(
                (stockBySize.get(
                  line.size,
                ) || 0) /
                  line.quantity,
              ),
            ),
        )
      : 0;

  return (
    <AppShell>
      <div className="commerce-page">
        <header className="commerce-header">
          <div>
            <span className="commerce-kicker">
              FASE 4 · MAYORISTA
            </span>

            <h1>
              Curvas, packs y cantidades
            </h1>

            <p>
              Armá combinaciones de talles
              listas para vender por
              WhatsApp, mostrador o
              vendedores.
            </p>
          </div>

          <div className="commerce-actions">
            <button
              type="button"
              onClick={duplicateCurve}
              disabled={!selected}
            >
              Duplicar
            </button>

            <button
              type="button"
              className="primary"
              onClick={createCurve}
            >
              + Nueva curva
            </button>
          </div>
        </header>

        <CatalogCommerceNav />

        <section className="commerce-metrics">
          <article>
            <span>Curvas activas</span>
            <strong>
              {
                curves.filter(
                  (curve) =>
                    curve.active,
                ).length
              }
            </strong>
            <small>
              Disponibles para vender
            </small>
          </article>

          <article>
            <span>Packs configurados</span>
            <strong>
              {
                curves.filter(
                  (curve) =>
                    curve.saleMode ===
                    "pack",
                ).length
              }
            </strong>
            <small>
              Combinaciones rápidas
            </small>
          </article>

          <article>
            <span>Unidades de la curva</span>
            <strong>{units}</strong>
            <small>
              Curva seleccionada
            </small>
          </article>

          <article>
            <span>Packs posibles</span>
            <strong>
              {Number.isFinite(
                possiblePacks,
              )
                ? possiblePacks
                : 0}
            </strong>
            <small>
              Según stock actual
            </small>
          </article>

          <article>
            <span>Venta mínima</span>
            <strong>
              {selected?.minimumUnits ||
                0}
            </strong>
            <small>
              Unidades requeridas
            </small>
          </article>
        </section>

        <section className="commerce-split">
          <aside className="commerce-list-panel">
            <div className="commerce-list-heading">
              <span>
                CONFIGURACIONES
              </span>

              <strong>
                Curvas disponibles
              </strong>
            </div>

            <div className="commerce-item-list">
              {curves.map((curve) => (
                <button
                  type="button"
                  key={curve.id}
                  className={
                    selectedId ===
                    curve.id
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setSelectedId(
                      curve.id,
                    )
                  }
                >
                  <span>
                    <strong>
                      {curve.name}
                    </strong>

                    <small>
                      {curve.code} ·{" "}
                      {curveTotalUnits(
                        curve,
                      )}{" "}
                      unidades
                    </small>
                  </span>

                  <em>
                    {curve.active
                      ? "Activa"
                      : "Pausada"}
                  </em>
                </button>
              ))}
            </div>
          </aside>

          <main className="commerce-editor">
            {!selected ? (
              <div className="commerce-empty">
                <strong>
                  No hay curvas creadas
                </strong>

                <button
                  type="button"
                  className="primary"
                  onClick={createCurve}
                >
                  Crear curva
                </button>
              </div>
            ) : (
              <>
                <div className="commerce-editor-heading">
                  <div>
                    <span>
                      {selected.code}
                    </span>

                    <h2>
                      {selected.name}
                    </h2>

                    <p>
                      {
                        selected.description
                      }
                    </p>
                  </div>

                  <button
                    type="button"
                    className="danger"
                    onClick={deleteCurve}
                  >
                    Eliminar
                  </button>
                </div>

                <section className="commerce-form-grid">
                  <label>
                    <span>
                      Nombre comercial
                    </span>

                    <input
                      value={
                        selected.name
                      }
                      onChange={(event) =>
                        updateCurve(
                          (curve) => ({
                            ...curve,
                            name:
                              event.target
                                .value,
                          }),
                        )
                      }
                    />
                  </label>

                  <label>
                    <span>Código</span>

                    <input
                      value={
                        selected.code
                      }
                      onChange={(event) =>
                        updateCurve(
                          (curve) => ({
                            ...curve,
                            code:
                              event.target
                                .value
                                .toUpperCase(),
                          }),
                        )
                      }
                    />
                  </label>

                  <label>
                    <span>Categoría</span>

                    <input
                      value={
                        selected.category
                      }
                      onChange={(event) =>
                        updateCurve(
                          (curve) => ({
                            ...curve,
                            category:
                              event.target
                                .value,
                          }),
                        )
                      }
                    />
                  </label>

                  <label>
                    <span>
                      Tipo de venta
                    </span>

                    <select
                      value={
                        selected.saleMode
                      }
                      onChange={(event) =>
                        updateCurve(
                          (curve) => ({
                            ...curve,
                            saleMode:
                              event.target
                                .value as WholesaleCurve["saleMode"],
                          }),
                        )
                      }
                    >
                      <option value="curve">
                        Curva completa
                      </option>

                      <option value="half_curve">
                        Media curva
                      </option>

                      <option value="pack">
                        Pack
                      </option>

                      <option value="dozen">
                        Docena
                      </option>

                      <option value="bundle">
                        Bulto
                      </option>
                    </select>
                  </label>

                  <label>
                    <span>
                      Modalidad de colores
                    </span>

                    <select
                      value={
                        selected.colorMode
                      }
                      onChange={(event) =>
                        updateCurve(
                          (curve) => ({
                            ...curve,
                            colorMode:
                              event.target
                                .value as WholesaleCurve["colorMode"],
                          }),
                        )
                      }
                    >
                      <option value="single">
                        Un solo color
                      </option>

                      <option value="assorted">
                        Colores surtidos
                      </option>

                      <option value="customer_choice">
                        El cliente elige
                      </option>
                    </select>
                  </label>

                  <label>
                    <span>
                      Cantidad mínima
                    </span>

                    <input
                      type="number"
                      min="1"
                      value={
                        selected.minimumUnits
                      }
                      onChange={(event) =>
                        updateCurve(
                          (curve) => ({
                            ...curve,
                            minimumUnits:
                              Number(
                                event.target
                                  .value,
                              ),
                          }),
                        )
                      }
                    />
                  </label>

                  <label className="full">
                    <span>
                      Descripción para vendedores
                    </span>

                    <textarea
                      value={
                        selected.description
                      }
                      onChange={(event) =>
                        updateCurve(
                          (curve) => ({
                            ...curve,
                            description:
                              event.target
                                .value,
                          }),
                        )
                      }
                    />
                  </label>

                  <label className="commerce-switch">
                    <input
                      type="checkbox"
                      checked={
                        selected.active
                      }
                      onChange={(event) =>
                        updateCurve(
                          (curve) => ({
                            ...curve,
                            active:
                              event.target
                                .checked,
                          }),
                        )
                      }
                    />

                    <span>
                      Curva disponible para
                      vendedores
                    </span>
                  </label>
                </section>

                <section className="commerce-section">
                  <div className="commerce-section-heading">
                    <div>
                      <span>
                        COMPOSICIÓN
                      </span>

                      <h2>
                        Talles y cantidades
                      </h2>
                    </div>

                    <button
                      type="button"
                      onClick={addLine}
                    >
                      + Agregar talle
                    </button>
                  </div>

                  <div className="curve-lines">
                    {selected.lines.map(
                      (line) => {
                        const available =
                          stockBySize.get(
                            line.size,
                          ) || 0;

                        const enough =
                          available >=
                          line.quantity;

                        return (
                          <article
                            key={line.id}
                          >
                            <label>
                              <span>
                                Talle
                              </span>

                              <input
                                value={
                                  line.size
                                }
                                onChange={(
                                  event,
                                ) =>
                                  updateLine(
                                    line.id,
                                    "size",
                                    event
                                      .target
                                      .value,
                                  )
                                }
                              />
                            </label>

                            <label>
                              <span>
                                Cantidad
                              </span>

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
                            </label>

                            <div>
                              <span>
                                Stock disponible
                              </span>

                              <strong
                                className={
                                  enough
                                    ? "success"
                                    : "warning"
                                }
                              >
                                {available}
                              </strong>
                            </div>

                            <button
                              type="button"
                              className="danger"
                              onClick={() =>
                                removeLine(
                                  line.id,
                                )
                              }
                            >
                              Eliminar
                            </button>
                          </article>
                        );
                      },
                    )}
                  </div>
                </section>

                <section className="curve-preview">
                  <span>
                    PREVISUALIZACIÓN MAYORISTA
                  </span>

                  <h3>
                    {selected.name}
                  </h3>

                  <p>
                    {selected.description ||
                      "Combinación mayorista configurada."}
                  </p>

                  <div className="curve-preview-grid">
                    {selected.lines.map(
                      (line) => (
                        <article
                          key={line.id}
                        >
                          <strong>
                            {line.size}
                          </strong>

                          <span>
                            ×{" "}
                            {
                              line.quantity
                            }
                          </span>
                        </article>
                      ),
                    )}
                  </div>

                  <div className="curve-preview-total">
                    <span>
                      Total por curva
                    </span>

                    <strong>
                      {units} prendas
                    </strong>
                  </div>

                  <button type="button">
                    Agregar curva al pedido
                  </button>
                </section>
              </>
            )}
          </main>
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
