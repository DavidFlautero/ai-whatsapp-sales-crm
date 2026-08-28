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
  seedPriceLists,
  seedPrices,
  seedQuantityRules,
  STORAGE_KEYS,
} from "../_commerce/commerce.storage";
import type {
  PriceList,
  ProductPrice,
  QuantityRule,
} from "../_commerce/commerce.types";
import "../_commerce/commerce.css";

function money(
  value: number,
  currency: "ARS" | "USD",
) {
  return new Intl.NumberFormat(
    "es-AR",
    {
      style: "currency",
      currency,
      maximumFractionDigits:
        currency === "ARS" ? 0 : 2,
    },
  ).format(value);
}

export default function PricingStudio() {
  const [prices, setPrices] =
    useState<ProductPrice[]>([]);
  const [lists, setLists] =
    useState<PriceList[]>([]);
  const [rules, setRules] =
    useState<QuantityRule[]>([]);
  const [increase, setIncrease] =
    useState(10);
  const [roundTo, setRoundTo] =
    useState(100);
  const [target, setTarget] =
    useState<
      keyof Pick<
        ProductPrice,
        | "wholesale"
        | "transfer"
        | "cash"
        | "distributor"
        | "curveUnit"
        | "dozenUnit"
        | "suggestedRetail"
      >
    >("wholesale");
  const [notice, setNotice] =
    useState("");

  useEffect(() => {
    setPrices(
      loadStorage(
        STORAGE_KEYS.prices,
        seedPrices(),
      ),
    );

    setLists(
      loadStorage(
        STORAGE_KEYS.priceLists,
        seedPriceLists(),
      ),
    );

    setRules(
      loadStorage(
        STORAGE_KEYS.quantityRules,
        seedQuantityRules(),
      ),
    );
  }, []);

  const summary = useMemo(() => {
    const cost =
      prices.reduce(
        (total, price) =>
          total + price.cost,
        0,
      );

    const wholesale =
      prices.reduce(
        (total, price) =>
          total + price.wholesale,
        0,
      );

    const margin =
      wholesale > 0
        ? ((wholesale - cost) /
            wholesale) *
          100
        : 0;

    return {
      products: prices.length,
      lists:
        lists.filter(
          (list) =>
            list.active,
        ).length,
      rules:
        rules.filter(
          (rule) =>
            rule.active,
        ).length,
      averageMargin: margin,
    };
  }, [prices, lists, rules]);

  function notify(message: string) {
    setNotice(message);

    window.setTimeout(
      () => setNotice(""),
      2200,
    );
  }

  function persistPrices(
    next: ProductPrice[],
  ) {
    setPrices(next);

    saveStorage(
      STORAGE_KEYS.prices,
      next,
    );
  }

  function updatePrice(
    priceId: string,
    field: keyof ProductPrice,
    value: string | number,
  ) {
    persistPrices(
      prices.map((price) =>
        price.id === priceId
          ? {
              ...price,
              [field]: value,
              updatedAt:
                new Date().toISOString(),
            }
          : price,
      ),
    );
  }

  function applyIncrease() {
    if (
      !window.confirm(
        `¿Aplicar ${increase}% a ${target} en todos los productos?`,
      )
    ) {
      return;
    }

    const multiplier =
      1 + increase / 100;

    const rounded = (
      value: number,
    ) => {
      if (roundTo <= 0) {
        return Math.round(value);
      }

      return (
        Math.ceil(
          value / roundTo,
        ) * roundTo
      );
    };

    persistPrices(
      prices.map((price) => ({
        ...price,
        [target]: rounded(
          Number(price[target]) *
            multiplier,
        ),
        updatedAt:
          new Date().toISOString(),
      })),
    );

    notify(
      "Actualización masiva aplicada",
    );
  }

  function addPrice() {
    const price: ProductPrice = {
      id: createId("price"),
      productId:
        createId("product"),
      productName:
        "Nuevo producto",
      baseSku: `SKU-${prices.length + 1}`,
      cost: 0,
      wholesale: 0,
      transfer: 0,
      cash: 0,
      distributor: 0,
      curveUnit: 0,
      dozenUnit: 0,
      suggestedRetail: 0,
      promotional: 0,
      currency: "ARS",
      updatedAt:
        new Date().toISOString(),
    };

    persistPrices([
      price,
      ...prices,
    ]);
  }

  function addRule() {
    const rule: QuantityRule = {
      id: createId("rule"),
      name: "Nueva regla",
      minimumQuantity: 1,
      discountPercent: 0,
      active: true,
    };

    const next = [
      ...rules,
      rule,
    ];

    setRules(next);

    saveStorage(
      STORAGE_KEYS.quantityRules,
      next,
    );
  }

  function updateRule(
    ruleId: string,
    field: keyof QuantityRule,
    value:
      | string
      | number
      | boolean,
  ) {
    const next = rules.map(
      (rule) =>
        rule.id === ruleId
          ? {
              ...rule,
              [field]: value,
            }
          : rule,
    );

    setRules(next);

    saveStorage(
      STORAGE_KEYS.quantityRules,
      next,
    );
  }

  function addList() {
    const list: PriceList = {
      id: createId("list"),
      name: "Nueva lista",
      code: `LISTA-${lists.length + 1}`,
      currency: "ARS",
      customerType: "custom",
      taxIncluded: true,
      active: true,
    };

    const next = [
      ...lists,
      list,
    ];

    setLists(next);

    saveStorage(
      STORAGE_KEYS.priceLists,
      next,
    );
  }

  function updateList(
    listId: string,
    field: keyof PriceList,
    value:
      | string
      | boolean,
  ) {
    const next = lists.map(
      (list) =>
        list.id === listId
          ? {
              ...list,
              [field]: value,
            }
          : list,
    );

    setLists(next);

    saveStorage(
      STORAGE_KEYS.priceLists,
      next,
    );
  }

  return (
    <AppShell>
      <div className="commerce-page">
        <header className="commerce-header">
          <div>
            <span className="commerce-kicker">
              FASE 5 · PRECIOS ARGENTINA
            </span>

            <h1>
              Listas, márgenes y precios
            </h1>

            <p>
              Costos, mayorista,
              transferencia, efectivo,
              curvas, docenas y precio
              sugerido de reventa.
            </p>
          </div>

          <div className="commerce-actions">
            <button
              type="button"
              onClick={addList}
            >
              + Lista
            </button>

            <button
              type="button"
              className="primary"
              onClick={addPrice}
            >
              + Producto
            </button>
          </div>
        </header>

        <CatalogCommerceNav />

        <section className="commerce-metrics">
          <article>
            <span>
              Productos con precio
            </span>

            <strong>
              {summary.products}
            </strong>

            <small>
              Registros comerciales
            </small>
          </article>

          <article>
            <span>
              Listas activas
            </span>

            <strong>
              {summary.lists}
            </strong>

            <small>
              Segmentos de clientes
            </small>
          </article>

          <article>
            <span>
              Reglas por cantidad
            </span>

            <strong>
              {summary.rules}
            </strong>

            <small>
              Descuentos automáticos
            </small>
          </article>

          <article>
            <span>
              Margen promedio
            </span>

            <strong>
              {summary.averageMargin.toFixed(
                1,
              )}
              %
            </strong>

            <small>
              Sobre precio mayorista
            </small>
          </article>

          <article>
            <span>Moneda</span>

            <strong>ARS</strong>

            <small>
              Configuración principal
            </small>
          </article>
        </section>

        <section className="commerce-section">
          <div className="commerce-section-heading">
            <div>
              <span>
                ACTUALIZACIÓN MASIVA
              </span>

              <h2>
                Aumentar precios
              </h2>

              <p>
                Herramienta pensada para
                cambios frecuentes de
                costos en Argentina.
              </p>
            </div>
          </div>

          <div className="bulk-pricing">
            <label>
              <span>
                Precio a modificar
              </span>

              <select
                value={target}
                onChange={(event) =>
                  setTarget(
                    event.target
                      .value as typeof target,
                  )
                }
              >
                <option value="wholesale">
                  Mayorista
                </option>

                <option value="transfer">
                  Transferencia
                </option>

                <option value="cash">
                  Efectivo
                </option>

                <option value="distributor">
                  Distribuidor
                </option>

                <option value="curveUnit">
                  Por curva
                </option>

                <option value="dozenUnit">
                  Por docena
                </option>

                <option value="suggestedRetail">
                  Reventa sugerida
                </option>
              </select>
            </label>

            <label>
              <span>
                Porcentaje
              </span>

              <input
                type="number"
                value={increase}
                onChange={(event) =>
                  setIncrease(
                    Number(
                      event.target.value,
                    ),
                  )
                }
              />
            </label>

            <label>
              <span>
                Redondear a
              </span>

              <select
                value={roundTo}
                onChange={(event) =>
                  setRoundTo(
                    Number(
                      event.target.value,
                    ),
                  )
                }
              >
                <option value="1">
                  Sin redondeo
                </option>

                <option value="10">
                  Múltiplos de 10
                </option>

                <option value="100">
                  Múltiplos de 100
                </option>

                <option value="500">
                  Múltiplos de 500
                </option>

                <option value="1000">
                  Múltiplos de 1.000
                </option>
              </select>
            </label>

            <button
              type="button"
              className="primary"
              onClick={applyIncrease}
            >
              Aplicar actualización
            </button>
          </div>
        </section>

        <section className="commerce-section">
          <div className="commerce-section-heading">
            <div>
              <span>
                PRECIOS POR PRODUCTO
              </span>

              <h2>
                Matriz comercial
              </h2>
            </div>
          </div>

          <div className="commerce-panel">
            <div className="commerce-table-wrap">
              <table className="commerce-table pricing">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Costo</th>
                    <th>Mayorista</th>
                    <th>Transferencia</th>
                    <th>Efectivo</th>
                    <th>Distribuidor</th>
                    <th>Curva</th>
                    <th>Docena</th>
                    <th>Reventa sugerida</th>
                    <th>Promoción</th>
                    <th>Margen</th>
                  </tr>
                </thead>

                <tbody>
                  {prices.map((price) => {
                    const margin =
                      price.wholesale > 0
                        ? ((price.wholesale -
                            price.cost) /
                            price.wholesale) *
                          100
                        : 0;

                    return (
                      <tr key={price.id}>
                        <td>
                          <input
                            value={
                              price.productName
                            }
                            onChange={(
                              event,
                            ) =>
                              updatePrice(
                                price.id,
                                "productName",
                                event.target
                                  .value,
                              )
                            }
                          />

                          <small>
                            {
                              price.baseSku
                            }
                          </small>
                        </td>

                        {[
                          "cost",
                          "wholesale",
                          "transfer",
                          "cash",
                          "distributor",
                          "curveUnit",
                          "dozenUnit",
                          "suggestedRetail",
                          "promotional",
                        ].map((field) => (
                          <td key={field}>
                            <input
                              type="number"
                              min="0"
                              value={
                                price[
                                  field as keyof ProductPrice
                                ] as number
                              }
                              onChange={(
                                event,
                              ) =>
                                updatePrice(
                                  price.id,
                                  field as keyof ProductPrice,
                                  Number(
                                    event.target
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
                              margin >= 35
                                ? "success"
                                : "warning"
                            }
                          >
                            {margin.toFixed(
                              1,
                            )}
                            %
                          </strong>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="commerce-grid-two commerce-section">
          <article className="commerce-panel padded">
            <div className="commerce-card-heading">
              <div>
                <span>
                  LISTAS DE PRECIOS
                </span>

                <h3>
                  Segmentación comercial
                </h3>
              </div>

              <button
                type="button"
                onClick={addList}
              >
                + Agregar
              </button>
            </div>

            <div className="pricing-list">
              {lists.map((list) => (
                <article key={list.id}>
                  <input
                    value={list.name}
                    onChange={(event) =>
                      updateList(
                        list.id,
                        "name",
                        event.target
                          .value,
                      )
                    }
                  />

                  <select
                    value={
                      list.customerType
                    }
                    onChange={(event) =>
                      updateList(
                        list.id,
                        "customerType",
                        event.target
                          .value,
                      )
                    }
                  >
                    <option value="retailer">
                      Revendedor
                    </option>

                    <option value="wholesaler">
                      Mayorista
                    </option>

                    <option value="distributor">
                      Distribuidor
                    </option>

                    <option value="vip">
                      VIP
                    </option>

                    <option value="custom">
                      Personalizada
                    </option>
                  </select>

                  <label>
                    <input
                      type="checkbox"
                      checked={
                        list.active
                      }
                      onChange={(event) =>
                        updateList(
                          list.id,
                          "active",
                          event.target
                            .checked,
                        )
                      }
                    />

                    Activa
                  </label>
                </article>
              ))}
            </div>
          </article>

          <article className="commerce-panel padded">
            <div className="commerce-card-heading">
              <div>
                <span>
                  DESCUENTOS
                </span>

                <h3>
                  Reglas por cantidad
                </h3>
              </div>

              <button
                type="button"
                onClick={addRule}
              >
                + Agregar
              </button>
            </div>

            <div className="pricing-list">
              {rules.map((rule) => (
                <article key={rule.id}>
                  <input
                    value={rule.name}
                    onChange={(event) =>
                      updateRule(
                        rule.id,
                        "name",
                        event.target
                          .value,
                      )
                    }
                  />

                  <label>
                    <span>Mínimo</span>

                    <input
                      type="number"
                      min="1"
                      value={
                        rule.minimumQuantity
                      }
                      onChange={(event) =>
                        updateRule(
                          rule.id,
                          "minimumQuantity",
                          Number(
                            event.target
                              .value,
                          ),
                        )
                      }
                    />
                  </label>

                  <label>
                    <span>Descuento</span>

                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={
                        rule.discountPercent
                      }
                      onChange={(event) =>
                        updateRule(
                          rule.id,
                          "discountPercent",
                          Number(
                            event.target
                              .value,
                          ),
                        )
                      }
                    />
                  </label>

                  <strong>
                    {
                      rule.discountPercent
                    }
                    %
                  </strong>
                </article>
              ))}
            </div>
          </article>
        </section>

        <section className="commerce-section">
          <div className="commerce-section-heading">
            <div>
              <span>
                PREVISUALIZACIÓN
              </span>

              <h2>
                Cómo lo verá el vendedor
              </h2>
            </div>
          </div>

          <div className="price-preview-grid">
            {prices.map((price) => (
              <article key={price.id}>
                <span>
                  {price.baseSku}
                </span>

                <h3>
                  {price.productName}
                </h3>

                <div>
                  <small>
                    Precio mayorista
                  </small>

                  <strong>
                    {money(
                      price.wholesale,
                      price.currency,
                    )}
                  </strong>
                </div>

                <p>
                  Transferencia:{" "}
                  <strong>
                    {money(
                      price.transfer,
                      price.currency,
                    )}
                  </strong>
                </p>

                <p>
                  Curva completa:{" "}
                  <strong>
                    {money(
                      price.curveUnit,
                      price.currency,
                    )}{" "}
                    por unidad
                  </strong>
                </p>

                <p>
                  Docena:{" "}
                  <strong>
                    {money(
                      price.dozenUnit,
                      price.currency,
                    )}{" "}
                    por unidad
                  </strong>
                </p>

                <button type="button">
                  Agregar al pedido
                </button>
              </article>
            ))}
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
