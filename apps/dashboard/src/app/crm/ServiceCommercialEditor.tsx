"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  EventServiceRequirement,
} from "./event-service.types";

type Provider = {
  id: string;
  name: string;
};

type TeamMember = {
  id: string;
  name: string;
};

type Props = {
  eventId: string;
  requirement:
    EventServiceRequirement;
  providers: Provider[];
  team: TeamMember[];
};

type SaveState =
  | "idle"
  | "dirty"
  | "saving"
  | "saved"
  | "error";

const serviceStatuses = [
  ["pending", "Pendiente"],
  ["searching", "Buscando"],
  ["quoted", "Cotizado"],
  ["approved", "Aprobado"],
  ["confirmed", "Confirmado"],
  ["completed", "Completado"],
  ["cancelled", "Cancelado"],
] as const;

const contractStatuses = [
  ["not_required", "No requerido"],
  ["pending", "Pendiente"],
  ["generated", "Generado"],
  ["sent", "Enviado"],
  ["signed", "Firmado"],
  ["cancelled", "Cancelado"],
] as const;

function numberValue(
  value:
    | string
    | number
    | null
    | undefined,
) {
  const parsed =
    Number(value ?? 0);

  return Number.isFinite(
    parsed,
  )
    ? parsed
    : 0;
}

function money(
  value: number,
) {
  return new Intl.NumberFormat(
    "es-ES",
    {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  ).format(value);
}

function makeDraft(
  requirement:
    EventServiceRequirement,
) {
  return {
    serviceStatus:
      requirement.service_status
      ?? "pending",

    assignedProviderId:
      requirement
        .assigned_provider_id
      ?? "",

    responsibleTeamMemberId:
      requirement
        .responsible_team_member_id
      ?? "",

    providerCost:
      String(
        numberValue(
          requirement.provider_cost,
        ),
      ),

    clientPrice:
      String(
        numberValue(
          requirement.client_price,
        ),
      ),

    isCritical:
      Boolean(
        requirement.is_critical,
      ),

    contractStatus:
      requirement.contract_status
      ?? "not_required",

    depositRequired:
      String(
        numberValue(
          requirement.deposit_required,
        ),
      ),

    depositPaid:
      String(
        numberValue(
          requirement.deposit_paid,
        ),
      ),

    providerPaymentDueDate:
      requirement
        .provider_payment_due_date
      ?? "",

    commercialTerms:
      requirement
        .commercial_terms
      ?? "",

    arrivalTime:
      requirement.arrival_time
      ?? "",

    setupTime:
      requirement.setup_time
      ?? "",

    technicalNeeds:
      requirement.technical_needs
      ?? "",

    operationalNotes:
      requirement.operational_notes
      ?? "",
  };
}

export function ServiceCommercialEditor({
  eventId,
  requirement,
  providers,
  team,
}: Props) {
  const [
    draft,
    setDraft,
  ] =
    useState(
      () =>
        makeDraft(
          requirement,
        ),
    );

  const [
    saveState,
    setSaveState,
  ] =
    useState<SaveState>(
      "idle",
    );

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(null);

  useEffect(
    () => {
      setDraft(
        makeDraft(
          requirement,
        ),
      );

      setSaveState(
        "idle",
      );

      setError(
        null,
      );
    },
    [
      requirement.id,
    ],
  );

  function change<
    K extends keyof typeof draft,
  >(
    key: K,
    value:
      (typeof draft)[K],
  ) {
    setDraft(
      (
        current,
      ) => ({
        ...current,
        [key]:
          value,
      }),
    );

    setSaveState(
      "dirty",
    );

    setError(
      null,
    );
  }

  const providerCost =
    numberValue(
      draft.providerCost,
    );

  const clientPrice =
    numberValue(
      draft.clientPrice,
    );

  const margin =
    clientPrice
    - providerCost;

  const marginPercent =
    clientPrice > 0
      ? (
          margin
          / clientPrice
        ) * 100
      : 0;

  const depositRequired =
    numberValue(
      draft.depositRequired,
    );

  const depositPaid =
    numberValue(
      draft.depositPaid,
    );

  const providerBalance =
    Math.max(
      providerCost
      - depositPaid,
      0,
    );

  const signedWithoutProvider =
    draft.contractStatus
      === "signed"
    && !draft
      .assignedProviderId;

  const loss =
    clientPrice > 0
    && providerCost
      > clientPrice;

  const selectedProvider =
    useMemo(
      () =>
        providers.find(
          (
            provider,
          ) =>
            provider.id
            === draft
              .assignedProviderId,
        ),
      [
        providers,
        draft
          .assignedProviderId,
      ],
    );

  async function save() {
    setSaveState(
      "saving",
    );

    setError(
      null,
    );

    try {
      const response =
        await fetch(
          `/api/crm/events/${eventId}/requirements/${requirement.id}`,
          {
            method:
              "PATCH",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                serviceStatus:
                  draft
                    .serviceStatus,

                assignedProviderId:
                  draft
                    .assignedProviderId
                  || null,

                responsibleTeamMemberId:
                  draft
                    .responsibleTeamMemberId
                  || null,

                providerCost,
                clientPrice,

                isCritical:
                  draft
                    .isCritical,

                contractStatus:
                  draft
                    .contractStatus,

                depositRequired,
                depositPaid,

                providerPaymentDueDate:
                  draft
                    .providerPaymentDueDate
                  || null,

                commercialTerms:
                  draft
                    .commercialTerms
                  .trim()
                  || null,

                arrivalTime:
                  draft
                    .arrivalTime
                  || null,

                setupTime:
                  draft
                    .setupTime
                  || null,

                technicalNeeds:
                  draft
                    .technicalNeeds
                  .trim()
                  || null,

                operationalNotes:
                  draft
                    .operationalNotes
                  .trim()
                  || null,
              }),
          },
        );

      const body =
        await response.json();

      if (
        !response.ok
      ) {
        throw new Error(
          body?.error
          ?? "No se pudo guardar el servicio.",
        );
      }

      if (
        body?.requirement
      ) {
        setDraft(
          makeDraft(
            body.requirement,
          ),
        );
      }

      setSaveState(
        "saved",
      );

      window.dispatchEvent(
        new CustomEvent(
          "event-service-updated",
          {
            detail: {
              eventId,
            },
          },
        ),
      );
    } catch (
      saveError
    ) {
      setSaveState(
        "error",
      );

      setError(
        saveError
          instanceof Error
          ? saveError.message
          : "No se pudo guardar el servicio.",
      );
    }
  }

  function discard() {
    setDraft(
      makeDraft(
        requirement,
      ),
    );

    setSaveState(
      "idle",
    );

    setError(
      null,
    );
  }

  const inputStyle = {
    width: "100%",
    minHeight: 42,
    border:
      "1px solid #d7d9de",
    borderRadius: 8,
    padding:
      "9px 11px",
    background:
      "#fff",
    color:
      "#16181d",
    fontSize: 14,
  } as const;

  const labelStyle = {
    display: "grid",
    gap: 6,
    fontSize: 12,
    fontWeight: 700,
    color: "#555b66",
  } as const;

  const sectionStyle = {
    display: "grid",
    gap: 14,
    padding:
      "18px 0",
    borderTop:
      "1px solid #eceef1",
  } as const;

  return (
    <div
      style={{
        display:
          "grid",
        gap: 18,
      }}
    >
      {error ? (
        <div
          style={{
            padding:
              "11px 13px",
            borderRadius:
              8,
            border:
              "1px solid #fecaca",
            background:
              "#fef2f2",
            color:
              "#991b1b",
            fontSize:
              13,
            fontWeight:
              700,
          }}
        >
          {error}
        </div>
      ) : null}

      {loss ? (
        <div
          style={{
            padding:
              "13px 14px",
            borderRadius:
              8,
            border:
              "1px solid #fecaca",
            background:
              "#fff7f7",
          }}
        >
          <strong
            style={{
              display:
                "block",
              color:
                "#991b1b",
              marginBottom:
                4,
            }}
          >
            Servicio con pérdida
          </strong>

          <span
            style={{
              fontSize:
                13,
              color:
                "#7f1d1d",
            }}
          >
            El coste proveedor supera
            el precio cobrado al cliente
            en{" "}
            {money(
              Math.abs(
                margin,
              ),
            )}.
          </span>
        </div>
      ) : null}

      <section
        style={
          sectionStyle
        }
      >
        <div>
          <strong>
            Gestión del servicio
          </strong>

          <div
            style={{
              marginTop:
                4,
              fontSize:
                12,
              color:
                "#717784",
            }}
          >
            Proveedor, responsable y
            estado operativo.
          </div>
        </div>

        <div
          style={{
            display:
              "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          <label
            style={
              labelStyle
            }
          >
            Estado

            <select
              style={
                inputStyle
              }
              value={
                draft
                  .serviceStatus
              }
              onChange={
                (event) =>
                  change(
                    "serviceStatus",
                    event
                      .target
                      .value as typeof draft.serviceStatus,
                  )
              }
            >
              {serviceStatuses.map(
                ([
                  value,
                  label,
                ]) => (
                  <option
                    key={
                      value
                    }
                    value={
                      value
                    }
                  >
                    {label}
                  </option>
                ),
              )}
            </select>
          </label>

          <label
            style={
              labelStyle
            }
          >
            Proveedor

            <select
              style={
                inputStyle
              }
              value={
                draft
                  .assignedProviderId
              }
              onChange={
                (event) =>
                  change(
                    "assignedProviderId",
                    event
                      .target
                      .value,
                  )
              }
            >
              <option value="">
                Sin asignar
              </option>

              {providers.map(
                (
                  provider,
                ) => (
                  <option
                    key={
                      provider.id
                    }
                    value={
                      provider.id
                    }
                  >
                    {
                      provider.name
                    }
                  </option>
                ),
              )}
            </select>
          </label>

          <label
            style={
              labelStyle
            }
          >
            Responsable interno

            <select
              style={
                inputStyle
              }
              value={
                draft
                  .responsibleTeamMemberId
              }
              onChange={
                (event) =>
                  change(
                    "responsibleTeamMemberId",
                    event
                      .target
                      .value,
                  )
              }
            >
              <option value="">
                Sin responsable
              </option>

              {team.map(
                (
                  member,
                ) => (
                  <option
                    key={
                      member.id
                    }
                    value={
                      member.id
                    }
                  >
                    {
                      member.name
                    }
                  </option>
                ),
              )}
            </select>
          </label>

          <label
            style={{
              ...labelStyle,
              alignSelf:
                "end",
            }}
          >
            <span
              style={{
                display:
                  "flex",
                gap: 8,
                alignItems:
                  "center",
                minHeight:
                  42,
              }}
            >
              <input
                type="checkbox"
                checked={
                  draft
                    .isCritical
                }
                onChange={
                  (event) =>
                    change(
                      "isCritical",
                      event
                        .target
                        .checked,
                    )
                }
              />

              Servicio crítico
            </span>
          </label>
        </div>
      </section>

      <section
        style={
          sectionStyle
        }
      >
        <div>
          <strong>
            Finanzas del servicio
          </strong>
        </div>

        <div
          style={{
            display:
              "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          <label
            style={
              labelStyle
            }
          >
            Coste proveedor

            <input
              style={
                inputStyle
              }
              type="number"
              min="0"
              step="0.01"
              value={
                draft
                  .providerCost
              }
              onChange={
                (event) =>
                  change(
                    "providerCost",
                    event
                      .target
                      .value,
                  )
              }
            />
          </label>

          <label
            style={
              labelStyle
            }
          >
            Precio cliente

            <input
              style={
                inputStyle
              }
              type="number"
              min="0"
              step="0.01"
              value={
                draft
                  .clientPrice
              }
              onChange={
                (event) =>
                  change(
                    "clientPrice",
                    event
                      .target
                      .value,
                  )
              }
            />
          </label>

          <div>
            <span
              style={{
                display:
                  "block",
                fontSize:
                  12,
                fontWeight:
                  700,
                color:
                  "#555b66",
                marginBottom:
                  6,
              }}
            >
              Margen
            </span>

            <strong
              style={{
                display:
                  "block",
                fontSize:
                  18,
                color:
                  margin < 0
                    ? "#b91c1c"
                    : "#166534",
              }}
            >
              {money(
                margin,
              )}
            </strong>

            <small>
              {
                marginPercent
                  .toFixed(
                    1,
                  )
              }
              %
            </small>
          </div>
        </div>
      </section>

      <section
        style={
          sectionStyle
        }
      >
        <div>
          <strong>
            Contrato y pagos
          </strong>

          {selectedProvider ? (
            <div
              style={{
                marginTop:
                  4,
                fontSize:
                  12,
                color:
                  "#717784",
              }}
            >
              Proveedor:{" "}
              {
                selectedProvider
                  .name
              }
            </div>
          ) : null}
        </div>

        <div
          style={{
            display:
              "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          <label
            style={
              labelStyle
            }
          >
            Estado contrato

            <select
              style={
                inputStyle
              }
              value={
                draft
                  .contractStatus
              }
              onChange={
                (event) =>
                  change(
                    "contractStatus",
                    event
                      .target
                      .value as typeof draft.contractStatus,
                  )
              }
            >
              {contractStatuses.map(
                ([
                  value,
                  label,
                ]) => (
                  <option
                    key={
                      value
                    }
                    value={
                      value
                    }
                  >
                    {label}
                  </option>
                ),
              )}
            </select>
          </label>

          <label
            style={
              labelStyle
            }
          >
            Anticipo requerido

            <input
              style={
                inputStyle
              }
              type="number"
              min="0"
              step="0.01"
              value={
                draft
                  .depositRequired
              }
              onChange={
                (event) =>
                  change(
                    "depositRequired",
                    event
                      .target
                      .value,
                  )
              }
            />
          </label>

          <label
            style={
              labelStyle
            }
          >
            Anticipo pagado

            <input
              style={
                inputStyle
              }
              type="number"
              min="0"
              step="0.01"
              value={
                draft
                  .depositPaid
              }
              onChange={
                (event) =>
                  change(
                    "depositPaid",
                    event
                      .target
                      .value,
                  )
              }
            />
          </label>

          <label
            style={
              labelStyle
            }
          >
            Fecha límite pago

            <input
              style={
                inputStyle
              }
              type="date"
              value={
                draft
                  .providerPaymentDueDate
              }
              onChange={
                (event) =>
                  change(
                    "providerPaymentDueDate",
                    event
                      .target
                      .value,
                  )
              }
            />
          </label>
        </div>

        <div
          style={{
            display:
              "flex",
            gap: 20,
            flexWrap:
              "wrap",
            fontSize:
              13,
          }}
        >
          <span>
            Anticipo requerido:{" "}
            <strong>
              {money(
                depositRequired,
              )}
            </strong>
          </span>

          <span>
            Pagado:{" "}
            <strong>
              {money(
                depositPaid,
              )}
            </strong>
          </span>

          <span>
            Saldo proveedor:{" "}
            <strong>
              {money(
                providerBalance,
              )}
            </strong>
          </span>
        </div>
      </section>

      <section
        style={
          sectionStyle
        }
      >
        <div>
          <strong>
            Condiciones comerciales
          </strong>
        </div>

        <label
          style={
            labelStyle
          }
        >
          Acuerdo con el proveedor

          <textarea
            style={{
              ...inputStyle,
              minHeight:
                110,
              resize:
                "vertical",
            }}
            value={
              draft
                .commercialTerms
            }
            placeholder="Precio, reserva, saldo, horas incluidas, extras, cancelación, condiciones especiales..."
            onChange={
              (event) =>
                change(
                  "commercialTerms",
                  event
                    .target
                    .value,
                )
            }
          />
        </label>
      </section>

      <section
        style={
          sectionStyle
        }
      >
        <div>
          <strong>
            Operación
          </strong>
        </div>

        <div
          style={{
            display:
              "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          <label
            style={
              labelStyle
            }
          >
            Hora de llegada

            <input
              style={
                inputStyle
              }
              type="time"
              value={
                draft
                  .arrivalTime
              }
              onChange={
                (event) =>
                  change(
                    "arrivalTime",
                    event
                      .target
                      .value,
                  )
              }
            />
          </label>

          <label
            style={
              labelStyle
            }
          >
            Hora de montaje

            <input
              style={
                inputStyle
              }
              type="time"
              value={
                draft
                  .setupTime
              }
              onChange={
                (event) =>
                  change(
                    "setupTime",
                    event
                      .target
                      .value,
                  )
              }
            />
          </label>
        </div>

        <label
          style={
            labelStyle
          }
        >
          Necesidades técnicas

          <textarea
            style={{
              ...inputStyle,
              minHeight:
                85,
              resize:
                "vertical",
            }}
            value={
              draft
                .technicalNeeds
            }
            onChange={
              (event) =>
                change(
                  "technicalNeeds",
                  event
                    .target
                    .value,
                )
            }
          />
        </label>

        <label
          style={
            labelStyle
          }
        >
          Notas operativas

          <textarea
            style={{
              ...inputStyle,
              minHeight:
                95,
              resize:
                "vertical",
            }}
            value={
              draft
                .operationalNotes
            }
            placeholder="Acceso, montaje, contacto, indicaciones, incidencias..."
            onChange={
              (event) =>
                change(
                  "operationalNotes",
                  event
                    .target
                    .value,
                )
            }
          />
        </label>
      </section>

      <div
        style={{
          position:
            "sticky",
          bottom:
            0,
          display:
            "flex",
          justifyContent:
            "space-between",
          alignItems:
            "center",
          gap: 12,
          padding:
            "14px 0",
          background:
            "rgba(255,255,255,.96)",
          borderTop:
            "1px solid #e5e7eb",
          zIndex:
            2,
        }}
      >
        <div
          style={{
            fontSize:
              12,
            fontWeight:
              700,
            color:
              saveState
                === "error"
                ? "#b91c1c"
                : saveState
                    === "saved"
                  ? "#166534"
                  : "#6b7280",
          }}
        >
          {
            saveState
              === "dirty"
              ? "● Cambios sin guardar"
              : saveState
                  === "saving"
                ? "Guardando..."
                : saveState
                    === "saved"
                  ? "✓ Guardado"
                  : saveState
                      === "error"
                    ? "⚠ No se pudo guardar"
                    : "Sin cambios"
          }
        </div>

        <div
          style={{
            display:
              "flex",
            gap: 8,
          }}
        >
          <button
            type="button"
            disabled={
              saveState
              !== "dirty"
            }
            onClick={
              discard
            }
            style={{
              minHeight:
                40,
              padding:
                "0 16px",
              borderRadius:
                8,
              border:
                "1px solid #d1d5db",
              background:
                "#fff",
              cursor:
                saveState
                === "saving"
                  ? "wait"
                  : "pointer",
            }}
          >
            Descartar
          </button>

          <button
            type="button"
            disabled={
              saveState
                === "saving"
            }
            onClick={
              () => {
                void save();
              }
            }
            style={{
              minHeight:
                40,
              padding:
                "0 18px",
              borderRadius:
                8,
              border:
                "1px solid #111827",
              background:
                saveState
                === "saving"
                  ? "#9ca3af"
                  : "#111827",
              color:
                "#fff",
              fontWeight:
                800,
              cursor:
                saveState
                === "dirty"
                  ? "pointer"
                  : "default",
            }}
          >
            {
              saveState
                === "saving"
                ? "Guardando..."
                : "Guardar cambios"
            }
          </button>
        </div>
      </div>
    </div>
  );
}
