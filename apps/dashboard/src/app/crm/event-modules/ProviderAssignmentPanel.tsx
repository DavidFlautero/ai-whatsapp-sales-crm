"use client";

export type ProviderAssignment = {
  requirement_id: string;

  provider_id?: string | null;
  provider_name?: string | null;

  service_name?: string | null;

  status:
    | "unassigned"
    | "selected"
    | "reserved"
    | "confirmed"
    | "cancelled";

  provider_cost?:
    number
    | string
    | null;

  client_price?:
    number
    | string
    | null;

  deposit_amount?:
    number
    | string
    | null;

  deposit_paid?:
    boolean
    | null;

  contract_received?:
    boolean
    | null;

  notes?:
    string
    | null;
};

type Props = {
  assignment:
    ProviderAssignment;

  onReserve?: () => void;
  onConfirm?: () => void;
  onCancel?: () => void;
  onChangeProvider?: () => void;
};

function money(
  value:
    | number
    | string
    | null
    | undefined,
) {
  if (
    value === null
    || value === undefined
    || value === ""
  ) {
    return "—";
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
      Number(value),
    );
}

export function ProviderAssignmentPanel({
  assignment,
  onReserve,
  onConfirm,
  onCancel,
  onChangeProvider,
}: Props) {
  const ready =
    Boolean(
      assignment.provider_id,
    );

  return (
    <section
      style={{
        display:
          "grid",

        gap:
          16,

        padding:
          18,

        border:
          assignment.status
          === "confirmed"
            ? "1px solid #86efac"
            : "1px solid #e5e7eb",

        borderRadius:
          12,

        background:
          assignment.status
          === "confirmed"
            ? "#f0fdf4"
            : "#fff",
      }}
    >
      <header>
        <div
          style={{
            fontSize:
              11,

            color:
              "#6b7280",

            fontWeight:
              700,
          }}
        >
          PROVEEDOR ASIGNADO
        </div>

        <h3
          style={{
            margin:
              "4px 0 0",
          }}
        >
          {
            assignment
              .provider_name
            ?? "Sin proveedor"
          }
        </h3>

        <div
          style={{
            marginTop:
              4,

            color:
              "#6b7280",

            fontSize:
              12,
          }}
        >
          {
            assignment
              .service_name
            ?? "Servicio"
          }
          {" · "}
          {
            assignment.status
          }
        </div>
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
        <Box
          label="Coste proveedor"
          value={
            money(
              assignment
                .provider_cost,
            )
          }
        />

        <Box
          label="Precio cliente"
          value={
            money(
              assignment
                .client_price,
            )
          }
        />

        <Box
          label="Señal"
          value={
            money(
              assignment
                .deposit_amount,
            )
          }
        />

        <Box
          label="Señal pagada"
          value={
            assignment
              .deposit_paid
              ? "Sí"
              : "No"
          }
        />

        <Box
          label="Contrato"
          value={
            assignment
              .contract_received
              ? "Recibido"
              : "Pendiente"
          }
        />
      </div>

      {assignment.notes ? (
        <p
          style={{
            margin:
              0,

            whiteSpace:
              "pre-wrap",
          }}
        >
          {
            assignment.notes
          }
        </p>
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
        {onChangeProvider ? (
          <button
            type="button"
            onClick={
              onChangeProvider
            }
          >
            Cambiar proveedor
          </button>
        ) : null}

        {ready
          && assignment.status
          === "selected"
          && onReserve
          ? (
            <button
              type="button"
              onClick={
                onReserve
              }
            >
              Marcar reservado
            </button>
          )
          : null}

        {ready
          && [
            "selected",
            "reserved",
          ].includes(
            assignment.status,
          )
          && onConfirm
          ? (
            <button
              type="button"
              onClick={
                onConfirm
              }
            >
              Confirmar contratación
            </button>
          )
          : null}

        {assignment.status
          !== "cancelled"
          && onCancel
          ? (
            <button
              type="button"
              onClick={
                onCancel
              }
            >
              Cancelar asignación
            </button>
          )
          : null}
      </footer>
    </section>
  );
}

function Box({
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
      <span
        style={{
          display:
            "block",

          fontSize:
            11,

          color:
            "#6b7280",
        }}
      >
        {label}
      </span>

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
