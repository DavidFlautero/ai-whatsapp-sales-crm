"use client";

import {
  useMemo,
  useState,
} from "react";

import styles from "./customers-manager.module.css";

type Customer = {
  id: string;
  name: string;
  whatsapp?: string | null;
  email?: string | null;
  province?: string | null;
  city?: string | null;
  address?: string | null;
  notes?: string | null;
  status?: string | null;
};

type Props = {
  customers: Customer[];
  onReload:
    () => Promise<void> | void;
};

const emptyForm = {
  id: "",
  name: "",
  whatsapp: "",
  email: "",
  province: "Valencia",
  city: "Valencia",
  address: "",
  notes: "",
};

async function api<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response =
    await fetch(
      `/api${path}`,
      {
        ...init,
        credentials:
          "include",
        cache:
          "no-store",
        headers: {
          "Content-Type":
            "application/json",
          Accept:
            "application/json",
          ...init.headers,
        },
      },
    );

  const body =
    await response
      .json()
      .catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      body?.error
      ?? `HTTP_${response.status}`,
    );
  }

  return body as T;
}

export function CustomersManager({
  customers,
  onReload,
}: Props) {
  const [
    query,
    setQuery,
  ] =
    useState("");

  const [
    form,
    setForm,
  ] =
    useState(
      emptyForm,
    );

  const [
    busy,
    setBusy,
  ] =
    useState(false);

  const [
    notice,
    setNotice,
  ] =
    useState<string | null>(
      null,
    );

  const activeCustomers =
    useMemo(
      () =>
        customers.filter(
          customer =>
            customer.status
            !== "inactive",
        ),
      [
        customers,
      ],
    );

  const visibleCustomers =
    useMemo(
      () => {
        const needle =
          query
            .trim()
            .toLowerCase();

        if (!needle) {
          return activeCustomers;
        }

        return activeCustomers.filter(
          customer =>
            [
              customer.name,
              customer.whatsapp,
              customer.email,
              customer.city,
              customer.address,
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase()
              .includes(
                needle,
              ),
        );
      },
      [
        activeCustomers,
        query,
      ],
    );

  async function save() {
    if (!form.name.trim()) {
      setNotice(
        "El nombre es obligatorio.",
      );

      return;
    }

    setBusy(true);
    setNotice(null);

    try {
      const payload = {
        name:
          form.name.trim(),

        whatsapp:
          form.whatsapp.trim()
          || null,

        email:
          form.email.trim()
          || null,

        province:
          form.province.trim()
          || null,

        city:
          form.city.trim()
          || null,

        address:
          form.address.trim()
          || null,

        notes:
          form.notes.trim()
          || null,
      };

      await api(
        form.id
          ? `/crm/customers/${form.id}`
          : "/crm/customers",

        {
          method:
            form.id
              ? "PATCH"
              : "POST",

          body:
            JSON.stringify(
              payload,
            ),
        },
      );

      setForm(
        emptyForm,
      );

      await onReload();

      setNotice(
        form.id
          ? "Cliente actualizado."
          : "Cliente creado.",
      );
    } catch (
      error
    ) {
      setNotice(
        error
          instanceof Error
          ? error.message
          : "No se pudo guardar el cliente.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function disable(
    customer: Customer,
  ) {
    if (
      !window.confirm(
        `¿Desactivar a ${customer.name}?`,
      )
    ) {
      return;
    }

    setBusy(true);
    setNotice(null);

    try {
      await api(
        `/crm/customers/${customer.id}`,
        {
          method:
            "DELETE",
        },
      );

      if (
        form.id
        === customer.id
      ) {
        setForm(
          emptyForm,
        );
      }

      await onReload();

      setNotice(
        "Cliente desactivado.",
      );
    } catch (
      error
    ) {
      setNotice(
        error
          instanceof Error
          ? error.message
          : "No se pudo desactivar.",
      );
    } finally {
      setBusy(false);
    }
  }

  function edit(
    customer: Customer,
  ) {
    setForm({
      id:
        customer.id,

      name:
        customer.name
        ?? "",

      whatsapp:
        customer.whatsapp
        ?? "",

      email:
        customer.email
        ?? "",

      province:
        customer.province
        ?? "",

      city:
        customer.city
        ?? "",

      address:
        customer.address
        ?? "",

      notes:
        customer.notes
        ?? "",
    });
  }

  return (
    <section
      className={
        styles.root
      }
    >
      <header
        className={
          styles.header
        }
      >
        <div>
          <span>
            CRM DE CLIENTES
          </span>

          <h2>
            Clientes
          </h2>

          <p>
            Alta, edición,
            contacto y seguimiento.
          </p>
        </div>

        <button
          type="button"
          onClick={
            () =>
              setForm(
                emptyForm,
              )
          }
        >
          + Nuevo cliente
        </button>
      </header>

      {notice ? (
        <div
          className={
            styles.notice
          }
        >
          {notice}
        </div>
      ) : null}

      <div
        className={
          styles.layout
        }
      >
        <div>
          <input
            className={
              styles.search
            }
            value={query}
            onChange={
              event =>
                setQuery(
                  event.target.value,
                )
            }
            placeholder="Buscar por nombre, teléfono, email o ciudad..."
          />

          <div
            className={
              styles.list
            }
          >
            {visibleCustomers.map(
              customer => (
                <article
                  key={
                    customer.id
                  }
                  className={
                    styles.customer
                  }
                >
                  <div
                    className={
                      styles.customerMain
                    }
                  >
                    <div
                      className={
                        styles.avatar
                      }
                    >
                      {
                        customer.name
                          .charAt(0)
                          .toUpperCase()
                      }
                    </div>

                    <div>
                      <strong>
                        {
                          customer.name
                        }
                      </strong>

                      <small>
                        {
                          [
                            customer.city,
                            customer.whatsapp,
                            customer.email,
                          ]
                            .filter(
                              Boolean,
                            )
                            .join(" · ")
                          || "Sin datos de contacto"
                        }
                      </small>
                    </div>
                  </div>

                  <div
                    className={
                      styles.actions
                    }
                  >
                    {customer.whatsapp ? (
                      <a
                        target="_blank"
                        rel="noreferrer"
                        href={
                          `https://wa.me/${
                            customer.whatsapp
                              .replace(
                                /\D/g,
                                "",
                              )
                          }`
                        }
                      >
                        WhatsApp
                      </a>
                    ) : null}

                    <button
                      type="button"
                      onClick={
                        () =>
                          edit(
                            customer,
                          )
                      }
                    >
                      Editar
                    </button>

                    <button
                      type="button"
                      onClick={
                        () =>
                          void disable(
                            customer,
                          )
                      }
                    >
                      Desactivar
                    </button>
                  </div>
                </article>
              ),
            )}

            {!visibleCustomers.length ? (
              <div
                className={
                  styles.empty
                }
              >
                No hay clientes.
              </div>
            ) : null}
          </div>
        </div>

        <aside
          className={
            styles.form
          }
        >
          <div
            className={
              styles.formHeader
            }
          >
            <h3>
              {
                form.id
                  ? "Editar cliente"
                  : "Nuevo cliente"
              }
            </h3>

            {form.id ? (
              <button
                type="button"
                onClick={
                  () =>
                    setForm(
                      emptyForm,
                    )
                }
              >
                Cancelar edición
              </button>
            ) : null}
          </div>

          <label>
            Nombre *
            <input
              value={
                form.name
              }
              onChange={
                event =>
                  setForm({
                    ...form,
                    name:
                      event.target.value,
                  })
              }
            />
          </label>

          <label>
            WhatsApp
            <input
              value={
                form.whatsapp
              }
              placeholder="+34..."
              onChange={
                event =>
                  setForm({
                    ...form,
                    whatsapp:
                      event.target.value,
                  })
              }
            />
          </label>

          <label>
            Email
            <input
              type="email"
              value={
                form.email
              }
              onChange={
                event =>
                  setForm({
                    ...form,
                    email:
                      event.target.value,
                  })
              }
            />
          </label>

          <div
            className={
              styles.inline
            }
          >
            <label>
              Provincia
              <input
                value={
                  form.province
                }
                onChange={
                  event =>
                    setForm({
                      ...form,
                      province:
                        event.target.value,
                    })
                }
              />
            </label>

            <label>
              Ciudad
              <input
                value={
                  form.city
                }
                onChange={
                  event =>
                    setForm({
                      ...form,
                      city:
                        event.target.value,
                    })
                }
              />
            </label>
          </div>

          <label>
            Dirección
            <input
              value={
                form.address
              }
              onChange={
                event =>
                  setForm({
                    ...form,
                    address:
                      event.target.value,
                  })
              }
            />
          </label>

          <label>
            Notas
            <textarea
              value={
                form.notes
              }
              placeholder="Preferencias, observaciones, información comercial..."
              onChange={
                event =>
                  setForm({
                    ...form,
                    notes:
                      event.target.value,
                  })
              }
            />
          </label>

          <button
            type="button"
            disabled={busy}
            className={
              styles.save
            }
            onClick={
              () =>
                void save()
            }
          >
            {
              busy
                ? "Guardando..."
                : form.id
                  ? "Guardar cambios"
                  : "Crear cliente"
            }
          </button>
        </aside>
      </div>
    </section>
  );
}
