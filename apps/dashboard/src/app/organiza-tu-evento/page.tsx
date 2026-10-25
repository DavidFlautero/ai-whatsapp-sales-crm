"use client";

import {
  useMemo,
  useState,
} from "react";

import styles
  from "./request.module.css";

import municipalitiesRaw
  from "../../data/municipios-es.json";

const locations:
  Record<
    string,
    string[]
  > = {
    "Andalucía": [
      "Almería",
      "Cádiz",
      "Córdoba",
      "Granada",
      "Huelva",
      "Jaén",
      "Málaga",
      "Sevilla",
    ],

    "Aragón": [
      "Huesca",
      "Teruel",
      "Zaragoza",
    ],

    "Principado de Asturias": [
      "Asturias",
    ],

    "Illes Balears": [
      "Illes Balears",
    ],

    "Canarias": [
      "Las Palmas",
      "Santa Cruz de Tenerife",
    ],

    "Cantabria": [
      "Cantabria",
    ],

    "Castilla-La Mancha": [
      "Albacete",
      "Ciudad Real",
      "Cuenca",
      "Guadalajara",
      "Toledo",
    ],

    "Castilla y León": [
      "Ávila",
      "Burgos",
      "León",
      "Palencia",
      "Salamanca",
      "Segovia",
      "Soria",
      "Valladolid",
      "Zamora",
    ],

    "Cataluña": [
      "Barcelona",
      "Girona",
      "Lleida",
      "Tarragona",
    ],

    "Comunitat Valenciana": [
      "Alicante",
      "Castellón",
      "Valencia",
    ],

    "Extremadura": [
      "Badajoz",
      "Cáceres",
    ],

    "Galicia": [
      "A Coruña",
      "Lugo",
      "Ourense",
      "Pontevedra",
    ],

    "Comunidad de Madrid": [
      "Madrid",
    ],

    "Región de Murcia": [
      "Murcia",
    ],

    "Comunidad Foral de Navarra": [
      "Navarra",
    ],

    "País Vasco": [
      "Álava",
      "Bizkaia",
      "Gipuzkoa",
    ],

    "La Rioja": [
      "La Rioja",
    ],

    "Ceuta": [
      "Ceuta",
    ],

    "Melilla": [
      "Melilla",
    ],
  };

const eventTypes = [
  {
    id: "wedding",
    label: "Boda",
    description:
      "Desde la ceremonia hasta la celebración completa.",
  },
  {
    id: "birthday",
    label: "Cumpleaños",
    description:
      "Celebraciones privadas y fechas especiales.",
  },
  {
    id: "corporate",
    label: "Empresa",
    description:
      "Eventos corporativos, presentaciones y reuniones.",
  },
  {
    id: "private_party",
    label: "Fiesta privada",
    description:
      "Producción, música, espacio y servicios.",
  },
  {
    id: "venue_rental",
    label: "Alquiler de espacio",
    description:
      "Chalets, fincas y espacios para eventos.",
  },
  {
    id: "venue_purchase",
    label: "Compra de inmueble",
    description:
      "Búsqueda de chalet o inmueble.",
  },
  {
    id: "vehicle",
    label: "Vehículo",
    description:
      "Alquiler de vehículos y transporte.",
  },
  {
    id: "other",
    label: "Otro",
    description:
      "Cuéntanos qué necesitas.",
  },
];

const services = [
  ["venue", "Espacio / chalet"],
  ["catering", "Catering"],
  ["dj", "DJ"],
  ["sound", "Sonido"],
  ["lighting", "Iluminación"],
  ["decoration", "Decoración"],
  ["photo", "Fotografía"],
  ["video", "Vídeo"],
  ["vehicle", "Transporte / vehículos"],
  ["staff", "Personal"],
  ["security", "Seguridad"],
  ["entertainment", "Animación"],
];

type Municipality = {
  municipio_id: string;
  provincia_id: string;
  nombre: string;
};

const municipalities =
  municipalitiesRaw as Municipality[];

type Form = {
  eventType: string;
  serviceMode: string;
  eventDate: string;
  eventStartTime: string;
  eventEndTime: string;
  dateFlexible: boolean;
  alternativeDate: string;
  autonomousCommunity: string;
  province: string;
  municipality: string;
  postalCode: string;
  guestCount: string;
  budgetInitial: string;
  budgetMax: string;
  requestedServices: string[];
  customerName: string;
  whatsapp: string;
  email: string;
  customerMessage: string;

  preferredMunicipalityId: string;

  locationFlexibility:
    ""
    | "exact"
    | "nearby"
    | "province"
    | "advice";

  searchRadiusKm: string;

  alternativeLocations: {
    municipalityId: string;
    name: string;
    province: string;
  }[];

  hasVenue:
    ""
    | "yes"
    | "no";

  existingVenueName: string;
  existingVenueAddress: string;

  budgetScope:
    ""
    | "full_event"
    | "selected_services"
    | "unknown";
};

const initialForm:
  Form = {
    eventType: "",
    serviceMode: "",
    eventDate: "",
    eventStartTime: "",
    eventEndTime: "",
    dateFlexible: false,
    alternativeDate: "",
    autonomousCommunity: "",
    province: "",
    municipality: "",
    postalCode: "",
    guestCount: "",
    budgetInitial: "",
    budgetMax: "",
    requestedServices: [],
    customerName: "",
    whatsapp: "",
    email: "",
    customerMessage: "",

    preferredMunicipalityId: "",
    locationFlexibility: "",
    searchRadiusKm: "",
    alternativeLocations: [],
    hasVenue: "",
    existingVenueName: "",
    existingVenueAddress: "",
    budgetScope: "",
  };

export default function EventRequestPage() {
  const [
    step,
    setStep,
  ] =
    useState(
      1,
    );

  const [
    form,
    setForm,
  ] =
    useState<Form>(
      initialForm,
    );

  const [
    sending,
    setSending,
  ] =
    useState(
      false,
    );

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const [
    completed,
    setCompleted,
  ] =
    useState(
      false,
    );

  const provinces =
    useMemo(
      () =>
        locations[
          form.autonomousCommunity
        ]
        ?? [],
      [
        form.autonomousCommunity,
      ],
    );

  function update<
    K extends keyof Form
  >(
    key: K,
    value: Form[K],
  ) {
    setForm(
      (
        current,
      ) => ({
        ...current,
        [key]:
          value,
      }),
    );
  }

  function toggleService(
    service: string,
  ) {
    setForm(
      (
        current,
      ) => ({
        ...current,

        requestedServices:
          current
            .requestedServices
            .includes(
              service,
            )
            ? current
              .requestedServices
              .filter(
                (
                  item,
                ) =>
                  item
                  !== service,
              )
            : [
              ...current
                .requestedServices,
              service,
            ],
      }),
    );
  }

  async function submit() {
    setSending(
      true,
    );

    setError(
      null,
    );

    try {
      const response =
        await fetch(
          "/api/public/lead-requests",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                customerName:
                  form.customerName,

                whatsapp:
                  form.whatsapp,

                email:
                  form.email
                  || null,

                eventType:
                  form.eventType,

                serviceMode:
                  form.serviceMode
                  || null,

                eventDate:
                  form.eventDate
                  || null,

                eventStartTime:
                  form.eventStartTime
                  || null,

                eventEndTime:
                  form.eventEndTime
                  || null,

                dateFlexible:
                  form.dateFlexible,

                alternativeDate:
                  form.alternativeDate
                  || null,

                autonomousCommunity:
                  form.autonomousCommunity
                  || null,

                province:
                  form.province
                  || null,

                municipality:
                  form.municipality
                  || null,

                postalCode:
                  form.postalCode
                  || null,

                guestCount:
                  form.guestCount
                    ? Number(
                        form.guestCount,
                      )
                    : null,

                budgetInitial:
                  form.budgetInitial
                    ? Number(
                        form.budgetInitial,
                      )
                    : null,

                budgetMax:
                  form.budgetMax
                    ? Number(
                        form.budgetMax,
                      )
                    : null,

                requestedServices:
                  form.requestedServices,

                customerMessage:
                  form.customerMessage
                  || null,

                preferredMunicipalityId:
                  form.preferredMunicipalityId
                  || null,

                locationFlexibility:
                  form.locationFlexibility
                  || null,

                searchRadiusKm:
                  form.searchRadiusKm
                    ? Number(
                        form.searchRadiusKm,
                      )
                    : null,

                alternativeLocations:
                  form.alternativeLocations,

                hasVenue:
                  form.hasVenue
                    ? form.hasVenue
                      === "yes"
                    : null,

                existingVenueName:
                  form.existingVenueName
                  || null,

                existingVenueAddress:
                  form.existingVenueAddress
                  || null,

                budgetScope:
                  form.budgetScope
                  || null,

                source:
                  "web_intake",
              }),
          },
        );

      const body =
        await response
          .json();

      if (
        !response.ok
      ) {
        throw new Error(
          body?.error
          ?? "No se pudo enviar la solicitud.",
        );
      }

      setCompleted(
        true,
      );
    } catch (
      submitError
    ) {
      setError(
        submitError
          instanceof Error
          ? submitError.message
          : "No se pudo enviar la solicitud.",
      );
    } finally {
      setSending(
        false,
      );
    }
  }

  if (
    completed
  ) {
    return (
      <main
        className={
          styles.page
        }
      >
        <section
          className={
            styles.success
          }
        >
          <div
            className={
              styles.brand
            }
          >
            <span
              className={
                styles.brandLogoWrap
              }
            >
              <img
                src="/eventos/login-hero.jpeg"
                alt="Eventos Mediterráneo"
                className={
                  styles.brandLogo
                }
              />
            </span>

            <div
              className={
                styles.brandCopy
              }
            >
              <small>
                GESTIÓN DE EVENTOS
              </small>

              <strong>
                Eventos Mediterráneo
              </strong>
            </div>
          </div>

          <div
            className={
              styles.successIcon
            }
          >
            ✓
          </div>

          <h1>
            Ya tenemos tu solicitud.
          </h1>

          <p>
            Nuestro equipo revisará los datos y preparará
            las siguientes opciones para tu evento.
          </p>

          <div
            className={
              styles.summary
            }
          >
            <div>
              <span>
                Evento
              </span>

              <strong>
                {
                  eventTypes
                    .find(
                      (
                        item,
                      ) =>
                        item.id
                        === form.eventType,
                    )
                    ?.label
                  ?? form.eventType
                }
              </strong>
            </div>

            <div>
              <span>
                Ubicación
              </span>

              <strong>
                {
                  [
                    form.municipality,
                    form.province,
                  ]
                    .filter(
                      Boolean,
                    )
                    .join(
                      ", ",
                    )
                  || "Por definir"
                }
              </strong>
            </div>

            <div>
              <span>
                Presupuesto
              </span>

              <strong>
                {
                  form.budgetInitial
                  || form.budgetMax
                    ? `${form.budgetInitial || "—"} € – ${form.budgetMax || "—"} €`
                    : "Por definir"
                }
              </strong>
            </div>
          </div>

          <a
            href="/espacios"
            className={
              styles.primaryButton
            }
          >
            Ver espacios disponibles
          </a>
        </section>
      </main>
    );
  }

  return (
    <main
      className={
        styles.page
      }
    >
      <header
        className={
          styles.topbar
        }
      >
        <div
            className={
              styles.brand
            }
          >
            <span
              className={
                styles.brandLogoWrap
              }
            >
              <img
                src="/eventos/login-hero.jpeg"
                alt="Eventos Mediterráneo"
                className={
                  styles.brandLogo
                }
              />
            </span>

            <div
              className={
                styles.brandCopy
              }
            >
              <small>
                GESTIÓN DE EVENTOS
              </small>

              <strong>
                Eventos Mediterráneo
              </strong>
            </div>
          </div>

        <div
          className={
            styles.secure
          }
        >
          Solicitud privada
        </div>
      </header>

      <section
        className={
          styles.shell
        }
      >
        <aside
          className={
            styles.intro
          }
        >
          <div
            className={
              styles.eyebrow
            }
          >
            EXPERIENCIAS · PRODUCCIÓN · CELEBRACIONES
          </div>

          <h1>
            Tu evento empieza aquí.
          </h1>

          <p>
            Cuéntanos qué quieres organizar. Nuestro equipo
            analizará la fecha, la ubicación, los servicios
            y tu presupuesto para preparar una propuesta
            adaptada a ti.
          </p>

          <div
            className={
              styles.trustRow
            }
          >
            <span>
              Atención personalizada
            </span>

            <span>
              Proveedores seleccionados
            </span>

            <span>
              Sin compromiso
            </span>
          </div>

          <div
            className={
              styles.steps
            }
          >
            {
              [
                "Tu idea",
                "Fecha y lugar",
                "Servicios",
                "Presupuesto",
                "Contacto",
              ].map(
                (
                  label,
                  index,
                ) => (
                  <div
                    key={
                      label
                    }
                    className={
                      index + 1
                      === step
                        ? styles.stepActive
                        : index + 1
                          < step
                          ? styles.stepDone
                          : styles.step
                    }
                  >
                    <span>
                      {
                        index + 1
                      }
                    </span>

                    {label}
                  </div>
                ),
              )
            }
          </div>
        </aside>

        <section
          className={
            styles.formCard
          }
        >
          <div
            className={
              styles.progress
            }
          >
            <div
              style={{
                width:
                  `${step * 20}%`,
              }}
            />
          </div>

          {
            step === 1
              ? (
                <>
                  <div
                    className={
                      styles.stepKicker
                    }
                  >
                    PASO 01
                  </div>

                  <h2>
                    ¿Qué tienes en mente?
                  </h2>

                  <p
                    className={
                      styles.helper
                    }
                  >
                    Elige el tipo de experiencia. Después
                    afinaremos contigo los detalles.
                  </p>

                  <div
                    className={
                      styles.optionGrid
                    }
                  >
                    {
                      eventTypes.map(
                        (
                          item,
                        ) => (
                          <button
                            key={
                              item.id
                            }
                            type="button"
                            className={
                              form.eventType
                              === item.id
                                ? styles.optionSelected
                                : styles.option
                            }
                            onClick={
                              () =>
                                update(
                                  "eventType",
                                  item.id,
                                )
                            }
                          >
                            <strong>
                              {
                                item.label
                              }
                            </strong>

                            <span>
                              {
                                item.description
                              }
                            </span>
                          </button>
                        ),
                      )
                    }
                  </div>

                  <div
                    className={
                      styles.field
                    }
                  >
                    <label>
                      ¿Qué nivel de servicio buscas?
                    </label>

                    <select
                      value={
                        form.serviceMode
                      }
                      onChange={
                        (
                          event,
                        ) =>
                          update(
                            "serviceMode",
                            event.target.value,
                          )
                      }
                    >
                      <option value="">
                        Seleccionar
                      </option>

                      <option value="complete">
                        Evento completo
                      </option>

                      <option value="venue_plus">
                        Espacio + algunos servicios
                      </option>

                      <option value="venue_only">
                        Solo espacio
                      </option>

                      <option value="individual">
                        Servicios individuales
                      </option>

                      <option value="advice">
                        Quiero asesoramiento
                      </option>
                    </select>
                  </div>
                </>
              )
              : null
          }

          {
            step === 2
              ? (
                <>
                  <h2>
                    Fecha y ubicación
                  </h2>

                  <div
                    className={
                      styles.twoColumns
                    }
                  >
                    <div
                      className={
                        styles.field
                      }
                    >
                      <label>
                        Fecha deseada
                      </label>

                      <input
                        type="date"
                        value={
                          form.eventDate
                        }
                        onChange={
                          (
                            event,
                          ) =>
                            update(
                              "eventDate",
                              event.target.value,
                            )
                        }
                      />
                    </div>

                    <div
                      className={
                        styles.field
                      }
                    >
                      <label>
                        Fecha alternativa
                      </label>

                <div
                  className={
                    styles.twoColumns
                  }
                >
                  <label
                    className={
                      styles.field
                    }
                  >
                    <span>
                      Hora de entrada / inicio
                    </span>

                    <input
                      type="time"
                      value={
                        form.eventStartTime
                      }
                      onChange={
                        (event) =>
                          update(
                            "eventStartTime",
                            event.target.value,
                          )
                      }
                    />

                    <small>
                      ¿A qué hora comienza el evento o necesitas tener acceso al espacio?
                    </small>
                  </label>

                  <label
                    className={
                      styles.field
                    }
                  >
                    <span>
                      Hora de salida / entrega
                    </span>

                    <input
                      type="time"
                      value={
                        form.eventEndTime
                      }
                      onChange={
                        (event) =>
                          update(
                            "eventEndTime",
                            event.target.value,
                          )
                      }
                    />

                    <small>
                      ¿A qué hora termina el evento y se entrega o libera el espacio?
                    </small>
                  </label>
                </div>

                      <input
                        type="date"
                        value={
                          form.alternativeDate
                        }
                        onChange={
                          (
                            event,
                          ) =>
                            update(
                              "alternativeDate",
                              event.target.value,
                            )
                        }
                      />
                    </div>
                  </div>

                  <label
                    className={
                      styles.checkbox
                    }
                  >
                    <input
                      type="checkbox"
                      checked={
                        form.dateFlexible
                      }
                      onChange={
                        (
                          event,
                        ) =>
                          update(
                            "dateFlexible",
                            event.target.checked,
                          )
                      }
                    />

                    Tengo flexibilidad con la fecha
                  </label>

                  <div
                    className={
                      styles.field
                    }
                  >
                    <label>
                      Comunidad autónoma
                    </label>

                    <select
                      value={
                        form.autonomousCommunity
                      }
                      onChange={
                        (
                          event,
                        ) => {
                          update(
                            "autonomousCommunity",
                            event.target.value,
                          );

                          update(
                            "province",
                            "",
                          );
                        }
                      }
                    >
                      <option value="">
                        Seleccionar
                      </option>

                      {
                        Object
                          .keys(
                            locations,
                          )
                          .map(
                            (
                              community,
                            ) => (
                              <option
                                key={
                                  community
                                }
                                value={
                                  community
                                }
                              >
                                {
                                  community
                                }
                              </option>
                            ),
                          )
                      }
                    </select>
                  </div>

                  <div
                    className={
                      styles.twoColumns
                    }
                  >
                    <div
                      className={
                        styles.field
                      }
                    >
                      <label>
                        Provincia
                      </label>

                      <select
                        disabled={
                          provinces.length
                          === 0
                        }
                        value={
                          form.province
                        }
                        onChange={
                          (
                            event,
                          ) =>
                            update(
                              "province",
                              event.target.value,
                            )
                        }
                      >
                        <option value="">
                          Seleccionar
                        </option>

                        {
                          provinces.map(
                            (
                              province,
                            ) => (
                              <option
                                key={
                                  province
                                }
                              >
                                {
                                  province
                                }
                              </option>
                            ),
                          )
                        }
                      </select>
                    </div>

                    <div
                      className={
                        styles.field
                      }
                    >
                      <label>
                        Municipio / localidad
                      </label>

                      <input
                        list="municipios-es"
                        placeholder="Empieza a escribir, por ejemplo: Cullera"
                        value={
                          form.municipality
                        }
                        onChange={
                          (
                            event,
                          ) => {
                            const value =
                              event.target.value;

                            const match =
                              municipalities.find(
                                (
                                  item,
                                ) =>
                                  item.nombre
                                    .toLocaleLowerCase(
                                      "es",
                                    )
                                  === value
                                    .toLocaleLowerCase(
                                      "es",
                                    ),
                              );

                            update(
                              "municipality",
                              value,
                            );

                            update(
                              "preferredMunicipalityId",
                              match
                                ?.municipio_id
                              ?? "",
                            );
                          }
                        }
                      />

                      <datalist
                        id="municipios-es"
                      >
                        {
                          municipalities.map(
                            (
                              municipality,
                            ) => (
                              <option
                                key={
                                  municipality
                                    .municipio_id
                                }
                                value={
                                  municipality.nombre
                                }
                              />
                            ),
                          )
                        }
                      </datalist>
                    </div>
                  </div>

                  <div
                    className={
                      styles.twoColumns
                    }
                  >
                    <div
                      className={
                        styles.field
                      }
                    >
                      <label>
                        Código postal
                      </label>

                      <input
                        value={
                          form.postalCode
                        }
                        placeholder="46001"
                        onChange={
                          (
                            event,
                          ) =>
                            update(
                              "postalCode",
                              event.target.value,
                            )
                        }
                      />
                    </div>

                    <div
                      className={
                        styles.field
                      }
                    >
                      <label>
                        Número aproximado de invitados
                      </label>

                      <input
                        type="number"
                        min="0"
                        value={
                          form.guestCount
                        }
                        onChange={
                          (
                            event,
                          ) =>
                            update(
                              "guestCount",
                              event.target.value,
                            )
                        }
                      />
                    </div>
                  </div>

                  <div
                    className={
                      styles.locationPreference
                    }
                  >
                    <h3>
                      ¿Qué pasa si no encontramos una opción adecuada exactamente ahí?
                    </h3>

                    <p>
                      Indícanos cuánto podemos ampliar la búsqueda.
                    </p>

                    <div
                      className={
                        styles.choiceGrid
                      }
                    >
                      {
                        [
                          [
                            "exact",
                            "Solo ahí",
                            "La ubicación es imprescindible.",
                          ],

                          [
                            "nearby",
                            "Sí, cerca",
                            "Podemos buscar en municipios cercanos.",
                          ],

                          [
                            "province",
                            "Toda la provincia",
                            "Tenemos flexibilidad dentro de la provincia.",
                          ],

                          [
                            "advice",
                            "Quiero asesoramiento",
                            "Recomendadme las zonas más adecuadas.",
                          ],
                        ].map(
                          (
                            [
                              id,
                              title,
                              description,
                            ],
                          ) => (
                            <button
                              key={
                                id
                              }
                              type="button"
                              className={
                                form.locationFlexibility
                                === id
                                  ? styles.choiceSelected
                                  : styles.choice
                              }
                              onClick={
                                () =>
                                  update(
                                    "locationFlexibility",
                                    id as Form["locationFlexibility"],
                                  )
                              }
                            >
                              <strong>
                                {title}
                              </strong>

                              <span>
                                {
                                  description
                                }
                              </span>
                            </button>
                          ),
                        )
                      }
                    </div>
                  </div>

                  {
                    form.locationFlexibility
                    === "nearby"
                      ? (
                        <div
                          className={
                            styles.field
                          }
                        >
                          <label>
                            ¿Hasta qué distancia podemos buscar?
                          </label>

                          <div
                            className={
                              styles.radiusGrid
                            }
                          >
                            {
                              [
                                10,
                                25,
                                50,
                                100,
                              ].map(
                                (
                                  km,
                                ) => (
                                  <button
                                    key={
                                      km
                                    }
                                    type="button"
                                    className={
                                      form.searchRadiusKm
                                      === String(
                                        km,
                                      )
                                        ? styles.radiusSelected
                                        : styles.radius
                                    }
                                    onClick={
                                      () =>
                                        update(
                                          "searchRadiusKm",
                                          String(
                                            km,
                                          ),
                                        )
                                    }
                                  >
                                    {km} km
                                  </button>
                                ),
                              )
                            }
                          </div>
                        </div>
                      )
                      : null
                  }
                </>
              )
              : null
          }

          {
            step === 3
              ? (
                <>
                  <h2>
                    ¿Qué necesitas?
                  </h2>

                  <div
                    className={
                      styles.venueQuestion
                    }
                  >
                    <h3>
                      ¿Ya tienes reservado el lugar?
                    </h3>

                    <div
                      className={
                        styles.choiceGrid
                      }
                    >
                      <button
                        type="button"
                        className={
                          form.hasVenue
                          === "no"
                            ? styles.choiceSelected
                            : styles.choice
                        }
                        onClick={
                          () =>
                            update(
                              "hasVenue",
                              "no",
                            )
                        }
                      >
                        <strong>
                          No
                        </strong>

                        <span>
                          Necesito que me ayudéis a encontrar un espacio.
                        </span>
                      </button>

                      <button
                        type="button"
                        className={
                          form.hasVenue
                          === "yes"
                            ? styles.choiceSelected
                            : styles.choice
                        }
                        onClick={
                          () =>
                            update(
                              "hasVenue",
                              "yes",
                            )
                        }
                      >
                        <strong>
                          Sí
                        </strong>

                        <span>
                          Ya tengo el lugar y necesito otros servicios.
                        </span>
                      </button>
                    </div>
                  </div>

                  {
                    form.hasVenue
                    === "yes"
                      ? (
                        <div
                          className={
                            styles.twoColumns
                          }
                        >
                          <div
                            className={
                              styles.field
                            }
                          >
                            <label>
                              Nombre del lugar
                            </label>

                            <input
                              value={
                                form.existingVenueName
                              }
                              onChange={
                                (
                                  event,
                                ) =>
                                  update(
                                    "existingVenueName",
                                    event.target.value,
                                  )
                              }
                            />
                          </div>

                          <div
                            className={
                              styles.field
                            }
                          >
                            <label>
                              Dirección o zona
                            </label>

                            <input
                              value={
                                form.existingVenueAddress
                              }
                              onChange={
                                (
                                  event,
                                ) =>
                                  update(
                                    "existingVenueAddress",
                                    event.target.value,
                                  )
                              }
                            />
                          </div>
                        </div>
                      )
                      : null
                  }

                  <p
                    className={
                      styles.helper
                    }
                  >
                    Puedes seleccionar varios servicios.
                  </p>

                  <div
                    className={
                      styles.serviceGrid
                    }
                  >
                    {
                      services.map(
                        (
                          [
                            id,
                            label,
                          ],
                        ) => (
                          <button
                            key={
                              id
                            }
                            type="button"
                            className={
                              form
                                .requestedServices
                                .includes(
                                  id,
                                )
                                ? styles.serviceSelected
                                : styles.service
                            }
                            onClick={
                              () =>
                                toggleService(
                                  id,
                                )
                            }
                          >
                            <span>
                              {
                                form
                                  .requestedServices
                                  .includes(
                                    id,
                                  )
                                  ? "✓"
                                  : "+"
                              }
                            </span>

                            {label}
                          </button>
                        ),
                      )
                    }
                  </div>

                  <div
                    className={
                      styles.field
                    }
                  >
                    <label>
                      Cuéntanos tu idea
                    </label>

                    <textarea
                      rows={
                        7
                      }
                      placeholder="Por ejemplo: queremos una boda para unas 100 personas, preferimos un espacio con jardín y nos gustaría hacer la ceremonia y la fiesta en el mismo lugar..."
                      value={
                        form.customerMessage
                      }
                      onChange={
                        (
                          event,
                        ) =>
                          update(
                            "customerMessage",
                            event.target.value,
                          )
                      }
                    />
                  </div>
                </>
              )
              : null
          }

          {
            step === 4
              ? (
                <>
                  <h2>
                    Presupuesto
                  </h2>

                  <p
                    className={
                      styles.helper
                    }
                  >
                    Esto nos ayuda a preparar opciones realistas.
                    No te compromete a ningún importe.
                  </p>

                  <div
                    className={
                      styles.budgetGrid
                    }
                  >
                    <div
                      className={
                        styles.budgetBox
                      }
                    >
                      <label>
                        Presupuesto inicial
                      </label>

                      <div
                        className={
                          styles.moneyInput
                        }
                      >
                        <input
                          type="number"
                          min="0"
                          placeholder="2500"
                          value={
                            form.budgetInitial
                          }
                          onChange={
                            (
                              event,
                            ) =>
                              update(
                                "budgetInitial",
                                event.target.value,
                              )
                          }
                        />

                        <span>
                          €
                        </span>
                      </div>

                      <small>
                        La cifra con la que te gustaría empezar.
                      </small>
                    </div>

                    <div
                      className={
                        styles.budgetBox
                      }
                    >
                      <label>
                        ¿Hasta dónde podrías llegar?
                      </label>

                      <div
                        className={
                          styles.moneyInput
                        }
                      >
                        <input
                          type="number"
                          min="0"
                          placeholder="4000"
                          value={
                            form.budgetMax
                          }
                          onChange={
                            (
                              event,
                            ) =>
                              update(
                                "budgetMax",
                                event.target.value,
                              )
                          }
                        />

                        <span>
                          €
                        </span>
                      </div>

                      <small>
                        Máximo aproximado si la propuesta lo justifica.
                      </small>
                    </div>
                  </div>

                  <div
                    className={
                      styles.field
                    }
                  >
                    <label>
                      ¿A qué corresponde este presupuesto?
                    </label>

                    <select
                      value={
                        form.budgetScope
                      }
                      onChange={
                        (
                          event,
                        ) =>
                          update(
                            "budgetScope",
                            event.target.value as Form["budgetScope"],
                          )
                      }
                    >
                      <option value="">
                        Seleccionar
                      </option>

                      <option value="full_event">
                        A todo el evento
                      </option>

                      <option value="selected_services">
                        Solo a los servicios seleccionados
                      </option>

                      <option value="unknown">
                        Todavía no lo tengo claro
                      </option>
                    </select>
                  </div>
                </>
              )
              : null
          }

          {
            step === 5
              ? (
                <>
                  <h2>
                    ¿Cómo podemos contactarte?
                  </h2>

                  <div
                    className={
                      styles.field
                    }
                  >
                    <label>
                      Nombre y apellidos
                    </label>

                    <input
                      value={
                        form.customerName
                      }
                      onChange={
                        (
                          event,
                        ) =>
                          update(
                            "customerName",
                            event.target.value,
                          )
                      }
                    />
                  </div>

                  <div
                    className={
                      styles.twoColumns
                    }
                  >
                    <div
                      className={
                        styles.field
                      }
                    >
                      <label>
                        WhatsApp
                      </label>

                      <input
                        type="tel"
                        placeholder="+34 600 000 000"
                        value={
                          form.whatsapp
                        }
                        onChange={
                          (
                            event,
                          ) =>
                            update(
                              "whatsapp",
                              event.target.value,
                            )
                        }
                      />
                    </div>

                    <div
                      className={
                        styles.field
                      }
                    >
                      <label>
                        Email
                      </label>

                      <input
                        type="email"
                        value={
                          form.email
                        }
                        onChange={
                          (
                            event,
                          ) =>
                            update(
                              "email",
                              event.target.value,
                            )
                        }
                      />
                    </div>
                  </div>

                  <div
                    className={
                      styles.review
                    }
                  >
                    <strong>
                      Antes de enviar
                    </strong>

                    <p>
                      Nuestro equipo revisará tu solicitud de forma
                      personalizada. No realizamos reservas ni cargos
                      automáticamente desde este formulario.
                    </p>
                  </div>
                </>
              )
              : null
          }

          {
            error
              ? (
                <div
                  className={
                    styles.error
                  }
                >
                  {error}
                </div>
              )
              : null
          }

          <footer
            className={
              styles.actions
            }
          >
            <button
              type="button"
              className={
                styles.secondaryButton
              }
              disabled={
                step === 1
              }
              onClick={
                () =>
                  setStep(
                    (
                      current,
                    ) =>
                      Math.max(
                        1,
                        current - 1,
                      ),
                  )
              }
            >
              Atrás
            </button>

            {
              step < 5
                ? (
                  <button
                    type="button"
                    className={
                      styles.primaryButton
                    }
                    onClick={
                      () =>
                        setStep(
                          (
                            current,
                          ) =>
                            Math.min(
                              5,
                              current + 1,
                            ),
                        )
                    }
                  >
                    Continuar
                  </button>
                )
                : (
                  <button
                    type="button"
                    className={
                      styles.primaryButton
                    }
                    disabled={
                      sending
                      || !form.customerName
                      || !form.whatsapp
                      || !form.eventType
                    }
                    onClick={
                      () =>
                        void submit()
                    }
                  >
                    {
                      sending
                        ? "Enviando…"
                        : "Enviar solicitud"
                    }
                  </button>
                )
            }
          </footer>
        </section>
      </section>
    </main>
  );
}
