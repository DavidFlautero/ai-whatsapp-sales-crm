"use client";

import Link from "next/link";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  usePathname,
  useSearchParams,
} from "next/navigation";

import styles from "./app-shell.module.css";


type IconName =
  | "home"
  | "calendar"
  | "inbox"
  | "building"
  | "users"
  | "truck"
  | "file"
  | "money"
  | "alert"
  | "briefcase"
  | "customer"
  | "pipeline"
  | "target"
  | "commission"
  | "team"
  | "shield"
  | "clock"
  | "sparkles"
  | "message"
  | "automation"
  | "template"
  | "chart"
  | "trend"
  | "brain"
  | "settings"
  | "plug"
  | "folder"
  | "activity"
  | "database"
  | "chevron"
  | "menu"
  | "close"
  | "search"
  | "bot";


type MenuItem = {
  label: string;

  href?: string;

  icon: IconName;

  queryView?: string;

  disabled?: boolean;

  badge?: string;
};


type MenuGroup = {
  id: string;

  label: string;

  icon: IconName;

  items: MenuItem[];
};


const groups: MenuGroup[] = [
  {
    id: "principal",

    label: "Principal",

    icon: "home",

    items: [
      {
        label: "Panel general",
        href: "/crm",
        icon: "home",
      },

      {
        label: "Actividad",
        href: "/platform/activity",
        icon: "activity",
      },

      {
        label: "Alertas",
        href: "/crm/pendientes",
        icon: "alert",
      },
    ],
  },

  {
    id: "operacion",

    label: "Operación",

    icon: "calendar",

    items: [
      {
        label: "Eventos",
        href: "/crm/eventos",
        icon: "calendar",
      },

      {
        label: "Solicitudes",
        href: "/crm/solicitudes",
        icon: "inbox",
      },

      {
        label: "Calendario",
        href: "/agenda",
        icon: "clock",
      },

      {
        label: "Espacios",
        href: "/crm/espacios",
        icon: "building",
      },

      {
        label: "Proveedores",
        href: "/crm/proveedores",
        icon: "truck",
      },

      {
        label: "Cotizaciones",
        href: "/crm",
        queryView: "events",
        icon: "file",
      },

      {
        label: "Pagos",
        href: "/crm",
        queryView: "events",
        icon: "money",
      },

      {
        label: "Incidencias",
        href: "/crm/pendientes",
        icon: "alert",
      },
    ],
  },

  {
    id: "comercial",

    label: "Comercial",

    icon: "briefcase",

    items: [
      {
        label: "Clientes",
        href: "/crm",
        queryView: "customers",
        icon: "customer",
      },

      {
        label: "Leads",
        href: "/crm/solicitudes",
        icon: "target",
      },

      {
        label: "Pipeline",
        href: "/crm",
        icon: "pipeline",
      },

      {
        label: "Presupuestos",
        href: "/crm",
        queryView: "events",
        icon: "file",
      },

      {
        label: "Comisiones",
        href: "/crm",
        queryView: "events",
        icon: "commission",
      },

      {
        label: "Socios",
        href: "/crm/proveedores?category=real-estate",
        icon: "users",
      },
    ],
  },

  {
    id: "equipo",

    label: "Equipo",

    icon: "team",

    items: [
      {
        label: "Usuarios",
        href: "/platform/users",
        icon: "users",
      },

      {
        label: "Responsables",
        href: "/crm",
        icon: "team",
      },

      {
        label: "Roles y permisos",
        href: "/platform/users",
        icon: "shield",
      },
    ],
  },

  {
    id: "ia",

    label: "IA y automatización",

    icon: "sparkles",

    items: [
      {
        label: "Asistente IA",
        href: "/ai-core",
        icon: "brain",
      },

      {
        label: "WhatsApp",
        href: "/conversations",
        icon: "message",
      },

      {
        label: "Automatizaciones",
        href: "/integrations",
        icon: "automation",
      },

      {
        label: "Plantillas",
        href: "/prompts",
        icon: "template",
      },
    ],
  },

  {
    id: "inteligencia",

    label: "Inteligencia",

    icon: "chart",

    items: [
      {
        label: "Rendimiento",
        href: "/analytics",
        icon: "chart",
      },

      {
        label: "Ventas",
        href: "/analytics",
        icon: "trend",
      },

      {
        label: "Operación",
        href: "/analytics",
        icon: "activity",
      },

      {
        label: "Proveedores",
        href: "/crm/proveedores",
        icon: "truck",
      },
    ],
  },

  {
    id: "sistema",

    label: "Sistema",

    icon: "settings",

    items: [
      {
        label: "Integraciones",
        href: "/integrations",
        icon: "plug",
      },

      {
        label: "Archivos",
        href: "/crm/pendientes",
        icon: "folder",
      },

      {
        label: "Auditoría",
        href: "/platform/activity",
        icon: "activity",
      },

      {
        label: "Migración Drive",
        href: "/crm/pendientes",
        icon: "database",
      },

      {
        label: "Configuración",
        href: "/settings",
        icon: "settings",
      },
    ],
  },
];


function Icon({
  name,
  size = 18,
}: {
  name: IconName;
  size?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  const paths:
    Record<
      IconName,
      React.ReactNode
    > = {
    home: (
      <>
        <path d="M3 11.5 12 4l9 7.5" />
        <path d="M5.5 10v9h13v-9" />
        <path d="M9 19v-5h6v5" />
      </>
    ),

    calendar: (
      <>
        <rect
          x="3"
          y="5"
          width="18"
          height="16"
          rx="2"
        />
        <path d="M16 3v4M8 3v4M3 10h18" />
      </>
    ),

    inbox: (
      <>
        <path d="M4 5h16v14H4z" />
        <path d="m4 13 4-4h8l4 4" />
        <path d="M8 13h8" />
      </>
    ),

    building: (
      <>
        <rect
          x="4"
          y="3"
          width="16"
          height="18"
          rx="1.5"
        />
        <path d="M8 7h2M14 7h2M8 11h2M14 11h2M8 15h2M14 15h2M10 21v-3h4v3" />
      </>
    ),

    users: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 20c.5-4 2.4-6 5.5-6s5 2 5.5 6" />
        <path d="M16 5.5a3 3 0 0 1 0 5.8M17 14c2.2.8 3.4 2.8 3.5 6" />
      </>
    ),

    truck: (
      <>
        <path d="M3 6h11v10H3z" />
        <path d="M14 9h4l3 4v3h-7" />
        <circle cx="7" cy="18" r="2" />
        <circle cx="18" cy="18" r="2" />
      </>
    ),

    file: (
      <>
        <path d="M6 3h8l4 4v14H6z" />
        <path d="M14 3v5h5" />
        <path d="M9 13h6M9 17h6" />
      </>
    ),

    money: (
      <>
        <rect
          x="3"
          y="5"
          width="18"
          height="14"
          rx="2"
        />
        <circle cx="12" cy="12" r="3" />
        <path d="M7 9H6M18 15h-1" />
      </>
    ),

    alert: (
      <>
        <path d="m12 3 9 16H3L12 3Z" />
        <path d="M12 9v4M12 16h.01" />
      </>
    ),

    briefcase: (
      <>
        <rect
          x="3"
          y="7"
          width="18"
          height="13"
          rx="2"
        />
        <path d="M9 7V4h6v3M3 12h18M10 12v2h4v-2" />
      </>
    ),

    customer: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c.5-5 3.1-7.5 8-7.5s7.5 2.5 8 7.5" />
      </>
    ),

    pipeline: (
      <>
        <path d="M4 5h16M7 12h10M10 19h4" />
        <circle cx="4" cy="5" r="1" />
        <circle cx="7" cy="12" r="1" />
        <circle cx="10" cy="19" r="1" />
      </>
    ),

    target: (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1" />
      </>
    ),

    commission: (
      <>
        <circle cx="8" cy="8" r="3" />
        <circle cx="16" cy="16" r="3" />
        <path d="m18 6-12 12" />
      </>
    ),

    team: (
      <>
        <circle cx="8" cy="9" r="3" />
        <circle cx="16" cy="9" r="3" />
        <path d="M2.5 20c.4-4 2.2-6 5.5-6M21.5 20c-.4-4-2.2-6-5.5-6" />
        <path d="M8 20c.4-4 1.8-6 4-6s3.6 2 4 6" />
      </>
    ),

    shield: (
      <>
        <path d="M12 3 20 6v5c0 5-3.2 8.5-8 10-4.8-1.5-8-5-8-10V6l8-3Z" />
        <path d="m9 12 2 2 4-5" />
      </>
    ),

    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),

    sparkles: (
      <>
        <path d="m12 3 1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4L12 3Z" />
        <path d="m19 14 .8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14Z" />
      </>
    ),

    message: (
      <>
        <path d="M4 5h16v12H9l-5 4V5Z" />
        <path d="M8 9h8M8 13h5" />
      </>
    ),

    automation: (
      <>
        <circle cx="7" cy="7" r="3" />
        <circle cx="17" cy="17" r="3" />
        <path d="M10 7h4c2 0 3 1 3 3v4M14 17h-4c-2 0-3-1-3-3v-4" />
      </>
    ),

    template: (
      <>
        <rect
          x="3"
          y="4"
          width="18"
          height="16"
          rx="2"
        />
        <path d="M3 9h18M9 9v11" />
      </>
    ),

    chart: (
      <>
        <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
      </>
    ),

    trend: (
      <>
        <path d="m3 17 6-6 4 4 7-9" />
        <path d="M15 6h5v5" />
      </>
    ),

    brain: (
      <>
        <path d="M9 4a3 3 0 0 0-3 3v1a3 3 0 0 0-1 5.8A4 4 0 0 0 9 20" />
        <path d="M15 4a3 3 0 0 1 3 3v1a3 3 0 0 1 1 5.8A4 4 0 0 1 15 20" />
        <path d="M9 4v16M15 4v16M9 9h2M13 14h2" />
      </>
    ),

    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19 13.5v-3l-2-.7-.7-1.7.9-1.9-2.1-2.1-1.9.9-1.7-.7L10.5 2h-3l-.7 2-1.7.7-1.9-.9L1.1 6l.9 1.9-.7 1.7L0 10.5v3l2 .7.7 1.7-.9 1.9L4 19.9l1.9-.9 1.7.7.9 2h3l.7-2 1.7-.7 1.9.9 2.1-2.1-.9-1.9.7-1.7 1.3-.7Z" transform="translate(2 0) scale(.83)" />
      </>
    ),

    plug: (
      <>
        <path d="M8 3v5M16 3v5M6 8h12v3a6 6 0 0 1-12 0V8Z" />
        <path d="M12 17v4" />
      </>
    ),

    folder: (
      <>
        <path d="M3 6h7l2 2h9v11H3z" />
      </>
    ),

    activity: (
      <>
        <path d="M3 12h4l2-6 4 12 2-6h6" />
      </>
    ),

    database: (
      <>
        <ellipse cx="12" cy="5" rx="8" ry="3" />
        <path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
        <path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
      </>
    ),

    chevron: (
      <path d="m8 10 4 4 4-4" />
    ),

    menu: (
      <path d="M4 7h16M4 12h16M4 17h16" />
    ),

    close: (
      <path d="m6 6 12 12M18 6 6 18" />
    ),

    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m16 16 5 5" />
      </>
    ),

    bot: (
      <>
        <rect
          x="4"
          y="7"
          width="16"
          height="12"
          rx="3"
        />
        <path d="M12 3v4M9 12h.01M15 12h.01M8 16h8" />
      </>
    ),
  };

  return (
    <svg {...common}>
      {paths[name]}
    </svg>
  );
}


function resolveHref(
  item: MenuItem,
) {
  if (!item.href) {
    return "#";
  }

  if (
    item.queryView
    &&
    item.href === "/crm"
  ) {
    return `/crm?view=${encodeURIComponent(
      item.queryView,
    )}`;
  }

  return item.href;
}


export function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname =
    usePathname();

  const searchParams =
    useSearchParams();

  const [
    collapsed,
    setCollapsed,
  ] =
    useState(false);

  const [
    mobileOpen,
    setMobileOpen,
  ] =
    useState(false);

  const [
    openGroups,
    setOpenGroups,
  ] =
    useState<
      Record<
        string,
        boolean
      >
    >({
      principal: true,
      operacion: true,
      comercial: false,
      equipo: false,
      ia: false,
      inteligencia: false,
      sistema: false,
    });


  useEffect(
    () => {
      try {
        const saved =
          localStorage.getItem(
            "eventos-shell-open-groups",
          );

        if (saved) {
          setOpenGroups(
            JSON.parse(
              saved,
            ),
          );
        }

        const savedCollapsed =
          localStorage.getItem(
            "eventos-shell-collapsed",
          );

        if (
          savedCollapsed ===
          "true"
        ) {
          setCollapsed(
            true,
          );
        }
      } catch {
        // noop
      }
    },
    [],
  );


  function toggleGroup(
    id: string,
  ) {
    setOpenGroups(
      previous => {
        const next = {
          ...previous,

          [id]:
            !previous[id],
        };

        try {
          localStorage.setItem(
            "eventos-shell-open-groups",
            JSON.stringify(
              next,
            ),
          );
        } catch {
          // noop
        }

        return next;
      },
    );
  }


  function toggleCollapsed() {
    setCollapsed(
      previous => {
        const next =
          !previous;

        try {
          localStorage.setItem(
            "eventos-shell-collapsed",
            String(next),
          );
        } catch {
          // noop
        }

        return next;
      },
    );
  }


  function itemActive(
    item: MenuItem,
  ) {
    if (
      !item.href
      ||
      item.disabled
    ) {
      return false;
    }

    if (
      item.href === "/crm"
      &&
      item.queryView
    ) {
      return (
        pathname === "/crm"
        &&
        searchParams.get(
          "view",
        ) ===
          item.queryView
      );
    }

    if (
      item.href === "/crm"
    ) {
      return (
        pathname === "/crm"
        &&
        !searchParams.get(
          "view",
        )
      );
    }

    const pureHref =
      item.href.split(
        "?",
      )[0];

    return pathname.startsWith(
      pureHref,
    );
  }


  const currentLabel =
    useMemo(
      () => {
        for (
          const group
          of groups
        ) {
          for (
            const item
            of group.items
          ) {
            if (
              itemActive(
                item,
              )
            ) {
              return item.label;
            }
          }
        }

        return "Panel de control";
      },
      [
        pathname,
        searchParams,
      ],
    );


  return (
    <div
      className={
        styles.shell
      }
    >
      {
        mobileOpen
        &&
        (
          <button
            type="button"
            className={
              styles.mobileBackdrop
            }
            aria-label="Cerrar menú"
            onClick={() =>
              setMobileOpen(
                false,
              )
            }
          />
        )
      }


      <aside
        className={[
          styles.sidebar,

          collapsed
            ? styles.sidebarCollapsed
            : "",

          mobileOpen
            ? styles.sidebarMobileOpen
            : "",
        ].join(" ")}
      >
        <div
          className={
            styles.brandArea
          }
        >
          <Link
            href="/crm"
            className={
              styles.brand
            }
          >
            <div
              className={
                styles.brandMark
              }
            >
              EM
            </div>

            {
              !collapsed
              &&
              (
                <div
                  className={
                    styles.brandCopy
                  }
                >
                  <span>
                    Gestión de eventos
                  </span>

                  <strong>
                    Eventos
                    <br />
                    Mediterráneo
                  </strong>
                </div>
              )
            }
          </Link>


          <button
            type="button"
            className={
              styles.mobileClose
            }
            onClick={() =>
              setMobileOpen(
                false,
              )
            }
          >
            <Icon
              name="close"
              size={18}
            />
          </button>
        </div>


        <div
          className={
            styles.companyCard
          }
        >
          <div
            className={
              styles.companyStatus
            }
          >
            <span
              className={
                styles.statusDot
              }
            />

            {
              !collapsed
              &&
              (
                <div>
                  <strong>
                    Eventos Mediterráneo
                  </strong>

                  <small>
                    Operación conectada
                  </small>
                </div>
              )
            }
          </div>
        </div>


        <nav
          className={
            styles.menu
          }
        >
          {
            groups.map(
              group => {
                const opened =
                  Boolean(
                    openGroups[
                      group.id
                    ],
                  );

                return (
                  <div
                    key={
                      group.id
                    }
                    className={
                      styles.menuGroup
                    }
                  >
                    <button
                      type="button"
                      className={[
                        styles.groupButton,

                        opened
                          ? styles.groupButtonOpen
                          : "",
                      ].join(" ")}
                      onClick={() =>
                        toggleGroup(
                          group.id,
                        )
                      }
                      title={
                        collapsed
                          ? group.label
                          : undefined
                      }
                    >
                      <span
                        className={
                          styles.groupLeft
                        }
                      >
                        <span
                          className={
                            styles.groupIcon
                          }
                        >
                          <Icon
                            name={
                              group.icon
                            }
                            size={16}
                          />
                        </span>

                        {
                          !collapsed
                          &&
                          (
                            <span>
                              {
                                group.label
                              }
                            </span>
                          )
                        }
                      </span>

                      {
                        !collapsed
                        &&
                        (
                          <span
                            className={[
                              styles.chevron,
                              opened
                                ? styles.chevronOpen
                                : "",
                            ].join(" ")}
                          >
                            <Icon
                              name="chevron"
                              size={15}
                            />
                          </span>
                        )
                      }
                    </button>


                    {
                      opened
                      &&
                      !collapsed
                      &&
                      (
                        <div
                          className={
                            styles.groupItems
                          }
                        >
                          {
                            group.items.map(
                              item => {
                                const active =
                                  itemActive(
                                    item,
                                  );

                                if (
                                  item.disabled
                                ) {
                                  return (
                                    <div
                                      key={
                                        item.label
                                      }
                                      className={
                                        styles.menuItemDisabled
                                      }
                                    >
                                      <Icon
                                        name={
                                          item.icon
                                        }
                                        size={16}
                                      />

                                      <span>
                                        {
                                          item.label
                                        }
                                      </span>

                                      <small>
                                        Próximamente
                                      </small>
                                    </div>
                                  );
                                }

                                return (
                                  <Link
                                    key={
                                      `${group.id}-${item.label}`
                                    }
                                    href={
                                      resolveHref(
                                        item,
                                      )
                                    }
                                    onClick={() =>
                                      setMobileOpen(
                                        false,
                                      )
                                    }
                                    className={[
                                      styles.menuItem,

                                      active
                                        ? styles.menuItemActive
                                        : "",
                                    ].join(" ")}
                                  >
                                    <span
                                      className={
                                        styles.itemIcon
                                      }
                                    >
                                      <Icon
                                        name={
                                          item.icon
                                        }
                                        size={16}
                                      />
                                    </span>

                                    <span
                                      className={
                                        styles.itemLabel
                                      }
                                    >
                                      {
                                        item.label
                                      }
                                    </span>

                                    {
                                      item.badge
                                      &&
                                      (
                                        <span
                                          className={
                                            styles.badge
                                          }
                                        >
                                          {
                                            item.badge
                                          }
                                        </span>
                                      )
                                    }
                                  </Link>
                                );
                              },
                            )
                          }
                        </div>
                      )
                    }
                  </div>
                );
              },
            )
          }
        </nav>


        <div
          className={
            styles.sidebarFooter
          }
        >
          {
            !collapsed
            &&
            (
              <Link
                href="/conversations"
                className={
                  styles.assistantCard
                }
              >
                <div
                  className={
                    styles.assistantTop
                  }
                >
                  <div
                    className={
                      styles.assistantIcon
                    }
                  >
                    <Icon
                      name="bot"
                      size={18}
                    />
                  </div>

                  <div>
                    <span>
                      Asistente comercial
                    </span>

                    <strong>
                      IA operativa
                    </strong>
                  </div>
                </div>

                <div
                  className={
                    styles.whatsappStatus
                  }
                >
                  <span
                    className={
                      styles.statusDot
                    }
                  />

                  WhatsApp conectado
                </div>

                <p>
                  Conversaciones, clientes,
                  presupuestos y seguimiento
                  asistido.
                </p>

                <div
                  className={
                    styles.assistantLink
                  }
                >
                  Abrir asistente
                  <span>
                    →
                  </span>
                </div>
              </Link>
            )
          }


          <button
            type="button"
            className={
              styles.collapseButton
            }
            onClick={
              toggleCollapsed
            }
            title={
              collapsed
                ? "Expandir menú"
                : "Contraer menú"
            }
          >
            <span
              className={
                collapsed
                  ? styles.collapseIconReverse
                  : styles.collapseIcon
              }
            >
              ‹
            </span>

            {
              !collapsed
              &&
              (
                <span>
                  Contraer menú
                </span>
              )
            }
          </button>
        </div>
      </aside>


      <div
        className={[
          styles.workspace,

          collapsed
            ? styles.workspaceCollapsed
            : "",
        ].join(" ")}
      >
        <header
          className={
            styles.topbar
          }
        >
          <div
            className={
              styles.topbarLeft
            }
          >
            <button
              type="button"
              className={
                styles.mobileMenu
              }
              onClick={() =>
                setMobileOpen(
                  true,
                )
              }
            >
              <Icon
                name="menu"
                size={21}
              />
            </button>

            <div
              className={
                styles.pageContext
              }
            >
              <span>
                Empresa actual
              </span>

              <strong>
                Eventos Mediterráneo
              </strong>
            </div>

            <div
              className={
                styles.pageDivider
              }
            />

            <div
              className={
                styles.currentPage
              }
            >
              {currentLabel}
            </div>
          </div>


          <div
            className={
              styles.topbarRight
            }
          >
            <div
              className={
                styles.robotStatus
              }
            >
              <span
                className={
                  styles.statusDot
                }
              />

              <span>
                Robot operativo
              </span>
            </div>

            <Link
              href="/settings"
              className={
                styles.userChip
              }
            >
              <div
                className={
                  styles.userAvatar
                }
              >
                D
              </div>

              <div
                className={
                  styles.userInfo
                }
              >
                <strong>
                  David
                </strong>

                <span>
                  Owner
                </span>
              </div>
            </Link>
          </div>
        </header>


        <main
          className={
            styles.content
          }
        >
          {children}
        </main>
      </div>
    </div>
  );
}
