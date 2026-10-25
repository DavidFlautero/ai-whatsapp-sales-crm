"use client";

import VenueCalendar from "./VenueCalendar";

import Link
  from "next/link";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

type Provider = {
  id: string;
  name: string;
};

type VenueImage = {
  id: string;
  role?: string | null;
  public_url?: string | null;
  url?: string | null;
  sort_order?: number | null;
  ai_score?: number | string | null;
  ai_reason?: string | null;
  ai_category?: string | null;
};

type VenueVideo = {
  id: string;
  url: string;
  mime_type?: string | null;
  size_bytes?: number | null;
};

type RuleDefinition = {
  id: string;
  rule_key: string;
  label: string;
  category: string;
  value_type: string;
  sort_order: number;
};

type Venue = {
  id: string;
  provider_id: string;
  name: string;
  slug: string;
  status: string;
  description?: string | null;
  province?: string | null;
  city?: string | null;
  address?: string | null;
  public_location?: string | null;
  capacity_min?: number | null;
  capacity_max?: number | null;
  cost_from?: number | string | null;
  client_price_from?: number | string | null;
  currency?: string | null;
  features?: string[];
  included_services?: string[];
  suitable_for?: string[];

  rental_modes?: string[];
  event_types_allowed?: string[];

  events_allowed?: boolean;
  parties_allowed?: boolean;

  max_event_guests?: number | null;
  max_sleeping_guests?: number | null;

  default_start_time?: string | null;
  default_end_time?: string | null;
  music_end_time?: string | null;

  latitude?: number | string | null;
  longitude?: number | string | null;

  deposit?: number | string | null;
  cleaning_fee?: number | string | null;

  venue_rules?: Record<
    string,
    string | number | boolean | null
  >;

  public_notes?: string | null;
  internal_notes?: string | null;
};

type FormState = {
  providerId: string;
  name: string;
  slug: string;
  description: string;
  province: string;
  city: string;
  address: string;
  publicLocation: string;
  capacityMin: string;
  capacityMax: string;
  costFrom: string;
  clientPriceFrom: string;
  features: string;
  includedServices: string;
  suitableFor: string;

  rentalModes: string;
  eventTypesAllowed: string;

  eventsAllowed: boolean;
  partiesAllowed: boolean;

  maxEventGuests: string;
  maxSleepingGuests: string;

  defaultStartTime: string;
  defaultEndTime: string;
  musicEndTime: string;

  latitude: string;
  longitude: string;

  deposit: string;
  cleaningFee: string;

  rulesText: string;

  publicNotes: string;
  internalNotes: string;
  status:
    "draft"
    | "published"
    | "archived";
};

const emptyForm:
  FormState = {
    providerId: "",
    name: "",
    slug: "",
    description: "",
    province: "Valencia",
    city: "",
    address: "",
    publicLocation: "",
    capacityMin: "",
    capacityMax: "",
    costFrom: "0",
    clientPriceFrom: "0",
    features: "",
    includedServices: "",
    suitableFor: "",

    rentalModes: "day",
    eventTypesAllowed: "",

    eventsAllowed: true,
    partiesAllowed: true,

    maxEventGuests: "",
    maxSleepingGuests: "",

    defaultStartTime: "",
    defaultEndTime: "",
    musicEndTime: "",

    latitude: "",
    longitude: "",

    deposit: "0",
    cleaningFee: "0",

    rulesText: "",

    publicNotes: "",
    internalNotes: "",
    status: "draft",
  };

function csv(
  value: string,
) {
  return value
    .split(",")
    .map(
      (
        item,
      ) =>
        item.trim(),
    )
    .filter(
      Boolean,
    );
}

function fromVenue(
  venue: Venue,
): FormState {
  return {
    providerId:
      venue.provider_id
      ?? "",

    name:
      venue.name
      ?? "",

    slug:
      venue.slug
      ?? "",

    description:
      venue.description
      ?? "",

    province:
      venue.province
      ?? "",

    city:
      venue.city
      ?? "",

    address:
      venue.address
      ?? "",

    publicLocation:
      venue.public_location
      ?? "",

    capacityMin:
      venue.capacity_min
        == null
        ? ""
        : String(
            venue.capacity_min,
          ),

    capacityMax:
      venue.capacity_max
        == null
        ? ""
        : String(
            venue.capacity_max,
          ),

    costFrom:
      String(
        venue.cost_from
        ?? 0,
      ),

    clientPriceFrom:
      String(
        venue.client_price_from
        ?? 0,
      ),

    features:
      (
        venue.features
        ?? []
      ).join(
        ", ",
      ),

    includedServices:
      (
        venue.included_services
        ?? []
      ).join(
        ", ",
      ),

    suitableFor:
      (
        venue.suitable_for
        ?? []
      ).join(
        ", ",
      ),

    rentalModes:

      (

        venue.rental_modes

        ?? []

      ).join(

        ",",

      ),


    eventTypesAllowed:

      (

        venue.event_types_allowed

        ?? []

      ).join(

        ", ",

      ),


    eventsAllowed:

      venue.events_allowed

      ?? true,


    partiesAllowed:

      venue.parties_allowed

      ?? true,


    maxEventGuests:

      venue.max_event_guests

        == null

        ? ""

        : String(

            venue.max_event_guests,

          ),


    maxSleepingGuests:

      venue.max_sleeping_guests

        == null

        ? ""

        : String(

            venue.max_sleeping_guests,

          ),


    defaultStartTime:

      venue.default_start_time

        ?.slice(

          0,

          5,

        )

      ?? "",


    defaultEndTime:

      venue.default_end_time

        ?.slice(

          0,

          5,

        )

      ?? "",


    musicEndTime:

      venue.music_end_time

        ?.slice(

          0,

          5,

        )

      ?? "",


    latitude:

      venue.latitude

        == null

        ? ""

        : String(

            venue.latitude,

          ),


    longitude:

      venue.longitude

        == null

        ? ""

        : String(

            venue.longitude,

          ),


    deposit:

      String(

        venue.deposit

        ?? 0,

      ),


    cleaningFee:

      String(

        venue.cleaning_fee

        ?? 0,

      ),


    rulesText:

      Object.entries(

        venue.venue_rules

        ?? {},

      )

        .map(

          (

            [

              key,

              value,

            ],

          ) =>

            `${key}=${String(

              value,

            )}`,

        )

        .join(

          "\\n",

        ),


    publicNotes:
      venue.public_notes
      ?? "",

    internalNotes:
      venue.internal_notes
      ?? "",

    status:
      (
        venue.status
        ?? "draft"
      ) as FormState["status"],
  };
}

function parseRules(
  value: string,
) {
  const result:
    Record<
      string,
      string | number | boolean | null
    > = {};

  value
    .split("\n")
    .map(
      (
        line,
      ) =>
        line.trim(),
    )
    .filter(
      Boolean,
    )
    .forEach(
      (
        line,
      ) => {
        const index =
          line.indexOf(
            "=",
          );

        if (
          index
          <= 0
        ) {
          return;
        }

        const key =
          line
            .slice(
              0,
              index,
            )
            .trim();

        const raw =
          line
            .slice(
              index
              + 1,
            )
            .trim();

        if (!key) {
          return;
        }

        if (
          raw
          === "true"
        ) {
          result[key] =
            true;
        } else if (
          raw
          === "false"
        ) {
          result[key] =
            false;
        } else if (
          raw !== ""
          && !Number.isNaN(
            Number(
              raw,
            ),
          )
        ) {
          result[key] =
            Number(
              raw,
            );
        } else {
          result[key] =
            raw;
        }
      },
    );

  return result;
}


const fieldStyle = {
  width: "100%",
  minHeight: 42,
  padding: "9px 11px",
  border: "1px solid #d8d8d2",
  borderRadius: 8,
  background: "#fff",
} as const;

export default function CRMSpacesPage() {
  const [
    editingVenueRules,
    setEditingVenueRules,
  ] = useState(false);

  const [
    venues,
    setVenues,
  ] =
    useState<Venue[]>(
      [],
    );

  const [
    providers,
    setProviders,
  ] =
    useState<
      Provider[]
    >(
      [],
    );

  const [
    selected,
    setSelected,
  ] =
    useState<
      Venue | null
    >(
      null,
    );

  const [
    form,
    setForm,
  ] =
    useState<FormState>(
      emptyForm,
    );

  const [
    images,
    setImages,
  ] =
    useState<
      VenueImage[]
    >(
      [],
    );

  const [
    video,
    setVideo,
  ] =
    useState<
      VenueVideo | null
    >(
      null,
    );

  const [
    mediaUploading,
    setMediaUploading,
  ] =
    useState(
      false,
    );

  const [
    mediaProgress,
    setMediaProgress,
  ] =
    useState(
      "",
    );

  const [
    aiOrdering,
    setAiOrdering,
  ] =
    useState(
      false,
    );

  const [
    smartSearch,
    setSmartSearch,
  ] =
    useState(
      "",
    );

  const [
    onlyParties,
    setOnlyParties,
  ] =
    useState(
      false,
    );


  const [
    saving,
    setSaving,
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

  const load =
    useCallback(
      async () => {
        const [
          venueResponse,
          providerResponse,
        ] =
          await Promise.all([
            fetch(
              "/api/crm/venues",
            ),

            fetch(
              "/api/crm/providers",
            ),
          ]);

        const venueBody =
          await venueResponse
            .json();

        const providerBody =
          await providerResponse
            .json();

        if (
          !venueResponse.ok
          || !providerResponse.ok
        ) {
          throw new Error(
            "No se pudo cargar la gestión de espacios.",
          );
        }

        setVenues(
          venueBody.venues
          ?? [],
        );

        setProviders(
          providerBody.providers
          ?? [],
        );
      },
      [],
    );

  useEffect(
    () => {
      void load()
        .catch(
          (
            loadError,
          ) => {
            setError(
              loadError
                instanceof Error
                ? loadError.message
                : "Error cargando espacios.",
            );
          },
        );
    },
    [
      load,
    ],
  );

  const filteredVenues =
    venues.filter(
      (
        venue,
      ) => {
        const query =
          smartSearch
            .trim()
            .toLowerCase();

        if (
          onlyParties
          && venue.parties_allowed
          === false
        ) {
          return false;
        }

        if (!query) {
          return true;
        }

        const haystack = [
          venue.name,
          venue.city,
          venue.province,
          venue.public_location,
          venue.description,
          ...(venue.features
            ?? []),
          ...(venue.suitable_for
            ?? []),
          ...(venue.event_types_allowed
            ?? []),
          ...(venue.rental_modes
            ?? []),
        ]
          .filter(
            Boolean,
          )
          .join(
            " ",
          )
          .toLowerCase();

        const words =
          query
            .split(
              /\s+/,
            )
            .filter(
              (
                word,
              ) =>
                word.length
                > 1,
            );

        const number =
          query.match(
            /\b(\d{2,4})\b/,
          );

        if (
          number
          && query.match(
            /persona|personas|invitado|invitados/,
          )
        ) {
          const guests =
            Number(
              number[1],
            );

          const max =
            venue.max_event_guests
            ?? venue.capacity_max
            ?? 0;

          if (
            max
            && max
            < guests
          ) {
            return false;
          }
        }

        if (
          (
            query.includes(
              "fiesta",
            )
            || query.includes(
              "boda",
            )
            || query.includes(
              "cumple",
            )
          )
          && (
            venue.events_allowed
            === false
            || venue.parties_allowed
            === false
          )
        ) {
          return false;
        }

        return words.every(
          (
            word,
          ) => {
            if (
              word
              === "con"
              || word
              === "para"
              || word
              === "de"
              || word
              === "un"
              || word
              === "una"
              || /^\d+$/.test(
                word,
              )
            ) {
              return true;
            }

            if (
              word.startsWith(
                "boda",
              )
            ) {
              return (
                haystack.includes(
                  "boda",
                )
                || haystack.includes(
                  "wedding",
                )
              );
            }

            if (
              word.startsWith(
                "pisc",
              )
            ) {
              return haystack.includes(
                "pisc",
              );
            }

            return haystack.includes(
              word,
            );
          },
        );
      },
    );


  async function openVenue(
    venue: Venue,
  ) {
    setError(
      null,
    );

    const response =
      await fetch(
        `/api/crm/venues/${venue.id}`,
      );

    const body =
      await response
        .json();

    if (
      !response.ok
    ) {
      throw new Error(
        body?.error
        ?? "No se pudo abrir el espacio.",
      );
    }

    setSelected(
      body.venue,
    );

    setForm(
      fromVenue(
        body.venue,
      ),
    );

    setImages(
      body.images
      ?? [],
    );
  }

  function startNew() {
    setSelected(
      null,
    );

    setImages(
      [],
    );

    setForm({
      ...emptyForm,

      providerId:
        providers[0]?.id
        ?? "",
    });
  }


  function updateRule(
    key: string,
    value:
      | boolean
      | string
      | number
      | null,
  ) {
    const current =
      parseRules(
        form.rulesText,
      );

    current[key] =
      value;

    const rulesText =
      Object.entries(
        current,
      )
        .filter(
          (
            [
              ,
              item,
            ],
          ) =>
            item !== null,
        )
        .map(
          (
            [
              ruleKey,
              item,
            ],
          ) =>
            `${ruleKey}=${String(
              item,
            )}`,
        )
        .join(
          "\n",
        );

    setForm(
      (
        previous,
      ) => ({
        ...previous,
        rulesText,
      }),
    );
  }


  function ruleValue(
    key: string,
  ) {
    return parseRules(
      form.rulesText,
    )[key];
  }


  async function uploadManyImages(
    files: File[],
  ) {
    if (!selected) {
      setError(
        "No hay un espacio seleccionado.",
      );

      setMediaProgress(
        "ERROR: espacio no seleccionado",
      );

      return;
    }

    if (!files.length) {
      setError(
        "No se recibió ninguna foto.",
      );

      setMediaProgress(
        "ERROR: 0 fotos recibidas",
      );

      return;
    }

    if (!files.length) {
      return;
    }

    const available =
      60
      - images.length;

    if (
      files.length
      > available
    ) {
      setError(
        `Este espacio admite máximo 60 imágenes. Ya hay ${images.length}; podés agregar ${available}.`,
      );

      return;
    }

    setError(
      null,
    );

    setMediaUploading(
      true,
    );

    try {
      /*
       * El usuario selecciona las 60 juntas.
       * Internamente mandamos grupos de 8 para no
       * cargar cientos de MB en memoria de Node.
       */
      const batches:
        File[][] = [];

      for (
        let index = 0;
        index < files.length;
        index += 8
      ) {
        batches.push(
          files.slice(
            index,
            index + 8,
          ),
        );
      }

      let uploaded =
        0;

      for (
        const batch of batches
      ) {
        const data =
          new FormData();

        data.append(
          "role",
          "gallery",
        );

        batch.forEach(
          (
            file,
          ) => {
            data.append(
              "files",
              file,
            );
          },
        );

        setMediaProgress(
          `Preparando ${batch.length} fotos...`,
        );

        console.log(
          "[VENUE UPLOAD CLIENT]",
          {
            venueId: selected.id,
            files: batch.length,
            total: files.length,
          },
        );

        setMediaProgress(
          `Enviando ${uploaded + 1}-${Math.min(
            uploaded
            + batch.length,
            files.length,
          )} de ${files.length} al servidor...`,
        );

        const response =
          await fetch(
            `/api/crm/venues/${selected.id}/images`,
            {
              method:
                "POST",

              body:
                data,
            },
          );

        const body =
          await response
            .json();

        if (!response.ok) {
          throw new Error(
            body?.error
            ?? "No se pudieron subir las imágenes.",
          );
        }

        uploaded +=
          batch.length;
      }

      setMediaProgress(
        "Actualizando galería…",
      );

      await openVenue(
        selected,
      );

      setMediaProgress(
        `${files.length} imágenes cargadas`,
      );
    } catch (
      uploadError
    ) {
      setError(
        uploadError
          instanceof Error
          ? uploadError.message
          : "Error subiendo imágenes.",
      );
    } finally {
      setMediaUploading(
        false,
      );
    }
  }


  async function uploadVideo(
    file:
      File | null,
  ) {
    if (
      !selected
      || !file
    ) {
      return;
    }

    if (video) {
      setError(
        "Este espacio ya tiene un vídeo. Eliminá el actual antes de cargar otro.",
      );

      return;
    }

    setError(
      null,
    );

    setMediaUploading(
      true,
    );

    setMediaProgress(
      "Subiendo vídeo…",
    );

    try {
      const data =
        new FormData();

      data.append(
        "file",
        file,
      );

      const response =
        await fetch(
          `/api/crm/venues/${selected.id}/video`,
          {
            method:
              "POST",

            body:
              data,
          },
        );

      const body =
        await response
          .json();

      if (!response.ok) {
        throw new Error(
          body?.error
          ?? "No se pudo subir el vídeo.",
        );
      }

      setVideo(
        body.video,
      );

      setMediaProgress(
        "Vídeo cargado",
      );
    } catch (
      uploadError
    ) {
      setError(
        uploadError
          instanceof Error
          ? uploadError.message
          : "Error subiendo vídeo.",
      );
    } finally {
      setMediaUploading(
        false,
      );
    }
  }


  async function deleteVideo() {
    if (
      !selected
      || !video
    ) {
      return;
    }

    const response =
      await fetch(
        `/api/crm/venues/${selected.id}/video`,
        {
          method:
            "DELETE",
        },
      );

    const body =
      await response
        .json();

    if (!response.ok) {
      setError(
        body?.error
        ?? "No se pudo eliminar el vídeo.",
      );

      return;
    }

    setVideo(
      null,
    );
  }


  async function orderImagesWithAi() {
    if (
      !selected
      || images.length < 2
    ) {
      return;
    }

    setAiOrdering(
      true,
    );

    setError(
      null,
    );

    try {
      const response =
        await fetch(
          `/api/crm/venues/${selected.id}/images/ai-order`,
          {
            method:
              "POST",
          },
        );

      const body =
        await response
          .json();

      if (!response.ok) {
        throw new Error(
          body?.error
          ?? "No se pudieron ordenar las fotos con IA.",
        );
      }

      setImages(
        body.images
        ?? [],
      );
    } catch (
      aiError
    ) {
      setError(
        aiError
          instanceof Error
          ? aiError.message
          : "Error ordenando imágenes.",
      );
    } finally {
      setAiOrdering(
        false,
      );
    }
  }


  async function save() {
    setSaving(
      true,
    );

    setError(
      null,
    );

    try {
      if (
        !form.providerId
      ) {
        throw new Error(
          "Selecciona el proveedor propietario del espacio.",
        );
      }

      if (
        !form.name.trim()
      ) {
        throw new Error(
          "Escribe el nombre del espacio.",
        );
      }

      const payload = {
        providerId:
          form.providerId,

        name:
          form.name.trim(),

        slug:
          form.slug.trim()
          || null,

        description:
          form.description.trim()
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

        publicLocation:
          form.publicLocation.trim()
          || null,

        capacityMin:
          form.capacityMin
            ? Number(
                form.capacityMin,
              )
            : null,

        capacityMax:
          form.capacityMax
            ? Number(
                form.capacityMax,
              )
            : null,

        costFrom:
          Number(
            form.costFrom
            || 0,
          ),

        clientPriceFrom:
          Number(
            form.clientPriceFrom
            || 0,
          ),

        currency:
          "EUR",

        features:
          csv(
            form.features,
          ),

        includedServices:
          csv(
            form.includedServices,
          ),

        suitableFor:
          csv(
            form.suitableFor,
          ),

        rentalModes:
          csv(
            form.rentalModes,
          ),

        eventTypesAllowed:
          csv(
            form.eventTypesAllowed,
          ),

        eventsAllowed:
          form.eventsAllowed,

        partiesAllowed:
          form.partiesAllowed,

        maxEventGuests:
          form.maxEventGuests
            ? Number(
                form.maxEventGuests,
              )
            : null,

        maxSleepingGuests:
          form.maxSleepingGuests
            ? Number(
                form.maxSleepingGuests,
              )
            : null,

        defaultStartTime:
          form.defaultStartTime
          || null,

        defaultEndTime:
          form.defaultEndTime
          || null,

        musicEndTime:
          form.musicEndTime
          || null,

        latitude:
          form.latitude
            ? Number(
                form.latitude,
              )
            : null,

        longitude:
          form.longitude
            ? Number(
                form.longitude,
              )
            : null,

        deposit:
          Number(
            form.deposit
            || 0,
          ),

        cleaningFee:
          Number(
            form.cleaningFee
            || 0,
          ),

        venueRules:
          parseRules(
            form.rulesText,
          ),

        publicNotes:
          form.publicNotes.trim()
          || null,

        internalNotes:
          form.internalNotes.trim()
          || null,

        status:
          form.status,
      };

      const response =
        await fetch(
          selected
            ? `/api/crm/venues/${selected.id}`
            : "/api/crm/venues",

          {
            method:
              selected
                ? "PATCH"
                : "POST",

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
        await response
          .json();

      if (
        !response.ok
      ) {
        throw new Error(
          body?.error
          ?? "No se pudo guardar.",
        );
      }

      const venue =
        body.venue;

      setSelected(
        venue,
      );

      setForm(
        fromVenue(
          venue,
        ),
      );

      await load();
    } catch (
      saveError
    ) {
      setError(
        saveError
          instanceof Error
          ? saveError.message
          : "No se pudo guardar.",
      );
    } finally {
      setSaving(
        false,
      );
    }
  }

  async function uploadImages(
    files:
      FileList | null,
    role:
      "cover"
      | "gallery",
  ) {
    if (
      !selected
      || !files
      || files.length
        === 0
    ) {
      return;
    }

    const data =
      new FormData();

    data.append(
      "role",
      role,
    );

    Array.from(
      files,
    ).forEach(
      (
        file,
      ) =>
        data.append(
          "files",
          file,
        ),
    );

    const response =
      await fetch(
        `/api/crm/venues/${selected.id}/images`,
        {
          method:
            "POST",

          body:
            data,
        },
      );

    const body =
      await response
        .json();

    if (
      !response.ok
    ) {
      setError(
        body?.error
        ?? "No se pudieron subir las imágenes.",
      );

      return;
    }

    await openVenue(
      selected,
    );
  }

  return (
    <main
      style={{
        minHeight:
          "100vh",

        padding:
          "28px",

        background:
          "#f6f7f8",

        color:
          "#171717",
      }}
    >
      <div
        style={{
          width:
            "min(1320px, 100%)",

          margin:
            "0 auto",
        }}
      >
        <div
          style={{
            display:
              "flex",

            justifyContent:
              "space-between",

            alignItems:
              "center",

            gap:
              16,

            marginBottom:
              22,
          }}
        >
          <div>
            <Link
              href="/crm"
              style={{
                color:
                  "#686868",

                textDecoration:
                  "none",

                fontSize:
                  13,
              }}
            >
              ← Centro de eventos
            </Link>

            <h1
              style={{
                margin:
                  "8px 0 4px",

                fontSize:
                  30,
              }}
            >
              Espacios / Chalets
            </h1>

            <p
              style={{
                margin:
                  0,

                color:
                  "#666",
              }}
            >
              Catálogo, precios, imágenes y publicación web.
            </p>
          </div>

          <div
            style={{
              display:
                "flex",

              gap:
                8,
            }}
          >
            <a
              href="/espacios"
              target="_blank"
              rel="noreferrer"
              style={{
                padding:
                  "11px 14px",

                border:
                  "1px solid #ccc",

                borderRadius:
                  8,

                background:
                  "#fff",

                color:
                  "#222",

                textDecoration:
                  "none",

                fontWeight:
                  700,
              }}
            >
              Ver catálogo público
            </a>

            <button
              type="button"
              onClick={
                startNew
              }
              style={{
                padding:
                  "11px 14px",

                border:
                  0,

                borderRadius:
                  8,

                background:
                  "#171717",

                color:
                  "#fff",

                fontWeight:
                  750,

                cursor:
                  "pointer",
              }}
            >
              + Nuevo espacio
            </button>
          </div>
        </div>

        {
          error
            ? (
              <div
                style={{
                  padding:
                    12,

                  marginBottom:
                    16,

                  border:
                    "1px solid #fecaca",

                  background:
                    "#fff1f2",

                  borderRadius:
                    8,

                  color:
                    "#991b1b",
                }}
              >
                {error}
              </div>
            )
            : null
        }

        <div
          style={{
            display:
              "grid",

            gridTemplateColumns:
              "320px minmax(0, 1fr)",

            gap:
              18,
          }}
        >
          <aside
            style={{
              background:
                "#fff",

              border:
                "1px solid #e2e2de",

              borderRadius:
                12,

              overflow:
                "hidden",
            }}
          >
            <div
              style={{
                marginBottom: 14,
                padding: 14,
                border:
                  "1px solid #e1e3e5",
                borderRadius: 10,
                background:
                  "#fff",
              }}
            >
              <strong>
                Búsqueda inteligente de espacios
              </strong>

              <div
                style={{
                  marginTop: 8,
                  display: "grid",
                  gridTemplateColumns:
                    "minmax(0,1fr) auto",
                  gap: 10,
                }}
              >
                <input
                  style={
                    fieldStyle
                  }
                  placeholder="Ej: boda para 80 personas con piscina en Torrent"
                  value={
                    smartSearch
                  }
                  onChange={
                    (
                      event,
                    ) =>
                      setSmartSearch(
                        event.target.value,
                      )
                  }
                />

                <label
                  style={{
                    display:
                      "flex",
                    alignItems:
                      "center",
                    gap: 7,
                    fontSize: 12,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={
                      onlyParties
                    }
                    onChange={
                      (
                        event,
                      ) =>
                        setOnlyParties(
                          event.target.checked,
                        )
                    }
                  />
                  Solo fiestas
                </label>
              </div>

              <small
                style={{
                  display:
                    "block",
                  marginTop: 7,
                  color: "#777",
                }}
              >
                {
                  filteredVenues.length
                } espacios compatibles
              </small>
            </div>

            {
              venues.length
                === 0
                ? (
                  <div
                    style={{
                      padding:
                        20,

                      color:
                        "#777",
                    }}
                  >
                    Todavía no hay espacios.
                  </div>
                )
                : filteredVenues.map(
                    (
                      venue,
                    ) => (
                      <button
                        key={
                          venue.id
                        }
                        type="button"
                        onClick={
                          () =>
                            void openVenue(
                              venue,
                            )
                        }
                        style={{
                          width:
                            "100%",

                          padding:
                            15,

                          display:
                            "block",

                          textAlign:
                            "left",

                          border:
                            0,

                          borderBottom:
                            "1px solid #eee",

                          background:
                            selected?.id
                            === venue.id
                              ? "#f2f2ee"
                              : "#fff",

                          cursor:
                            "pointer",
                        }}
                      >
                        <strong>
                          {
                            venue.name
                          }
                        </strong>

                        <div
                          style={{
                            marginTop:
                              5,

                            color:
                              "#777",

                            fontSize:
                              12,
                          }}
                        >
                          {
                            venue.status
                          }
                          {" · "}
                          {
                            venue.city
                            || "Sin ciudad"
                          }
                        </div>
                      </button>
                    ),
                  )
            }
          </aside>

          <section
            style={{
              padding:
                22,

              background:
                "#fff",

              border:
                "1px solid #e2e2de",

              borderRadius:
                12,
            }}
          >
            <div
              style={{
                display:
                  "grid",

                gridTemplateColumns:
                  "repeat(2, minmax(0, 1fr))",

                gap:
                  14,
              }}
            >
              <label>
                <div>
                  Proveedor propietario
                </div>

                <select
                  style={
                    fieldStyle
                  }
                  value={
                    form.providerId
                  }
                  onChange={
                    (
                      event,
                    ) =>
                      setForm(
                        (
                          current,
                        ) => ({
                          ...current,

                          providerId:
                            event.target.value,
                        }),
                      )
                  }
                >
                  <option value="">
                    Seleccionar
                  </option>

                  {
                    providers.map(
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
                    )
                  }
                </select>
              </label>

              <label>
                <div>
                  Estado
                </div>

                <select
                  style={
                    fieldStyle
                  }
                  value={
                    form.status
                  }
                  onChange={
                    (
                      event,
                    ) =>
                      setForm(
                        (
                          current,
                        ) => ({
                          ...current,

                          status:
                            event.target.value
                            === "published"
                              ? "published"
                              : event.target.value
                                === "archived"
                                ? "archived"
                                : "draft",
                        }),
                      )
                  }
                >
                  <option value="draft">
                    Borrador
                  </option>

                  <option value="published">
                    Publicado
                  </option>

                  <option value="archived">
                    Archivado
                  </option>
                </select>
              </label>

              <label>
                <div>
                  Nombre
                </div>

                <input
                  style={
                    fieldStyle
                  }
                  value={
                    form.name
                  }
                  onChange={
                    (
                      event,
                    ) =>
                      setForm(
                        (
                          current,
                        ) => ({
                          ...current,

                          name:
                            event.target.value,
                        }),
                      )
                  }
                />
              </label>

              <label>
                <div>
                  Slug / URL
                </div>

                <input
                  style={
                    fieldStyle
                  }
                  placeholder="chalet-valencia-norte"
                  value={
                    form.slug
                  }
                  onChange={
                    (
                      event,
                    ) =>
                      setForm(
                        (
                          current,
                        ) => ({
                          ...current,

                          slug:
                            event.target.value,
                        }),
                      )
                  }
                />
              </label>

              <label>
                <div>
                  Ciudad
                </div>

                <input
                  style={
                    fieldStyle
                  }
                  value={
                    form.city
                  }
                  onChange={
                    (
                      event,
                    ) =>
                      setForm(
                        (
                          current,
                        ) => ({
                          ...current,

                          city:
                            event.target.value,
                        }),
                      )
                  }
                />
              </label>

              <label>
                <div>
                  Ubicación pública
                </div>

                <input
                  style={
                    fieldStyle
                  }
                  placeholder="Valencia · alrededores"
                  value={
                    form.publicLocation
                  }
                  onChange={
                    (
                      event,
                    ) =>
                      setForm(
                        (
                          current,
                        ) => ({
                          ...current,

                          publicLocation:
                            event.target.value,
                        }),
                      )
                  }
                />
              </label>

              <label>
                <div>
                  Capacidad mínima
                </div>

                <input
                  type="number"
                  style={
                    fieldStyle
                  }
                  value={
                    form.capacityMin
                  }
                  onChange={
                    (
                      event,
                    ) =>
                      setForm(
                        (
                          current,
                        ) => ({
                          ...current,

                          capacityMin:
                            event.target.value,
                        }),
                      )
                  }
                />
              </label>

              <label>
                <div>
                  Capacidad máxima
                </div>

                <input
                  type="number"
                  style={
                    fieldStyle
                  }
                  value={
                    form.capacityMax
                  }
                  onChange={
                    (
                      event,
                    ) =>
                      setForm(
                        (
                          current,
                        ) => ({
                          ...current,

                          capacityMax:
                            event.target.value,
                        }),
                      )
                  }
                />
              </label>

              <label>
                <div>
                  Coste proveedor
                </div>

                <input
                  type="number"
                  style={
                    fieldStyle
                  }
                  value={
                    form.costFrom
                  }
                  onChange={
                    (
                      event,
                    ) =>
                      setForm(
                        (
                          current,
                        ) => ({
                          ...current,

                          costFrom:
                            event.target.value,
                        }),
                      )
                  }
                />
              </label>

              <label>
                <div>
                  Precio cliente desde
                </div>

                <input
                  type="number"
                  style={
                    fieldStyle
                  }
                  value={
                    form.clientPriceFrom
                  }
                  onChange={
                    (
                      event,
                    ) =>
                      setForm(
                        (
                          current,
                        ) => ({
                          ...current,

                          clientPriceFrom:
                            event.target.value,
                        }),
                      )
                  }
                />
              </label>
            </div>

            <section
              style={{
                marginTop: 18,
                padding: 16,
                border:
                  "1px solid #dedfdb",
                borderRadius: 10,
                background:
                  "#fafaf8",
              }}
            >
              <strong
                style={{
                  display: "block",
                  marginBottom: 12,
                }}
              >
                Uso, alquiler y restricciones
              </strong>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(2, minmax(0, 1fr))",
                  gap: 12,
                }}
              >
                <label>
                  <div>
                    Modalidades
                  </div>
                  <input
                    style={fieldStyle}
                    placeholder="day, multi_day, week, fortnight"
                    value={form.rentalModes}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        rentalModes:
                          event.target.value,
                      }))
                    }
                  />
                </label>

                <label>
                  <div>
                    Eventos permitidos
                  </div>
                  <input
                    style={fieldStyle}
                    placeholder="Bodas, cumpleaños, empresas"
                    value={form.eventTypesAllowed}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        eventTypesAllowed:
                          event.target.value,
                      }))
                    }
                  />
                </label>

                <label>
                  <div>
                    Capacidad evento
                  </div>
                  <input
                    type="number"
                    style={fieldStyle}
                    value={form.maxEventGuests}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        maxEventGuests:
                          event.target.value,
                      }))
                    }
                  />
                </label>

                <label>
                  <div>
                    Personas para dormir
                  </div>
                  <input
                    type="number"
                    style={fieldStyle}
                    value={form.maxSleepingGuests}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        maxSleepingGuests:
                          event.target.value,
                      }))
                    }
                  />
                </label>

                <label>
                  <div>
                    Entrada habitual
                  </div>
                  <input
                    type="time"
                    style={fieldStyle}
                    value={form.defaultStartTime}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        defaultStartTime:
                          event.target.value,
                      }))
                    }
                  />
                </label>

                <label>
                  <div>
                    Salida habitual
                  </div>
                  <input
                    type="time"
                    style={fieldStyle}
                    value={form.defaultEndTime}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        defaultEndTime:
                          event.target.value,
                      }))
                    }
                  />
                </label>

                <label>
                  <div>
                    Hora límite de música
                  </div>
                  <input
                    type="time"
                    style={fieldStyle}
                    value={form.musicEndTime}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        musicEndTime:
                          event.target.value,
                      }))
                    }
                  />
                </label>

                <label>
                  <div>
                    Fianza €
                  </div>
                  <input
                    type="number"
                    style={fieldStyle}
                    value={form.deposit}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        deposit:
                          event.target.value,
                      }))
                    }
                  />
                </label>

                <label>
                  <div>
                    Limpieza €
                  </div>
                  <input
                    type="number"
                    style={fieldStyle}
                    value={form.cleaningFee}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        cleaningFee:
                          event.target.value,
                      }))
                    }
                  />
                </label>

                <label>
                  <div>
                    Latitud
                  </div>
                  <input
                    type="number"
                    step="0.000001"
                    style={fieldStyle}
                    value={form.latitude}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        latitude:
                          event.target.value,
                      }))
                    }
                  />
                </label>

                <label>
                  <div>
                    Longitud
                  </div>
                  <input
                    type="number"
                    step="0.000001"
                    style={fieldStyle}
                    value={form.longitude}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        longitude:
                          event.target.value,
                      }))
                    }
                  />
                </label>
              </div>

              <div
                style={{
                  marginTop: 12,
                  display: "flex",
                  gap: 20,
                  flexWrap: "wrap",
                }}
              >
                <label>
                  <input
                    type="checkbox"
                    checked={form.eventsAllowed}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        eventsAllowed:
                          event.target.checked,
                      }))
                    }
                  />
                  {" "}
                  Permite eventos
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={form.partiesAllowed}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        partiesAllowed:
                          event.target.checked,
                      }))
                    }
                  />
                  {" "}
                  Permite fiestas
                </label>
              </div>

              
  {selected ? <VenueCalendar venueId={selected.id} /> : null}
  <div
    style={{
      gridColumn: "1 / -1",
      border: "1px solid #e2e2dc",
      borderRadius: 12,
      padding: 16,
      background: "#fafaf8",
    }}
  >
    <div
      style={{
        marginBottom: 14,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 16,
      }}
    >
      <div>
        <strong>
          Reglas y condiciones
        </strong>

        <div
          style={{
            marginTop: 4,
            fontSize: 12,
            color: "#777",
          }}
        >
          {selected
            ? editingVenueRules
              ? "Modo edición. Guardá los cambios al finalizar."
              : "Información operativa vigente del espacio."
            : "Configurá las condiciones del nuevo espacio."}
        </div>
      </div>

      
      {selected ? (
        <button
          type="button"
          onClick={() =>
            setEditingVenueRules(
              (current) =>
                !current,
            )
          }
          style={{
            border:
              "1px solid #d7d7d0",
            background:
              editingVenueRules
                ? "#f1f1ed"
                : "#fff",
            borderRadius: 8,
            padding:
              "7px 12px",
            cursor:
              "pointer",
            fontSize: 12,
            fontWeight: 700,
            whiteSpace:
              "nowrap",
          }}
        >
          {editingVenueRules
            ? "Terminar edición"
            : "Editar información"}
        </button>
      ) : null}
    </div>

    <div
      style={{
        display: "grid",
        gridTemplateColumns:
          "repeat(2, minmax(0,1fr))",
        gap: 9,
      }}
    >
      {[
        [
          "sleeping_allowed",
          "Se puede dormir",
        ],
        [
          "pets_allowed",
          "Permite mascotas",
        ],
        [
          "external_catering_allowed",
          "Permite catering externo",
        ],
        [
          "dj_external_allowed",
          "Permite DJ externo",
        ],
        [
          "interior_music_allowed",
          "Música interior",
        ],
        [
          "exterior_music_allowed",
          "Música exterior",
        ],
        [
          "smoking_inside",
          "Se puede fumar dentro",
        ],
        [
          "fireworks_allowed",
          "Fuegos artificiales / petardos",
        ],
        [
          "drugs_allowed",
          "Permite drogas",
        ],
        [
          "minors_require_supervision",
          "Menores con supervisión",
        ],
        [
          "customer_must_clean",
          "Debe dejar limpio",
        ],
        [
          "cleaning_included",
          "Limpieza incluida",
        ],
        [
          "booking_requires_deposit",
          "Requiere fianza",
        ],
        [
          "extended_end_time_requires_confirmation",
          "Horario ampliado requiere confirmación",
        ],
      ].map(([key, label]) => {
        const current =
          ruleValue(key);

        const editable =
          !selected
          || editingVenueRules;

        const displayValue =
          current === true
            ? "Sí"
            : current === false
              ? "No"
              : "Sin información";

        return (
          <div
            key={key}
            style={{
              display: "grid",
              gridTemplateColumns:
                "1fr 145px",
              alignItems:
                "center",
              gap: 10,
              padding:
                "10px 12px",
              background: "#fff",
              border:
                "1px solid #e5e5df",
              borderRadius: 9,
            }}
          >
            <span
              style={{
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              {label}
            </span>

            {editable ? (
              <select
                style={{
                  ...fieldStyle,
                  minHeight: 36,
                  padding:
                    "5px 8px",
                }}
                value={
                  current === true
                    ? "true"
                    : current === false
                      ? "false"
                      : ""
                }
                onChange={(
                  event,
                ) => {
                  const value =
                    event.target
                      .value;

                  updateRule(
                    key,
                    value === ""
                      ? null
                      : value
                        === "true",
                  );
                }}
              >
                <option value="">
                  ? Sin información
                </option>

                <option value="true">
                  ✓ Sí
                </option>

                <option value="false">
                  ✕ No
                </option>
              </select>
            ) : (
              <div
                style={{
                  minHeight: 36,
                  display:
                    "flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "center",
                  borderRadius: 8,
                  border:
                    "1px solid #e5e5df",
                  background:
                    current === true
                      ? "#f3f8f3"
                      : current === false
                        ? "#faf4f4"
                        : "#f6f6f3",
                  color:
                    current === true
                      ? "#35623a"
                      : current === false
                        ? "#7c3d3d"
                        : "#777",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {current === true
                  ? "✓ "
                  : current === false
                    ? "✕ "
                    : "? "}
                {displayValue}
              </div>
            )}
          </div>
        );
      })}
    </div>

    {selected
      && editingVenueRules ? (
        <div
          style={{
            marginTop: 12,
            paddingTop: 10,
            borderTop:
              "1px solid #e5e5df",
            fontSize: 12,
            color: "#666",
          }}
        >
          Los cambios no se envían automáticamente.
          Usá <strong>Guardar cambios</strong> al
          final de la ficha para confirmarlos.
        </div>
      ) : null}
  </div>

            </section>


            <label
              style={{
                display:
                  "block",

                marginTop:
                  14,
              }}
            >
              <div>
                Descripción pública
              </div>

              <textarea
                style={{
                  ...fieldStyle,

                  minHeight:
                    130,

                  resize:
                    "vertical",
                }}
                value={
                  form.description
                }
                onChange={
                  (
                    event,
                  ) =>
                    setForm(
                      (
                        current,
                      ) => ({
                        ...current,

                        description:
                          event.target.value,
                      }),
                    )
                }
              />
            </label>

            <label
              style={{
                display:
                  "block",

                marginTop:
                  14,
              }}
            >
              <div>
                Características
              </div>

              <input
                style={
                  fieldStyle
                }
                placeholder="Piscina, jardín, parking, terraza, zona DJ"
                value={
                  form.features
                }
                onChange={
                  (
                    event,
                  ) =>
                    setForm(
                      (
                        current,
                      ) => ({
                        ...current,

                        features:
                          event.target.value,
                      }),
                    )
                }
              />
            </label>

            <label
              style={{
                display:
                  "block",

                marginTop:
                  14,
              }}
            >
              <div>
                Incluye
              </div>

              <input
                style={
                  fieldStyle
                }
                placeholder="Mesas, sillas, limpieza"
                value={
                  form.includedServices
                }
                onChange={
                  (
                    event,
                  ) =>
                    setForm(
                      (
                        current,
                      ) => ({
                        ...current,

                        includedServices:
                          event.target.value,
                      }),
                    )
                }
              />
            </label>

            <label
              style={{
                display:
                  "block",

                marginTop:
                  14,
              }}
            >
              <div>
                Ideal para
              </div>

              <input
                style={
                  fieldStyle
                }
                placeholder="Bodas, cumpleaños, empresas"
                value={
                  form.suitableFor
                }
                onChange={
                  (
                    event,
                  ) =>
                    setForm(
                      (
                        current,
                      ) => ({
                        ...current,

                        suitableFor:
                          event.target.value,
                      }),
                    )
                }
              />
            </label>

            {
              selected
                ? (
                  
<div
  style={{
    gridColumn: "1 / -1",
    marginTop: 18,
    paddingTop: 18,
    borderTop: "1px solid #ecece7",
  }}
>
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
      marginBottom: 12,
    }}
  >
    <div>
      <strong
        style={{
          fontSize: 16,
        }}
      >
        Fotos del espacio
      </strong>

      <div
        style={{
          marginTop: 4,
          color: "#777",
          fontSize: 12,
        }}
      >
        {images.length} / 60 fotos
      </div>
    </div>

    {images.length >= 2 ? (
      <button
        type="button"
        disabled={aiOrdering}
        onClick={() => {
          void orderImagesWithAi();
        }}
        style={{
          minHeight: 38,
          padding: "0 14px",
          borderRadius: 8,
          border: "1px solid #222",
          background: "#222",
          color: "#fff",
          cursor: aiOrdering
            ? "wait"
            : "pointer",
          fontWeight: 600,
        }}
      >
        {aiOrdering
          ? "Analizando fotos..."
          : "Elegir portada y ordenar con IA"}
      </button>
    ) : null}
  </div>

  <label
    style={{
      display: "block",
      padding: 22,
      border: "2px dashed #c8c8c0",
      borderRadius: 12,
      background: "#fafaf8",
      cursor:
        mediaUploading
        || images.length >= 60
          ? "not-allowed"
          : "pointer",
    }}
  >
    <strong
      style={{
        display: "block",
        fontSize: 14,
      }}
    >
      Seleccionar todas las fotos
    </strong>

    <div
      style={{
        marginTop: 5,
        color: "#777",
        fontSize: 12,
      }}
    >
      Podés seleccionar hasta 60 fotos de una sola vez.
      La IA elegirá después cuál debe ser la portada y en qué orden mostrar las demás.
    </div>

    <input
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        disabled={
          mediaUploading
          || images.length >= 60
        }
        onChange={(event) => {
          const selectedFiles =
            Array.from(
              event.currentTarget.files
              ?? [],
            );

          console.log(
            "[VENUE FILE SELECT]",
            {
              count:
                selectedFiles.length,
              venueId:
                selected?.id
                ?? null,
            },
          );

          setMediaProgress(
            `Selector recibió ${selectedFiles.length} fotos`,
          );

          event.currentTarget.value =
            "";

          void uploadManyImages(
            selectedFiles,
          );
        }}
        style={{
          display: "block",
          marginTop: 14,
        }}
      />
    </label>

    {mediaProgress ? (
      <div
        style={{
          marginTop: 10,
          padding: "9px 11px",
          borderRadius: 8,
          background: "#f1f1ed",
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        {mediaProgress}
      </div>
    ) : null}

    {images.length > 0 ? (
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fill, minmax(140px, 1fr))",
          gap: 10,
          marginTop: 16,
        }}
      >
        {images.map(
          (
            image,
            index,
          ) => {
            const src =
              image.public_url
              || image.url
              || "";

            return (
              <div
                key={image.id}
                style={{
                  position: "relative",
                  overflow: "hidden",
                  borderRadius: 9,
                  border:
                    image.role === "cover"
                      ? "2px solid #b88a2c"
                      : "1px solid #ddd",
                  background: "#fff",
                }}
              >
                <img
                  src={src}
                  alt=""
                  style={{
                    display: "block",
                    width: "100%",
                    aspectRatio: "4 / 3",
                    objectFit: "cover",
                  }}
                />

                <div
                  style={{
                    padding: 7,
                    fontSize: 11,
                  }}
                >
                  <strong>
                    #{index + 1}
                    {image.role === "cover"
                      ? " · PORTADA"
                      : ""}
                  </strong>

                  {image.ai_score != null ? (
                    <div
                      style={{
                        marginTop: 3,
                        color: "#666",
                      }}
                    >
                      IA: {image.ai_score}/100
                    </div>
                  ) : null}

                  {image.ai_category ? (
                    <div
                      style={{
                        color: "#777",
                      }}
                    >
                      {image.ai_category}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          },
        )}
      </div>
    ) : (
      <div
        style={{
          marginTop: 10,
          color: "#888",
          fontSize: 12,
        }}
      >
        Todavía no hay fotos cargadas.
      </div>
    )}
  </div>

                )
                : null
            }

            <div
              style={{
                display:
                  "flex",

                justifyContent:
                  "space-between",

                gap:
                  10,

                marginTop:
                  24,

                paddingTop:
                  20,

                borderTop:
                  "1px solid #eee",
              }}
            >
              <div
                style={{
                  display:
                    "flex",

                  gap:
                    8,
                }}
              >
                {
                  selected?.slug
                    ? (
                      <a
                        href={
                          `/espacios/${selected.slug}?preview=${selected.id}`
                        }
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          padding:
                            "11px 14px",

                          border:
                            "1px solid #ccc",

                          borderRadius:
                            8,

                          color:
                            "#222",

                          textDecoration:
                            "none",

                          fontWeight:
                            700,
                        }}
                      >
                        Previsualizar
                      </a>
                    )
                    : null
                }
              </div>

              <button
                type="button"
                disabled={
                  saving
                }
                onClick={
                  () =>
                    void save()
                }
                style={{
                  padding:
                    "11px 18px",

                  border:
                    0,

                  borderRadius:
                    8,

                  background:
                    "#171717",

                  color:
                    "#fff",

                  fontWeight:
                    750,

                  cursor:
                    saving
                      ? "wait"
                      : "pointer",
                }}
              >
                {
                  saving
                    ? "Guardando…"
                    : selected
                      ? "Guardar cambios"
                      : "Crear espacio"
                }
              </button>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
