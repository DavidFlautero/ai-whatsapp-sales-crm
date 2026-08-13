"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  inferCatalogCategory,
} from "../_components/catalog-classification";


type Gap = {
  articleCode:
    string;

  name:
    string;

  colors:
    string[];

  available:
    number;

  externalUnits:
    number;

  missingSince:
    string | null;

  firstSeenAt:
    string;

  generation:
    number;

  pendingAlert:
    boolean;

  baselineMissing:
    boolean;

  attempts:
    number;

  imageCount:
    number;

  images?:
    Array<{
      id:
        string;

      url:
        string;

      role:
        string;

      createdAt:
        string;
    }>;
};


type Settings = {
  ownerWhatsapp:
    string | null;

  notificationsEnabled:
    boolean;
};


type GapsResponse = {
  ok:
    boolean;

  degraded?:
    boolean;

  reason?:
    string | null;

  gaps:
    Gap[];

  articles?:
    number;

  images?:
    number;

  registryAssets?:
    number;

  internalImages?:
    number;

  settings:
    Settings;
};


const roles = [
  ["cover", "Portada"],
  ["front", "Frente"],
  ["back", "Espalda"],
  ["model", "Modelo"],
  ["detail", "Detalle"],
] as const;


function formatDate(
  value:
    string | null,
) {
  if (!value) {
    return "—";
  }

  const date =
    new Date(
      value,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return new Intl
    .DateTimeFormat(
      "es-AR",
      {
        dateStyle:
          "medium",

        timeStyle:
          "short",
      },
    )
    .format(
      date,
    );
}


export function MissingImagesClient() {
  /* CATALOG_MEDIA_FILTER_STATE_V1 */
  const [
    search,
    setSearch,
  ] =
    useState(
      "",
    );


  const [
    categoryFilter,
    setCategoryFilter,
  ] =
    useState(
      "all",
    );


  const [
    data,
    setData,
  ] =
    useState<
      GapsResponse | null
    >(
      null,
    );


  const [
    loading,
    setLoading,
  ] =
    useState(
      true,
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
    uploading,
    setUploading,
  ] =
    useState<
      string | null
    >(
      null,
    );


  const [
    ownerPhone,
    setOwnerPhone,
  ] =
    useState(
      "",
    );


  const [
    savingSettings,
    setSavingSettings,
  ] =
    useState(
      false,
    );


  const load =
    useCallback(
      async () => {
        setLoading(
          true,
        );

        setError(
          null,
        );

        try {
          const response =
            await fetch(
              "/dashboard-api/catalog/media-gaps",
              {
                cache:
                  "no-store",
              },
            );


          const body =
            await response.json();


          if (!response.ok) {
            throw new Error(
              body?.error
              || "No se pudieron cargar las fotos pendientes",
            );
          }


          setData(
            body,
          );


          setOwnerPhone(
            body.settings
              ?.ownerWhatsapp
            ?? "",
          );

        } catch (requestError) {
          setError(
            requestError
              instanceof Error
                ? requestError.message
                : "Error inesperado",
          );

        } finally {
          setLoading(
            false,
          );
        }
      },
      [],
    );


  useEffect(
    () => {
      void load();
    },
    [
      load,
    ],
  );


  async function saveSettings() {
    setSavingSettings(
      true,
    );

    setError(
      null,
    );

    try {
      const response =
        await fetch(
          "/dashboard-api/catalog/media-settings",
          {
            method:
              "PUT",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                ownerWhatsapp:
                  ownerPhone,

                notificationsEnabled:
                  true,
              }),
          },
        );


      const body =
        await response.json();


      if (!response.ok) {
        throw new Error(
          body?.error
          || "No se pudo guardar el número",
        );
      }


      await load();

    } catch (requestError) {
      setError(
        requestError
          instanceof Error
            ? requestError.message
            : "Error inesperado",
      );

    } finally {
      setSavingSettings(
        false,
      );
    }
  }


  async function uploadImage(
    gap:
      Gap,

    selections:
      Array<{
        file:
          File;

        role:
          string;
      }>,
  ) {
    if (!selections.length) {
      return;
    }

    setUploading(
      gap.articleCode,
    );

    setError(
      null,
    );


    try {
      for (
        const selection
        of selections
      ) {
        const form =
          new FormData();


        form.set(
          "file",
          selection.file,
        );

        form.set(
          "articleCode",
          gap.articleCode,
        );

        form.set(
          "role",
          selection.role,
        );


        if (
          gap.colors[0]
        ) {
          form.set(
            "colorName",
            gap.colors[0],
          );
        }


        const response =
          await fetch(
            "/dashboard-api/catalog/media-upload",
            {
              method:
                "POST",

              body:
                form,
            },
          );


        const body =
          await response.json();


        if (!response.ok) {
          if (
            body?.error
            === "CATALOG_MEDIA_IMAGE_LIMIT_REACHED"
          ) {
            throw new Error(
              "Este producto ya completó sus 3 fotografías",
            );
          }

          throw new Error(
            body?.error
            || "No se pudo subir la imagen",
          );
        }
      }


      await load();

    } catch (requestError) {
      const message =
        requestError
          instanceof Error
            ? requestError.message
            : "Error inesperado";


      setError(
        message,
      );


      await load()
        .catch(
          () => undefined,
        );


      throw requestError;

    } finally {
      setUploading(
        null,
      );
    }
  }

  async function deleteImage(
    gap:
      Gap,

    imageId:
      string,
  ) {
    const confirmed =
      window.confirm(
        `¿Eliminar esta fotografía de ${gap.articleCode}?`,
      );


    if (!confirmed) {
      return;
    }


    setUploading(
      gap.articleCode,
    );

    setError(
      null,
    );


    try {
      const response =
        await fetch(
          `/dashboard-api/catalog/media-images/${
            encodeURIComponent(
              imageId,
            )
          }`,
          {
            method:
              "DELETE",
          },
        );


      const body =
        await response.json();


      if (!response.ok) {
        throw new Error(
          body?.error
          || "No se pudo eliminar la fotografía",
        );
      }


      await load();

    } catch (requestError) {
      setError(
        requestError
          instanceof Error
            ? requestError.message
            : "Error inesperado",
      );

    } finally {
      setUploading(
        null,
      );
    }
  }



  const gaps =
    data?.gaps
    ?? [];


  const categoryOptions =
    Array.from(
      new Set(
        gaps.map(
          (gap) =>
            inferCatalogCategory({
              baseSku:
                gap.articleCode,

              name:
                gap.name,
            }),
        ),
      ),
    )
      .sort(
        (
          left,
          right,
        ) =>
          left.localeCompare(
            right,
            "es",
          ),
      );


  const normalizedSearch =
    search
      .trim()
      .toLowerCase();


  const filteredGaps =
    gaps.filter(
      (gap) => {
        const category =
          inferCatalogCategory({
            baseSku:
              gap.articleCode,

            name:
              gap.name,
          });


        const matchesCategory =
          categoryFilter
            === "all"
          || category
            === categoryFilter;


        const haystack =
          [
            gap.articleCode,
            gap.name,
            category,
            gap.colors
              .join(
                " ",
              ),
          ]
            .join(
              " ",
            )
            .toLowerCase();


        const matchesSearch =
          !normalizedSearch
          || haystack.includes(
            normalizedSearch,
          );


        return (
          matchesCategory
          && matchesSearch
        );
      },
    );


  return (
    <main className="media-missing-page">
      <header className="media-missing-hero">
        <div>
          <span>
            CATÁLOGO · CONTROL MULTIMEDIA
          </span>

          <h1>
            Fotos pendientes
          </h1>

          <p>
            Sólo aparecen artículos activos
            de Ninox que todavía no completaron
            sus tres fotografías.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            void load()
          }
          disabled={loading}
        >
          {loading
            ? "Revisando…"
            : "Revisar ahora"}
        </button>
      </header>


      {/* CATALOG_MEDIA_FILTER_UI_V1 */}
      <section className="media-missing-filters">
        <div>
          <label
            htmlFor="media-search"
          >
            Buscar artículo
          </label>

          <input
            id="media-search"
            type="search"
            value={search}
            placeholder="Código, nombre, color..."
            onChange={(
              event,
            ) =>
              setSearch(
                event.target.value,
              )
            }
          />
        </div>

        <div>
          <label
            htmlFor="media-category"
          >
            Categoría
          </label>

          <select
            id="media-category"
            value={
              categoryFilter
            }
            onChange={(
              event,
            ) =>
              setCategoryFilter(
                event.target.value,
              )
            }
          >
            <option
              value="all"
            >
              Todas las categorías
            </option>

            {categoryOptions.map(
              (category) => (
                <option
                  key={
                    category
                  }
                  value={
                    category
                  }
                >
                  {category}
                </option>
              ),
            )}
          </select>
        </div>

        <div className="media-filter-result">
          <span>
            Mostrando
          </span>

          <strong>
            {filteredGaps.length}
          </strong>

          <small>
            de {gaps.length} pendientes
          </small>
        </div>
      </section>


      <section className="media-missing-metrics">
        <article>
          <span>
            Pendientes de completar
          </span>

          <strong>
            {gaps.length}
          </strong>
        </article>

        <article>
          <span>
            Artículos Ninox
          </span>

          <strong>
            {data?.articles ?? "—"}
          </strong>
        </article>

        <article>
          <span>
            Multimedia propia
          </span>

          <strong>
            {
              (
                data?.registryAssets
                ?? 0
              )
              + (
                data?.internalImages
                ?? 0
              )
            }
          </strong>
        </article>
      </section>


      <section className="media-owner-settings">
        <div>
          <strong>
            Alertas al administrador
          </strong>

          <p>
            El destinatario se obtiene automáticamente
            del owner/admin activo de Fulanitas.
            No existe un segundo número de WhatsApp
            para este módulo.
          </p>
        </div>

        <div className="media-owner-form">
          <strong>
            Admin de empresa ✓
          </strong>
        </div>
      </section>


      {data?.degraded ? (
        <div className="media-warning">
          El índice multimedia está temporalmente
          degradado. Por seguridad el sistema no
          genera nuevas alertas hasta recuperar
          todas sus fuentes.
        </div>
      ) : null}


      {error ? (
        <div className="media-error">
          {error}
        </div>
      ) : null}


      {!loading
      && gaps.length === 0 ? (
        <section className="media-all-good">
          <strong>
            Todo cubierto ✓
          </strong>

          <p>
            No hay artículos activos de Ninox
            pendientes de fotografía.
          </p>
        </section>
      ) : null}


      <section className="media-gap-grid">
        {filteredGaps.map(
          (gap) => (
            <GapCard
              key={
                gap.articleCode
              }
              gap={
                gap
              }
              busy={
                uploading
                === gap.articleCode
              }
              onUpload={
                uploadImage
              }
              onDelete={
                deleteImage
              }
            />
          ),
        )}
      </section>
    </main>
  );
}



type PendingImageSelection = {
  id:
    string;

  file:
    File;

  previewUrl:
    string;

  role:
    string;
};


const REQUIRED_IMAGE_COUNT =
  3;


const defaultRoles = [
  "cover",
  "front",
  "back",
] as const;


function GapCard(
  props: {
    gap:
      Gap;

    busy:
      boolean;

    onUpload:
      (
        gap:
          Gap,

        selections:
          Array<{
            file:
              File;

            role:
              string;
          }>,
      ) => Promise<void>;

    onDelete:
      (
        gap:
          Gap,

        imageId:
          string,
      ) => Promise<void>;
  },
) {
  const [
    selectedImages,
    setSelectedImages,
  ] =
    useState<
      PendingImageSelection[]
    >(
      [],
    );


  const [
    notice,
    setNotice,
  ] =
    useState<
      string | null
    >(
      null,
    );


  const selectionsRef =
    useRef<
      PendingImageSelection[]
    >(
      [],
    );


  const savedCount =
    Math.min(
      REQUIRED_IMAGE_COUNT,
      Math.max(
        0,
        Number(
          props.gap.imageCount
          ?? 0,
        ),
      ),
    );


  const availableSlots =
    Math.max(
      0,
      REQUIRED_IMAGE_COUNT
      - savedCount
      - selectedImages.length,
    );


  useEffect(
    () => {
      selectionsRef.current =
        selectedImages;
    },
    [
      selectedImages,
    ],
  );


  useEffect(
    () => {
      return () => {
        for (
          const selection
          of selectionsRef.current
        ) {
          URL.revokeObjectURL(
            selection.previewUrl,
          );
        }
      };
    },
    [],
  );


  function addFiles(
    files:
      FileList | null,
  ) {
    if (
      !files
      || props.busy
    ) {
      return;
    }


    const allowedTypes =
      new Set([
        "image/jpeg",
        "image/png",
        "image/webp",
      ]);


    const maximumSize =
      5
      * 1024
      * 1024;


    const incoming =
      Array.from(
        files,
      );


    const valid =
      incoming.filter(
        (file) =>
          allowedTypes.has(
            file.type,
          )
          && file.size
            <= maximumSize,
      );


    if (
      valid.length
      !== incoming.length
    ) {
      setNotice(
        "Sólo se aceptan JPG, PNG o WEBP de hasta 5 MB.",
      );
    } else {
      setNotice(
        null,
      );
    }


    const currentKeys =
      new Set(
        selectedImages.map(
          (selection) =>
            [
              selection.file.name,
              selection.file.size,
              selection.file.lastModified,
            ].join("|"),
        ),
      );


    const unique =
      valid.filter(
        (file) => {
          const key =
            [
              file.name,
              file.size,
              file.lastModified,
            ].join("|");


          if (
            currentKeys.has(
              key,
            )
          ) {
            return false;
          }


          currentKeys.add(
            key,
          );

          return true;
        },
      );


    const accepted =
      unique.slice(
        0,
        availableSlots,
      );


    if (
      unique.length
      > availableSlots
    ) {
      setNotice(
        `Este producto sólo tiene ${availableSlots} espacio(s) disponible(s).`,
      );
    }


    if (!accepted.length) {
      return;
    }


    const additions =
      accepted.map(
        (
          file,
          index,
        ) => {
          const slot =
            Math.min(
              savedCount
              + selectedImages.length
              + index,
              defaultRoles.length - 1,
            );


          return {
            id:
              typeof crypto
                .randomUUID
                === "function"
                ? crypto.randomUUID()
                : `${
                    file.name
                  }-${
                    file.lastModified
                  }-${
                    index
                  }`,

            file,

            previewUrl:
              URL.createObjectURL(
                file,
              ),

            role:
              defaultRoles[
                slot
              ],
          };
        },
      );


    setSelectedImages(
      (
        current,
      ) => [
        ...current,
        ...additions,
      ],
    );
  }


  function removeSelection(
    id:
      string,
  ) {
    setSelectedImages(
      (current) =>
        current.filter(
          (selection) => {
            if (
              selection.id
              === id
            ) {
              URL.revokeObjectURL(
                selection.previewUrl,
              );

              return false;
            }

            return true;
          },
        ),
    );

    setNotice(
      null,
    );
  }


  function updateSelectionRole(
    id:
      string,

    role:
      string,
  ) {
    setSelectedImages(
      (current) =>
        current.map(
          (selection) =>
            selection.id
              === id
              ? {
                  ...selection,
                  role,
                }
              : selection,
        ),
    );
  }


  function clearSelections() {
    for (
      const selection
      of selectedImages
    ) {
      URL.revokeObjectURL(
        selection.previewUrl,
      );
    }


    selectionsRef.current =
      [];

    setSelectedImages(
      [],
    );
  }


  async function confirmUpload() {
    if (
      !selectedImages.length
      || props.busy
    ) {
      return;
    }


    try {
      await props.onUpload(
        props.gap,
        selectedImages.map(
          (selection) => ({
            file:
              selection.file,

            role:
              selection.role,
          }),
        ),
      );


      clearSelections();

      setNotice(
        null,
      );

    } catch {
      setNotice(
        "La carga no se completó. Podés volver a intentarlo sin seleccionar las fotos otra vez.",
      );
    }
  }


  const plannedCount =
    Math.min(
      REQUIRED_IMAGE_COUNT,
      savedCount
      + selectedImages.length,
    );


  return (
    <article className="media-gap-card">
      <div className="media-gap-card-head">
        <span>
          {props.gap.articleCode}
        </span>

        <em>
          {savedCount}/3 guardadas
        </em>
      </div>


      <h2>
        {props.gap.name}
      </h2>


      <div className="media-gap-info">
        <p>
          <b>Categoría:</b>{" "}
          {
            inferCatalogCategory({
              baseSku:
                props.gap.articleCode,

              name:
                props.gap.name,
            })
          }
        </p>

        <p>
          <b>Colores:</b>{" "}
          {
            props.gap.colors
              .join(", ")
            || "—"
          }
        </p>

        <p>
          <b>Stock disponible:</b>{" "}
          {props.gap.available}
        </p>

        <p>
          <b>Progreso:</b>{" "}
          {savedCount}/3 guardadas ·{" "}
          {
            REQUIRED_IMAGE_COUNT
            - savedCount
          } pendientes
        </p>
      </div>


      <section
        className="media-three-preview"
        aria-label="Previsualización de fotografías"
      >
        {
          Array.from(
            {
              length:
                REQUIRED_IMAGE_COUNT,
            },
          ).map(
            (
              _,
              slotIndex,
            ) => {
              if (
                slotIndex
                < savedCount
              ) {
                const savedImage =
                  props.gap.images
                    ?.[
                      slotIndex
                    ];


                if (savedImage) {
                  const savedRole =
                    roles.find(
                      (
                        [
                          value,
                        ],
                      ) =>
                        value
                        === savedImage.role,
                    )
                      ?.[1]
                    ?? savedImage.role;


                  return (
                    <div
                      className="media-photo-slot is-saved has-image"
                      key={savedImage.id}
                    >
                      <img
                        src={savedImage.url}
                        alt={
                          `Foto guardada ${
                            slotIndex + 1
                          } de ${
                            props.gap.name
                          }`
                        }
                      />

                      <div className="media-saved-image-controls">
                        <strong>
                          Foto {slotIndex + 1}
                        </strong>

                        <span>
                          {savedRole}
                        </span>

                        <button
                          type="button"
                          disabled={props.busy}
                          onClick={() =>
                            void props.onDelete(
                              props.gap,
                              savedImage.id,
                            )
                          }
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  );
                }


                return (
                  <div
                    className="media-photo-slot is-saved"
                    key={`saved-${slotIndex}`}
                  >
                    <div className="media-photo-saved-mark">
                      ✓
                    </div>

                    <strong>
                      Foto {slotIndex + 1}
                    </strong>

                    <span>
                      Imagen histórica
                    </span>
                  </div>
                );
              }


              const selection =
                selectedImages[
                  slotIndex
                  - savedCount
                ];


              if (!selection) {
                return (
                  <div
                    className="media-photo-slot is-empty"
                    key={`empty-${slotIndex}`}
                  >
                    <div className="media-photo-empty-mark">
                      +
                    </div>

                    <strong>
                      Foto {slotIndex + 1}
                    </strong>

                    <span>
                      Pendiente
                    </span>
                  </div>
                );
              }


              return (
                <div
                  className="media-photo-slot is-preview"
                  key={selection.id}
                >
                  <img
                    src={selection.previewUrl}
                    alt={
                      `Previsualización ${
                        slotIndex + 1
                      } de ${
                        props.gap.name
                      }`
                    }
                  />

                  <div className="media-photo-preview-controls">
                    <strong>
                      Foto {slotIndex + 1}
                    </strong>

                    <small>
                      {
                        (
                          selection.file.size
                          / 1024
                          / 1024
                        ).toFixed(2)
                      } MB
                    </small>

                    <select
                      aria-label={
                        `Tipo de la foto ${
                          slotIndex + 1
                        }`
                      }
                      value={selection.role}
                      onChange={(
                        event,
                      ) =>
                        updateSelectionRole(
                          selection.id,
                          event.target.value,
                        )
                      }
                    >
                      {roles.map(
                        (
                          [
                            value,
                            label,
                          ],
                        ) => (
                          <option
                            key={value}
                            value={value}
                          >
                            {label}
                          </option>
                        ),
                      )}
                    </select>

                    <button
                      type="button"
                      onClick={() =>
                        removeSelection(
                          selection.id,
                        )
                      }
                      disabled={props.busy}
                    >
                      Quitar
                    </button>
                  </div>
                </div>
              );
            },
          )
        }
      </section>


      <div className="media-batch-progress">
        <span>
          Preparadas: {plannedCount}/3
        </span>

        <div>
          <i
            style={{
              width:
                `${
                  (
                    plannedCount
                    / REQUIRED_IMAGE_COUNT
                  )
                  * 100
                }%`,
            }}
          />
        </div>
      </div>


      <div className="media-batch-actions">
        <label
          className={
            availableSlots > 0
            && !props.busy
              ? ""
              : "is-disabled"
          }
        >
          {
            props.busy
              ? "Subiendo…"
              : availableSlots > 0
                ? `+ Elegir hasta ${availableSlots} foto(s)`
                : "Cupo preparado"
          }

          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            disabled={
              props.busy
              || availableSlots === 0
            }
            onChange={(
              event,
            ) => {
              addFiles(
                event.target.files,
              );

              event.target.value =
                "";
            }}
          />
        </label>

        <button
          type="button"
          className="media-confirm-batch"
          disabled={
            props.busy
            || selectedImages.length === 0
          }
          onClick={() =>
            void confirmUpload()
          }
        >
          {
            props.busy
              ? "Guardando fotografías…"
              : `Guardar ${
                  selectedImages.length
                } foto(s)`
          }
        </button>
      </div>


      {notice ? (
        <p className="media-batch-notice">
          {notice}
        </p>
      ) : null}
    </article>
  );
}
