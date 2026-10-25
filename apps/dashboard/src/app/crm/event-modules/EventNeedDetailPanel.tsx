"use client";

export type NeedDetail = {
  id: string;

  category_id?: string | null;
  category_name?: string | null;

  service_name?: string | null;

  requirement?: string | null;
  description?: string | null;

  status?: string | null;

  priority?: string | null;

  quantity?: number | null;

  required?: boolean | null;
  critical?: boolean | null;

  assigned_provider_id?: string | null;
  provider_name?: string | null;

  responsible_name?: string | null;

  due_date?: string | null;

  provider_cost?: number | string | null;
  client_price?: number | string | null;

  notes?: string | null;
};

type Props = {
  need: NeedDetail | null;

  onClose: () => void;

  onSearchProviders?: (
    need: NeedDetail,
  ) => void;

  onEdit?: (
    need: NeedDetail,
  ) => void;

  onChangeStatus?: (
    need: NeedDetail,
    status: string,
  ) => void;
};

const STATUSES = [
  {
    value: "pending",
    label: "Pendiente",
  },
  {
    value: "sourcing",
    label: "Buscando proveedor",
  },
  {
    value: "quoting",
    label: "Cotizando",
  },
  {
    value: "option_found",
    label: "Opción encontrada",
  },
  {
    value: "approval",
    label: "Pendiente cliente",
  },
  {
    value: "reserved",
    label: "Reservado",
  },
  {
    value: "confirmed",
    label: "Confirmado",
  },
  {
    value: "cancelled",
    label: "Cancelado",
  },
];

function value(
  input:
    | string
    | number
    | null
    | undefined,
) {
  if (
    input === null
    || input === undefined
    || input === ""
  ) {
    return "—";
  }

  return String(input);
}

function money(
  input:
    | number
    | string
    | null
    | undefined,
) {
  if (
    input === null
    || input === undefined
    || input === ""
  ) {
    return "—";
  }

  const number =
    Number(input);

  if (
    Number.isNaN(
      number,
    )
  ) {
    return String(
      input,
    );
  }

  return new Intl
    .NumberFormat(
      "es-ES",
      {
        style:
          "currency",

        currency:
          "EUR",
      },
    )
    .format(
      number,
    );
}

export function EventNeedDetailPanel({
  need,
  onClose,
  onSearchProviders,
  onEdit,
  onChangeStatus,
}: Props) {
  if (!need) {
    return null;
  }

  const title =
    need.service_name
    ?? need.category_name
    ?? need.requirement
    ?? "Necesidad";

  return (
    <section
      style={{
        display:
          "grid",

        gap:
          18,

        padding:
          20,

        border:
          need.critical
            ? "1px solid #fca5a5"
            : "1px solid #e5e7eb",

        borderRadius:
          14,

        background:
          "#fff",
      }}
    >
      <header
        style={{
          display:
            "flex",

          justifyContent:
            "space-between",

          alignItems:
            "flex-start",

          gap:
            16,
        }}
      >
        <div>
          <div
            style={{
              fontSize:
                11,

              fontWeight:
                700,

              color:
                "#6b7280",

              letterSpacing:
                ".08em",
            }}
          >
            NECESIDAD DEL EVENTO
          </div>

          <h2
            style={{
              margin:
                "4px 0 0",
            }}
          >
            {title}
          </h2>

          {need.critical ? (
            <div
              style={{
                marginTop:
                  6,

                color:
                  "#991b1b",

                fontSize:
                  12,

                fontWeight:
                  700,
              }}
            >
              CRÍTICO
            </div>
          ) : null}
        </div>

        <button
          type="button"
          onClick={
            onClose
          }
        >
          Cerrar
        </button>
      </header>

      <div
        style={{
          display:
            "grid",

          gridTemplateColumns:
            "repeat(auto-fit,minmax(180px,1fr))",

          gap:
            10,
        }}
      >
        <DataCard
          label="Estado"
          value={
            STATUSES.find(
              (
                item,
              ) =>
                item.value
                === need.status,
            )?.label
            ?? "Pendiente"
          }
        />

        <DataCard
          label="Prioridad"
          value={
            value(
              need.priority,
            )
          }
        />

        <DataCard
          label="Cantidad"
          value={
            value(
              need.quantity,
            )
          }
        />

        <DataCard
          label="Responsable"
          value={
            value(
              need.responsible_name,
            )
          }
        />

        <DataCard
          label="Fecha límite"
          value={
            value(
              need.due_date,
            )
          }
        />

        <DataCard
          label="Proveedor"
          value={
            value(
              need.provider_name,
            )
          }
        />
      </div>

      {need.description ? (
        <section>
          <strong>
            Descripción
          </strong>

          <p
            style={{
              margin:
                "6px 0 0",

              color:
                "#4b5563",

              whiteSpace:
                "pre-wrap",
            }}
          >
            {
              need.description
            }
          </p>
        </section>
      ) : null}

      <div
        style={{
          display:
            "grid",

          gridTemplateColumns:
            "repeat(auto-fit,minmax(220px,1fr))",

          gap:
            10,
        }}
      >
        <DataCard
          label="Coste proveedor"
          value={
            money(
              need.provider_cost,
            )
          }
        />

        <DataCard
          label="Precio cliente"
          value={
            money(
              need.client_price,
            )
          }
        />
      </div>

      {onChangeStatus ? (
        <section
          style={{
            display:
              "grid",

            gap:
              8,
          }}
        >
          <strong>
            Cambiar estado
          </strong>

          <div
            style={{
              display:
                "flex",

              gap:
                6,

              flexWrap:
                "wrap",
            }}
          >
            {STATUSES.map(
              (
                status,
              ) => (
                <button
                  key={
                    status.value
                  }
                  type="button"
                  disabled={
                    need.status
                    === status.value
                  }
                  onClick={() =>
                    onChangeStatus(
                      need,
                      status.value,
                    )
                  }
                >
                  {
                    status.label
                  }
                </button>
              ),
            )}
          </div>
        </section>
      ) : null}

      {need.notes ? (
        <section>
          <strong>
            Notas internas
          </strong>

          <p
            style={{
              margin:
                "6px 0 0",

              whiteSpace:
                "pre-wrap",

              color:
                "#4b5563",
            }}
          >
            {need.notes}
          </p>
        </section>
      ) : null}

      <footer
        style={{
          display:
            "flex",

          justifyContent:
            "flex-end",

          gap:
            8,

          flexWrap:
            "wrap",
        }}
      >
        {onEdit ? (
          <button
            type="button"
            onClick={() =>
              onEdit(
                need,
              )
            }
          >
            Editar necesidad
          </button>
        ) : null}

        {!need.assigned_provider_id
          && onSearchProviders
          ? (
            <button
              type="button"
              onClick={() =>
                onSearchProviders(
                  need,
                )
              }
            >
              Buscar proveedores
            </button>
          )
          : null}
      </footer>
    </section>
  );
}

function DataCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        padding:
          12,

        border:
          "1px solid #e5e7eb",

        borderRadius:
          9,

        background:
          "#f9fafb",
      }}
    >
      <div
        style={{
          color:
            "#6b7280",

          fontSize:
            11,
        }}
      >
        {label}
      </div>

      <strong
        style={{
          display:
            "block",

          marginTop:
            4,
        }}
      >
        {value}
      </strong>
    </div>
  );
}
