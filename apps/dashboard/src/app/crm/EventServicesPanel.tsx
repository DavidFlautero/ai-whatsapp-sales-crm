"use client";

import {
  useEffect,
  useState,
} from "react";

import type {
  EventServiceRequirement,
} from "./event-service.types";

import {
  ProviderMatchingPanel,
} from "./event-modules/ProviderMatchingPanel";

import {
  ProviderAvailabilityPanel,
  type ProviderAvailability,
} from "./event-modules/ProviderAvailabilityPanel";

import {
  ServiceCommercialEditor,
} from "./ServiceCommercialEditor";

import styles
  from "./event-services.module.css";


type Provider = {
  id: string;
  name: string;

  whatsapp?: string | null;

  city?: string | null;
  province?: string | null;
  service_area?: string | null;

  internal_rating?:
    number
    | string
    | null;

  times_used?: number | null;
  incident_count?: number | null;
};


type ProviderService = {
  id: string;

  provider_id: string;
  category_id: string;

  name: string;

  description?: string | null;

  capacity_min?: number | null;
  capacity_max?: number | null;

  lead_time_days?: number | null;

  active?: boolean;
};


type AvailabilityRow = {
  provider_id: string;

  status:
    ProviderAvailability["status"];

  event_date?:
    string | null;

  checked_at?:
    string | null;

  notes?:
    string | null;
};


type TeamMember = {
  id: string;
  name: string;
};


type Category = {
  id: string;
  name?: string;
  label?: string;
};


type Props = {
  eventId: string;

  requirements:
    EventServiceRequirement[];

  providers:
    Provider[];

  providerServices:
    ProviderService[];

  eventDate?:
    string | null;

  eventCity?:
    string | null;

  eventProvince?:
    string | null;

  guestCount?:
    number | null;

  team:
    TeamMember[];

  categories:
    Category[];
};


const statusLabels = {
  pending:
    "Pendiente",

  searching:
    "Buscando",

  quoted:
    "Cotizado",

  approved:
    "Aprobado",

  confirmed:
    "Confirmado",

  completed:
    "Completado",

  cancelled:
    "Cancelado",
};


async function updateService(
  eventId: string,
  requirementId: string,
  payload:
    Record<string, unknown>,
) {
  const response =
    await fetch(
      `/api/crm/events/${eventId}/requirements/${requirementId}`,
      {
        method:
          "PATCH",

        headers: {
          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify(
            payload,
          ),
      },
    );

  const body =
    await response.json();

  if (
    !response.ok
  ) {
    throw new Error(
      body?.error
      ?? "No se pudo actualizar.",
    );
  }

  return body;
}


export function EventServicesPanel({
  eventId,
  requirements,
  providers,
  providerServices,
  eventDate,
  eventCity,
  eventProvince,
  guestCount,
  team,
  categories,
}: Props) {
  const [
    openId,
    setOpenId,
  ] =
    useState<
      string | null
    >(null);

  const [
    localRequirements,
    setLocalRequirements,
  ] =
    useState(
      requirements,
    );

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(null);

  const [
    matchingId,
    setMatchingId,
  ] =
    useState<
      string | null
    >(null);

  const [
    availabilityByRequirement,
    setAvailabilityByRequirement,
  ] =
    useState<
      Record<
        string,
        AvailabilityRow[]
      >
    >({});

  const [
    availabilityLoaded,
    setAvailabilityLoaded,
  ] =
    useState<
      Record<
        string,
        boolean
      >
    >({});


  useEffect(
    () => {
      setLocalRequirements(
        requirements,
      );
    },
    [
      requirements,
    ],
  );

  useEffect(
    () => {
      if (
        !openId
        || availabilityLoaded[
          openId
        ]
      ) {
        return;
      }

      void loadAvailability(
        openId,
      );
    },
    [
      openId,
      availabilityLoaded,
    ],
  );


  const categoryNames =
    new Map(
      categories.map(
        (category) => [
          category.id,
          category.name
          ?? category.label
          ?? "Servicio",
        ],
      ),
    );


  async function loadAvailability(
    requirementId: string,
  ) {
    try {
      setError(
        null,
      );

      const response =
        await fetch(
          `/api/crm/events/${eventId}/requirements/${requirementId}/availability`,
        );

      const body =
        await response.json();

      if (!response.ok) {
        throw new Error(
          body?.error
          ?? "No se pudo cargar la disponibilidad.",
        );
      }

      const rows:
        AvailabilityRow[] =
        Array.isArray(
          body?.availability,
        )
          ? body.availability
          : [];

      setAvailabilityByRequirement(
        (
          current,
        ) => ({
          ...current,
          [requirementId]:
            rows,
        }),
      );

      setAvailabilityLoaded(
        (
          current,
        ) => ({
          ...current,
          [requirementId]:
            true,
        }),
      );

    } catch (
      loadError
    ) {
      setError(
        loadError
          instanceof Error
          ? loadError.message
          : "No se pudo cargar la disponibilidad.",
      );
    }
  }


  async function setAvailabilityStatus(
    requirementId: string,
    providerId: string,
    status:
      ProviderAvailability["status"],
  ) {
    try {
      setError(
        null,
      );

      const response =
        await fetch(
          `/api/crm/events/${eventId}/requirements/${requirementId}/availability/${providerId}`,
          {
            method:
              "PUT",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                status,
              }),
          },
        );

      const body =
        await response.json();

      if (!response.ok) {
        throw new Error(
          body?.error
          ?? "No se pudo actualizar la disponibilidad.",
        );
      }

      const row:
          AvailabilityRow | null =
          body?.availability
          ?? null;

      if (row) {
        setAvailabilityByRequirement(
          (
            current,
          ) => {
            const existing =
              current[
                requirementId
              ]
              ?? [];

            const next =
              existing
                .filter(
                  (
                    item,
                  ) =>
                    item.provider_id
                    !== providerId,
                );

            next.push(
              row,
            );

            return {
              ...current,
              [requirementId]:
                next,
            };
          },
        );
      }

      setAvailabilityLoaded(
        (
          current,
        ) => ({
          ...current,
          [requirementId]:
            true,
        }),
      );

    } catch (
      updateError
    ) {
      setError(
        updateError
          instanceof Error
          ? updateError.message
          : "No se pudo actualizar la disponibilidad.",
      );

      throw updateError;
    }
  }


  async function save(
    id: string,
    payload:
      Record<string, unknown>,
  ) {
    try {
      setError(
        null,
      );

      const result =
        await updateService(
          eventId,
          id,
          payload,
        );

      if (
        result?.requirement
      ) {
        setLocalRequirements(
          (
            current,
          ) =>
            current.map(
              (
                requirement,
              ) =>
                requirement.id
                === id
                  ? {
                      ...requirement,
                      ...result
                        .requirement,
                    }
                  : requirement,
            ),
        );
      }

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
      setError(
        saveError
          instanceof Error
          ? saveError.message
          : "No se pudo guardar el servicio.",
      );

      throw saveError;
    }
  }


  return (
    <div
      className={
        styles.root
      }
    >
      {error ? (
        <div
          className={
            styles.error
          }
        >
          {error}
        </div>
      ) : null}

      {!localRequirements.length ? (
        <div
          className={
            styles.empty
          }
        >
          Todavía no hay servicios
          cargados para este evento.
        </div>
      ) : null}

      {localRequirements.map(
        (
          requirement,
        ) => {
          const open =
            requirement.id
            === openId;

          const serviceName =
            requirement
              .service_name
            ||
            (
              requirement
                .category_id
                ? categoryNames
                    .get(
                      requirement
                        .category_id,
                    )
                : null
            )
            ||
            "Servicio";

          const provider =
            providers.find(
              (item) =>
                item.id
                === requirement
                  .assigned_provider_id,
            );

          const compatibleProviderIds =
            new Set(
              providerServices
                .filter(
                  (
                    service,
                  ) =>
                    service.active
                    !== false
                    && (
                      !requirement
                        .category_id
                      || service
                        .category_id
                        === requirement
                          .category_id
                    ),
                )
                .map(
                  (
                    service,
                  ) =>
                    service
                      .provider_id,
                ),
            );

          const compatibleProviders =
            providers.filter(
              (
                item,
              ) =>
                compatibleProviderIds
                  .has(
                    item.id,
                  )
                || item.id
                  === requirement
                    .assigned_provider_id,
            );

          const savedAvailability =
            availabilityByRequirement[
              requirement.id
            ]
            ?? [];

          const availabilityProviderIds =
            new Set([
              ...compatibleProviders
                .map(
                  (
                    item,
                  ) =>
                    item.id,
                ),

              ...savedAvailability
                .map(
                  (
                    item,
                  ) =>
                    item.provider_id,
                ),
            ]);

          const availabilityItems:
            ProviderAvailability[] =
            Array.from(
              availabilityProviderIds,
            )
              .map(
                (
                  providerId,
                ) => {
                  const providerItem =
                    providers.find(
                      (
                        item,
                      ) =>
                        item.id
                        === providerId,
                    );

                  const saved =
                    savedAvailability
                      .find(
                        (
                          item,
                        ) =>
                          item.provider_id
                          === providerId,
                      );

                  return {
                    provider_id:
                      providerId,

                    provider_name:
                      providerItem
                        ?.name
                      ?? "Proveedor",

                    status:
                      saved
                        ?.status
                      ?? "unknown",

                    event_date:
                      saved
                        ?.event_date
                      ?? eventDate
                      ?? null,

                    checked_at:
                      saved
                        ?.checked_at
                      ?? null,

                    notes:
                      saved
                        ?.notes
                      ?? null,
                  };
                },
              );

          const margin =
            Number(
              requirement
                .client_price
              ?? 0,
            )
            -
            Number(
              requirement
                .provider_cost
              ?? 0,
            );

          return (
            <article
              key={
                requirement.id
              }
              className={
                styles.card
              }
            >
              <button
                type="button"
                className={
                  styles.top
                }
                onClick={
                  () =>
                    setOpenId(
                      open
                        ? null
                        : requirement.id,
                    )
                }
              >
                <div>
                  <strong>
                    {serviceName}
                  </strong>

                  <span>
                    {provider?.name
                      ?? "Sin proveedor"}
                  </span>
                </div>

                <div
                  className={
                    styles.right
                  }
                >
                  {requirement
                    .is_critical ? (
                    <span
                      className={
                        styles.critical
                      }
                    >
                      Crítico
                    </span>
                  ) : null}

                  <span
                    className={
                      styles.status
                    }
                  >
                    {
                      statusLabels[
                        requirement
                          .service_status
                        ?? "pending"
                      ]
                    }
                  </span>

                  <span>
                    {open
                      ? "−"
                      : "+"}
                  </span>
                </div>
              </button>

              {open ? (
                <div
                  className={
                    styles.body
                  }
                >

                    <div
                      style={{
                        display: "grid",
                        gap: 12,
                        marginBottom: 16,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setMatchingId(
                            (
                              current,
                            ) =>
                              current
                              === requirement.id
                                ? null
                                : requirement.id,
                          )
                        }
                      >
                        {
                          matchingId
                          === requirement.id
                            ? "Ocultar proveedores compatibles"
                            : "Buscar proveedores compatibles"
                        }
                      </button>

                      {
                        matchingId
                        === requirement.id
                          ? (
                            <ProviderMatchingPanel
                              categoryId={
                                requirement
                                  .category_id
                              }
                              categoryName={
                                serviceName
                              }
                              city={
                                eventCity
                              }
                              province={
                                eventProvince
                              }
                              guests={
                                guestCount
                              }
                              providers={
                                providers
                              }
                              services={
                                providerServices
                              }
                              onSelectProvider={
                                async (
                                  selectedProvider,
                                ) => {
                                  await save(
                                    requirement.id,
                                    {
                                      assignedProviderId:
                                        selectedProvider.id,

                                      serviceStatus:
                                        "approved",
                                    },
                                  );

                                  setMatchingId(
                                    null,
                                  );
                                }
                              }
                            />
                          )
                          : null
                      }
                    </div>

                    <ProviderAvailabilityPanel
                      eventDate={
                        eventDate
                      }

                      items={
                        availabilityItems
                      }

                      onRequestCheck={
                        (
                          item,
                        ) => {
                          void setAvailabilityStatus(
                            requirement.id,
                            item.provider_id,
                            "requested",
                          );
                        }
                      }

                      onSetStatus={
                        (
                          item,
                          status,
                        ) => {
                          void setAvailabilityStatus(
                            requirement.id,
                            item.provider_id,
                            status,
                          );
                        }
                      }
                    />

                  <ServiceCommercialEditor
                    eventId={eventId}
                    requirement={requirement}
                    providers={compatibleProviders}
                    team={team}
                  />

                  <div
                    style={{ display: "none" }}
                    className={
                      styles.grid
                    }
                  >
                    <label>
                      <span>
                        Estado
                      </span>

                      <select
                        value={
                          requirement
                            .service_status
                          ?? "pending"
                        }
                        onChange={
                          (event) =>
                            save(
                              requirement.id,
                              {
                                serviceStatus:
                                  event.target.value,
                              },
                            )
                        }
                      >
                        {Object.entries(
                          statusLabels,
                        ).map(
                          ([
                            value,
                            label,
                          ]) => (
                            <option
                              key={value}
                              value={value}
                            >
                              {label}
                            </option>
                          ),
                        )}
                      </select>
                    </label>

                    <label>
                      <span>
                        Proveedor
                      </span>

                      <select
                        value={
                          requirement
                            .assigned_provider_id
                          ?? ""
                        }
                        onChange={
                          (event) =>
                            save(
                              requirement.id,
                              {
                                assignedProviderId:
                                  event.target.value
                                  || null,
                              },
                            )
                        }
                      >
                        <option value="">
                          Sin asignar
                        </option>

                        {compatibleProviders.map(
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

                    <label>
                      <span>
                        Responsable
                      </span>

                      <select
                        value={
                          requirement
                            .responsible_team_member_id
                          ?? ""
                        }
                        onChange={
                          (event) =>
                            save(
                              requirement.id,
                              {
                                responsibleTeamMemberId:
                                  event.target.value
                                  || null,
                              },
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

                    <label>
                      <span>
                        Coste proveedor
                      </span>

                      <input
                        type="number"
                        min="0"
                        defaultValue={
                          Number(
                            requirement
                              .provider_cost
                            ?? 0,
                          )
                        }
                        onBlur={
                          (event) =>
                            save(
                              requirement.id,
                              {
                                providerCost:
                                  Number(
                                    event
                                      .target
                                      .value
                                    || 0,
                                  ),
                              },
                            )
                        }
                      />
                    </label>

                    <label>
                      <span>
                        Precio cliente
                      </span>

                      <input
                        type="number"
                        min="0"
                        defaultValue={
                          Number(
                            requirement
                              .client_price
                            ?? 0,
                          )
                        }
                        onBlur={
                          (event) =>
                            save(
                              requirement.id,
                              {
                                clientPrice:
                                  Number(
                                    event
                                      .target
                                      .value
                                    || 0,
                                  ),
                              },
                            )
                        }
                      />
                    </label>

                    <div
                      className={
                        styles.metric
                      }
                    >
                      <span>
                        Margen
                      </span>

                      <strong>
                        {margin.toLocaleString(
                          "es-ES",
                          {
                            style:
                              "currency",

                            currency:
                              "EUR",
                          },
                        )}
                      </strong>
                    </div>

                    <label
                      className={
                        styles.check
                      }
                    >
                      <input
                        type="checkbox"
                        checked={
                          Boolean(
                            requirement
                              .is_critical,
                          )
                        }
                        onChange={
                          (event) =>
                            save(
                              requirement.id,
                              {
                                isCritical:
                                  event.target.checked,
                              },
                            )
                        }
                      />

                      <span>
                        Servicio crítico
                      </span>
                    </label>

                    <label>
                      <span>
                        Contrato
                      </span>

                      <select
                        value={
                          requirement
                            .contract_status
                          ?? "not_required"
                        }
                        onChange={
                          (event) =>
                            save(
                              requirement.id,
                              {
                                contractStatus:
                                  event.target.value,
                              },
                            )
                        }
                      >
                        <option value="not_required">
                          No requerido
                        </option>

                        <option value="pending">
                          Pendiente
                        </option>

                        <option value="generated">
                          Generado
                        </option>

                        <option value="sent">
                          Enviado
                        </option>

                        <option value="signed">
                          Firmado
                        </option>

                        <option value="cancelled">
                          Cancelado
                        </option>
                      </select>
                    </label>

                    <label>
                      <span>
                        Anticipo requerido
                      </span>

                      <input
                        type="number"
                        min="0"
                        defaultValue={
                          Number(
                            requirement
                              .deposit_required
                            ?? 0,
                          )
                        }
                        onBlur={
                          (event) =>
                            save(
                              requirement.id,
                              {
                                depositRequired:
                                  Number(
                                    event
                                      .target
                                      .value
                                    || 0,
                                  ),
                              },
                            )
                        }
                      />
                    </label>

                    <label>
                      <span>
                        Anticipo pagado
                      </span>

                      <input
                        type="number"
                        min="0"
                        defaultValue={
                          Number(
                            requirement
                              .deposit_paid
                            ?? 0,
                          )
                        }
                        onBlur={
                          (event) =>
                            save(
                              requirement.id,
                              {
                                depositPaid:
                                  Number(
                                    event
                                      .target
                                      .value
                                    || 0,
                                  ),
                              },
                            )
                        }
                      />
                    </label>

                    <label
                      className={
                        styles.full
                      }
                    >
                      <span>
                        Acuerdo comercial
                      </span>

                      <textarea
                        defaultValue={
                          requirement
                            .commercial_terms
                          ?? ""
                        }
                        placeholder="Precio, reserva, saldo, extras, cancelación..."
                        onBlur={
                          (event) =>
                            save(
                              requirement.id,
                              {
                                commercialTerms:
                                  event.target.value
                                  || null,
                              },
                            )
                        }
                      />
                    </label>

                    <label
                      className={
                        styles.full
                      }
                    >
                      <span>
                        Notas operativas
                      </span>

                      <textarea
                        defaultValue={
                          requirement
                            .operational_notes
                          ?? ""
                        }
                        placeholder="Llegada, montaje, acceso, indicaciones..."
                        onBlur={
                          (event) =>
                            save(
                              requirement.id,
                              {
                                operationalNotes:
                                  event.target.value
                                  || null,
                              },
                            )
                        }
                      />
                    </label>
                  </div>
                </div>
              ) : null}
            </article>
          );
        },
      )}
    </div>
  );
}
