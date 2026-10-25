"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import styles from "./team-access-manager.module.css";


type TeamUser = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;

  role:
    | "admin"
    | "supervisor"
    | "vendedor";

  views?: string[];
  actions?: string[];
  active?: boolean;
};


type Props = {
  onReload?: () =>
    Promise<void>
    | void;
};


const VIEW_OPTIONS = [
  ["dashboard", "Resumen"],
  ["customers", "Clientes"],
  ["events", "Eventos"],
  ["quotes", "Presupuestos"],
  ["agenda", "Agenda"],
  ["providers", "Proveedores"],
  ["conversations", "Conversaciones"],
  ["coordination", "Coordinación"],
  ["documents", "Documentos"],
  ["finance", "Finanzas"],
  ["commissions", "Comisiones"],
  ["team", "Equipo"],
  ["administration", "Administración"],
] as const;


const ACTION_OPTIONS = [
  [
    "customers.create",
    "Crear clientes",
  ],
  [
    "customers.edit",
    "Editar clientes",
  ],
  [
    "events.create",
    "Crear eventos",
  ],
  [
    "events.edit",
    "Editar eventos",
  ],
  [
    "events.assign",
    "Asignar responsables",
  ],
  [
    "providers.view",
    "Ver proveedores",
  ],
  [
    "providers.edit",
    "Gestionar proveedores",
  ],
  [
    "quotes.create",
    "Crear presupuestos",
  ],
  [
    "quotes.approve",
    "Aprobar presupuestos",
  ],
  [
    "finance.view",
    "Ver finanzas",
  ],
  [
    "commissions.view",
    "Ver comisiones",
  ],
  [
    "team.manage",
    "Gestionar equipo",
  ],
] as const;


const SELLER_VIEWS = [
  "dashboard",
  "customers",
  "events",
  "quotes",
  "agenda",
];


const SELLER_ACTIONS = [
  "customers.create",
  "customers.edit",
  "events.create",
  "events.edit",
  "quotes.create",
];


function newForm() {
  return {
    id: "",
    name: "",
    email: "",
    phone: "",

    role:
      "vendedor" as TeamUser["role"],

    password: "",

    views: [
      ...SELLER_VIEWS,
    ],

    actions: [
      ...SELLER_ACTIONS,
    ],
  };
}


async function api<T>(
  path: string,
  init:
    RequestInit = {},
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
          Accept:
            "application/json",

          "Content-Type":
            "application/json",

          ...init.headers,
        },
      },
    );

  const body =
    await response
      .json()
      .catch(
        () => ({}),
      );

  if (!response.ok) {
    const message =
      typeof body?.error
        === "string"
        ? body.error
        : `HTTP_${response.status}`;

    throw new Error(
      message,
    );
  }

  return body as T;
}


function createTemporaryPassword() {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZ"
    + "abcdefghijkmnopqrstuvwxyz"
    + "23456789"
    + "!@#$%";

  let password = "";

  for (
    let index = 0;
    index < 14;
    index += 1
  ) {
    password +=
      chars[
        Math.floor(
          Math.random()
          * chars.length,
        )
      ];
  }

  return password;
}


function roleLabel(
  role:
    TeamUser["role"],
) {
  if (
    role === "admin"
  ) {
    return "Administrador";
  }

  if (
    role === "supervisor"
  ) {
    return "Supervisor";
  }

  return "Vendedor";
}


export function TeamAccessManager({
  onReload,
}: Props) {
  const [
    users,
    setUsers,
  ] =
    useState<TeamUser[]>(
      [],
    );

  const [
    form,
    setForm,
  ] =
    useState(
      newForm,
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    query,
    setQuery,
  ] =
    useState("");

  const [
    message,
    setMessage,
  ] =
    useState<string | null>(
      null,
    );


  const load =
    useCallback(
      async () => {
        setLoading(true);

        try {
          const result =
            await api<{
              ok: boolean;
              users?: TeamUser[];
            }>(
              "/crm/team-users",
            );

          setUsers(
            result.users
            ?? [],
          );
        } catch (error) {
          setMessage(
            error
              instanceof Error
              ? error.message
              : "No se pudo cargar el equipo.",
          );
        } finally {
          setLoading(false);
        }
      },
      [],
    );


  useEffect(
    () => {
      void load();
    },
    [load],
  );


  const filteredUsers =
    useMemo(
      () => {
        const needle =
          query
            .trim()
            .toLowerCase();

        if (!needle) {
          return users;
        }

        return users.filter(
          (user) =>
            [
              user.name,
              user.email,
              user.phone,
              user.role,
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
        query,
        users,
      ],
    );


  function toggleView(
    value: string,
  ) {
    setForm(
      (current) => ({
        ...current,

        views:
          current.views.includes(
            value,
          )
            ? current.views.filter(
                (item) =>
                  item !== value,
              )
            : [
                ...current.views,
                value,
              ],
      }),
    );
  }


  function toggleAction(
    value: string,
  ) {
    setForm(
      (current) => ({
        ...current,

        actions:
          current.actions.includes(
            value,
          )
            ? current.actions.filter(
                (item) =>
                  item !== value,
              )
            : [
                ...current.actions,
                value,
              ],
      }),
    );
  }


  function applyRole(
    role:
      TeamUser["role"],
  ) {
    if (
      role === "admin"
    ) {
      setForm(
        (current) => ({
          ...current,

          role,

          views:
            VIEW_OPTIONS.map(
              ([value]) =>
                value,
            ),

          actions:
            ACTION_OPTIONS.map(
              ([value]) =>
                value,
            ),
        }),
      );

      return;
    }


    if (
      role === "supervisor"
    ) {
      setForm(
        (current) => ({
          ...current,

          role,

          views: [
            "dashboard",
            "customers",
            "events",
            "quotes",
            "agenda",
            "providers",
            "coordination",
            "documents",
            "commissions",
          ],

          actions: [
            "customers.create",
            "customers.edit",
            "events.create",
            "events.edit",
            "events.assign",
            "providers.view",
            "quotes.create",
            "quotes.approve",
            "commissions.view",
          ],
        }),
      );

      return;
    }


    setForm(
      (current) => ({
        ...current,

        role,

        views: [
          ...SELLER_VIEWS,
        ],

        actions: [
          ...SELLER_ACTIONS,
        ],
      }),
    );
  }


  function editUser(
    user: TeamUser,
  ) {
    setMessage(null);

    setForm({
      id:
        user.id,

      name:
        user.name,

      email:
        user.email,

      phone:
        user.phone
        ?? "",

      role:
        user.role,

      password:
        "",

      views:
        user.views
        ?? [],

      actions:
        user.actions
        ?? [],
    });
  }


  async function save() {
    setMessage(null);

    if (
      form.name.trim()
        .length < 2
    ) {
      setMessage(
        "Ingresá el nombre del usuario.",
      );

      return;
    }

    if (
      !form.email
        .includes("@")
    ) {
      setMessage(
        "Ingresá un email válido.",
      );

      return;
    }

    if (
      !form.id
      && form.password.length
        < 10
    ) {
      setMessage(
        "Generá o escribí una contraseña temporal de al menos 10 caracteres.",
      );

      return;
    }


    setSaving(true);

    try {
      const body:
        Record<
          string,
          unknown
        > = {
          name:
            form.name.trim(),

          email:
            form.email
              .trim()
              .toLowerCase(),

          phone:
            form.phone.trim()
            || null,

          role:
            form.role,

          views:
            form.views,

          actions:
            form.actions,
        };


      if (
        form.password
      ) {
        body.password =
          form.password;
      }


      const editing =
        Boolean(
          form.id,
        );


      await api(
        editing
          ? `/crm/team-users/${form.id}`
          : "/crm/team-users",

        {
          method:
            editing
              ? "PATCH"
              : "POST",

          body:
            JSON.stringify(
              body,
            ),
        },
      );


      setForm(
        newForm(),
      );

      await load();

      await onReload?.();

      setMessage(
        editing
          ? "Usuario actualizado correctamente."
          : "Usuario creado correctamente.",
      );
    } catch (error) {
      setMessage(
        error
          instanceof Error
          ? error.message
          : "No se pudo guardar el usuario.",
      );
    } finally {
      setSaving(false);
    }
  }


  async function disableUser(
    user: TeamUser,
  ) {
    const accepted =
      window.confirm(
        `¿Desactivar el acceso de ${user.name}?`,
      );

    if (!accepted) {
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      await api(
        `/crm/team-users/${user.id}`,
        {
          method:
            "DELETE",
        },
      );

      await load();

      await onReload?.();

      setMessage(
        "Usuario desactivado.",
      );
    } catch (error) {
      setMessage(
        error
          instanceof Error
          ? error.message
          : "No se pudo desactivar el usuario.",
      );
    } finally {
      setSaving(false);
    }
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
            EQUIPO Y ACCESOS
          </span>

          <h2>
            Usuarios del sistema
          </h2>

          <p>
            Creá vendedores, supervisores o administradores y definí qué puede ver y hacer cada uno.
          </p>
        </div>

        {message ? (
          <div
            className={
              styles.message
            }
          >
            {message}
          </div>
        ) : null}
      </header>


      <div
        className={
          styles.layout
        }
      >
        <article
          className={
            styles.formCard
          }
        >
          <div
            className={
              styles.cardHeader
            }
          >
            <div>
              <strong>
                {form.id
                  ? "Editar usuario"
                  : "Agregar miembro"}
              </strong>

              <small>
                {form.id
                  ? "Modificá rol, vistas, acciones o contraseña."
                  : "Creá un acceso independiente al panel."}
              </small>
            </div>

            {form.id ? (
              <button
                type="button"
                className={
                  styles.textButton
                }
                onClick={() =>
                  setForm(
                    newForm(),
                  )
                }
              >
                Cancelar
              </button>
            ) : null}
          </div>


          <div
            className={
              styles.fields
            }
          >
            <label>
              Nombre
              <input
                value={
                  form.name
                }
                onChange={
                  (event) =>
                    setForm(
                      (current) => ({
                        ...current,

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
              Email / usuario
              <input
                type="email"
                value={
                  form.email
                }
                onChange={
                  (event) =>
                    setForm(
                      (current) => ({
                        ...current,

                        email:
                          event
                            .target
                            .value,
                      }),
                    )
                }
              />
            </label>


            <label>
              Teléfono
              <input
                value={
                  form.phone
                }
                onChange={
                  (event) =>
                    setForm(
                      (current) => ({
                        ...current,

                        phone:
                          event
                            .target
                            .value,
                      }),
                    )
                }
              />
            </label>


            <label>
              Rol
              <select
                value={
                  form.role
                }
                onChange={
                  (event) =>
                    applyRole(
                        event.target.value as TeamUser["role"],
                      )
                }
              >
                <option value="vendedor">
                  Vendedor
                </option>

                <option value="supervisor">
                  Supervisor
                </option>

                <option value="admin">
                  Administrador
                </option>
              </select>
            </label>
          </div>


          <div
            className={
              styles.passwordRow
            }
          >
            <label>
              {form.id
                ? "Nueva contraseña"
                : "Contraseña temporal"}

              <input
                value={
                  form.password
                }
                placeholder={
                  form.id
                    ? "Vacío = mantener contraseña actual"
                    : "Mínimo 10 caracteres"
                }
                onChange={
                  (event) =>
                    setForm(
                      (current) => ({
                        ...current,

                        password:
                          event
                            .target
                            .value,
                      }),
                    )
                }
              />
            </label>

            <button
              type="button"
              onClick={() =>
                setForm(
                  (current) => ({
                    ...current,

                    password:
                      createTemporaryPassword(),
                  }),
                )
              }
            >
              Generar
            </button>
          </div>


          <div
            className={
              styles.permissionBlock
            }
          >
            <div>
              <strong>
                Vistas permitidas
              </strong>

              <small>
                Qué secciones aparecen en su panel.
              </small>
            </div>

            <div
              className={
                styles.checkGrid
              }
            >
              {VIEW_OPTIONS.map(
                ([
                  value,
                  label,
                ]) => (
                  <label
                    key={
                      value
                    }
                    className={
                      styles.check
                    }
                  >
                    <input
                      type="checkbox"
                      checked={
                        form.views.includes(
                          value,
                        )
                      }
                      onChange={() =>
                        toggleView(
                          value,
                        )
                      }
                    />

                    <span>
                      {label}
                    </span>
                  </label>
                ),
              )}
            </div>
          </div>


          <div
            className={
              styles.permissionBlock
            }
          >
            <div>
              <strong>
                Acciones permitidas
              </strong>

              <small>
                Qué operaciones puede realizar.
              </small>
            </div>

            <div
              className={
                styles.checkGrid
              }
            >
              {ACTION_OPTIONS.map(
                ([
                  value,
                  label,
                ]) => (
                  <label
                    key={
                      value
                    }
                    className={
                      styles.check
                    }
                  >
                    <input
                      type="checkbox"
                      checked={
                        form.actions.includes(
                          value,
                        )
                      }
                      onChange={() =>
                        toggleAction(
                          value,
                        )
                      }
                    />

                    <span>
                      {label}
                    </span>
                  </label>
                ),
              )}
            </div>
          </div>


          <button
            type="button"
            className={
              styles.saveButton
            }
            disabled={
              saving
            }
            onClick={() =>
              void save()
            }
          >
            {saving
              ? "Guardando..."
              : form.id
                ? "Guardar cambios"
                : "Crear usuario"}
          </button>
        </article>


        <article
          className={
            styles.usersCard
          }
        >
          <div
            className={
              styles.cardHeader
            }
          >
            <div>
              <strong>
                Usuarios con acceso
              </strong>

              <small>
                {
                  users.length
                } cuentas creadas desde el panel
              </small>
            </div>

            <input
              className={
                styles.search
              }
              placeholder="Buscar usuario..."
              value={
                query
              }
              onChange={
                (event) =>
                  setQuery(
                    event
                      .target
                      .value,
                  )
              }
            />
          </div>


          {loading ? (
            <div
              className={
                styles.empty
              }
            >
              Cargando equipo...
            </div>
          ) : null}


          {!loading
          && filteredUsers.length
            === 0 ? (
            <div
              className={
                styles.empty
              }
            >
              Todavía no hay usuarios creados desde este panel.
            </div>
          ) : null}


          <div
            className={
              styles.userList
            }
          >
            {filteredUsers.map(
              (user) => (
                <div
                  key={
                    user.id
                  }
                  className={
                    styles.userRow
                  }
                >
                  <div
                    className={
                      styles.avatar
                    }
                  >
                    {user.name
                      .slice(
                        0,
                        2,
                      )
                      .toUpperCase()}
                  </div>


                  <div
                    className={
                      styles.userInfo
                    }
                  >
                    <div
                      className={
                        styles.userTitle
                      }
                    >
                      <strong>
                        {
                          user.name
                        }
                      </strong>

                      <span>
                        {roleLabel(
                          user.role,
                        )}
                      </span>
                    </div>

                    <small>
                      {user.email}

                      {user.phone
                        ? ` · ${user.phone}`
                        : ""}
                    </small>


                    <div
                      className={
                        styles.tags
                      }
                    >
                      {(user.views
                        ?? [])
                        .slice(
                          0,
                          5,
                        )
                        .map(
                          (view) => {
                            const option =
                              VIEW_OPTIONS
                                .find(
                                  ([value]) =>
                                    value
                                    === view,
                                );

                            return (
                              <span
                                key={
                                  view
                                }
                              >
                                {
                                  option?.[1]
                                  ?? view
                                }
                              </span>
                            );
                          },
                        )}

                      {(user.views
                        ?.length
                        ?? 0) > 5 ? (
                        <span>
                          +{
                            (user.views
                              ?.length
                              ?? 0)
                            - 5
                          }
                        </span>
                      ) : null}
                    </div>
                  </div>


                  <div
                    className={
                      styles.rowActions
                    }
                  >
                    <button
                      type="button"
                      onClick={() =>
                        editUser(
                          user,
                        )
                      }
                    >
                      Editar
                    </button>

                    <button
                      type="button"
                      className={
                        styles.dangerButton
                      }
                      onClick={() =>
                        void disableUser(
                          user,
                        )
                      }
                    >
                      Desactivar
                    </button>
                  </div>
                </div>
              ),
            )}
          </div>
        </article>
      </div>
    </section>
  );
}
