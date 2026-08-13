"use client";

import {
  useEffect,
  useState,
} from "react";

import styles
  from "./whatsapp-business.module.css";

type Profile = {
  about?: string;
  address?: string;
  description?: string;
  email?: string;
  profile_picture_url?: string;
  websites?: string[];
  vertical?: string;
};

type Identity = {
  id?: string;
  verified_name?: string;
  display_phone_number?: string;
  quality_rating?: string;
  name_status?: string;
  new_name_status?: string;
};

function nameStatusLabel(
  status?: string,
) {
  switch (status) {
    case "APPROVED":
      return "Nombre aprobado";

    case "AVAILABLE_WITHOUT_REVIEW":
      return "Disponible para usar";

    case "PENDING_REVIEW":
      return "En revisión por Meta";

    case "DECLINED":
      return "Nombre rechazado";

    case "EXPIRED":
      return "Solicitud vencida";

    case "NONE":
    case undefined:
    case null:
      return "Sin estado pendiente";

    default:
      return status;
  }
}


function newNameStatusLabel(
  status?: string,
) {
  switch (status) {
    case "APPROVED":
      return "Nuevo nombre aprobado";

    case "PENDING_REVIEW":
      return "Cambio en revisión";

    case "DECLINED":
      return "Cambio rechazado";

    case "EXPIRED":
      return "Cambio vencido";

    case "NONE":
    case undefined:
    case null:
      return "Sin cambios pendientes";

    default:
      return status;
  }
}


function nameStatusTone(
  status?: string,
) {
  if (
    status === "APPROVED"
    || status === "AVAILABLE_WITHOUT_REVIEW"
  ) {
    return "success";
  }

  if (
    status === "DECLINED"
    || status === "EXPIRED"
  ) {
    return "danger";
  }

  if (
    status === "PENDING_REVIEW"
  ) {
    return "warning";
  }

  return "neutral";
}


const apiUrl = (
  process.env.NEXT_PUBLIC_API_URL
  || "https://panel.fulanitasfabrica.site/api"
).replace(
  /\/+$/,
  "",
);

export default function WhatsappBusinessClient() {
  const [
    profile,
    setProfile,
  ] =
    useState<Profile>({});

  const [
    identity,
    setIdentity,
  ] =
    useState<Identity>({});

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
    message,
    setMessage,
  ] =
    useState("");

  const [
    pictureFile,
    setPictureFile,
  ] =
    useState<File | null>(
      null,
    );

  const [
    picturePreview,
    setPicturePreview,
  ] =
    useState<string | null>(
      null,
    );

  const [
    uploadingPicture,
    setUploadingPicture,
  ] =
    useState(
      false,
    );

  async function load() {
    setLoading(true);
    setMessage("");

    try {
      const response =
        await fetch(
          `${apiUrl}/admin/whatsapp-business/profile`,
          {
            credentials:
              "include",

            cache:
              "no-store",
          },
        );

      const body =
        await response.json();

      if (!response.ok) {
        throw new Error(
          body?.error
          || "No se pudo cargar el perfil.",
        );
      }

      setProfile(
        body?.profile
        ?? {},
      );

      setIdentity(
        body?.identity
        ?? {},
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : String(error),
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(
    () => {
      void load();
    },
    [],
  );

  function update(
    field: keyof Profile,
    value: string | string[],
  ) {
    setProfile(
      (current) => ({
        ...current,
        [field]:
          value,
      }),
    );
  }

  async function uploadProfilePicture() {
    if (!pictureFile) {
      return;
    }

    setUploadingPicture(
      true,
    );

    setMessage(
      "",
    );

    try {
      const formData =
        new FormData();

      formData.append(
        "file",
        pictureFile,
      );

      const response =
        await fetch(
          `${apiUrl}/admin/whatsapp-business/profile-picture`,
          {
            method:
              "POST",

            credentials:
              "include",

            body:
              formData,
          },
        );

      const body =
        await response.json();

      if (!response.ok) {
        throw new Error(
          body?.error
          || "No se pudo cambiar la foto.",
        );
      }

      if (body?.profile) {
        setProfile(
          body.profile,
        );
      }

      setPictureFile(
        null,
      );

      setPicturePreview(
        null,
      );

      setMessage(
        "Foto de perfil actualizada correctamente en WhatsApp.",
      );

      await load();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : String(error),
      );
    } finally {
      setUploadingPicture(
        false,
      );
    }
  }


  async function save() {
    setSaving(true);
    setMessage("");

    try {
      const response =
        await fetch(
          `${apiUrl}/admin/whatsapp-business/profile`,
          {
            method:
              "PUT",

            credentials:
              "include",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                about:
                  profile.about
                  ?? "",

                description:
                  profile.description
                  ?? "",

                address:
                  profile.address
                  ?? "",

                email:
                  profile.email
                  ?? "",

                websites:
                  profile.websites
                  ?? [],

                vertical:
                  profile.vertical
                  ?? "APPAREL",
              }),
          },
        );

      const body =
        await response.json();

      if (!response.ok) {
        throw new Error(
          body?.error
          || "No se pudo guardar.",
        );
      }

      setProfile(
        body?.profile
        ?? profile,
      );

      setMessage(
        "Perfil actualizado correctamente en WhatsApp.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : String(error),
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className={styles.panel}>
        Cargando perfil de WhatsApp...
      </section>
    );
  }

  return (
    <div className={styles.layout}>
      <section className={styles.panel}>
        <div className={styles.header}>
          <div className={styles.pictureControl}>
            <div className={styles.avatar}>
              {
                picturePreview
                ? (
                  <img
                    src={
                      picturePreview
                    }
                    alt="Vista previa"
                  />
                )
                : profile.profile_picture_url
                  ? (
                    <img
                      src={
                        profile
                          .profile_picture_url
                      }
                      alt="WhatsApp Business"
                    />
                  )
                  : "WA"
              }
            </div>

            <label
              className={
                styles.changePicture
              }
            >
              Cambiar foto

              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={
                  (event) => {
                    const file =
                      event
                        .target
                        .files
                        ?.[0]
                      ?? null;

                    setPictureFile(
                      file,
                    );

                    if (!file) {
                      setPicturePreview(
                        null,
                      );

                      return;
                    }

                    setPicturePreview(
                      URL.createObjectURL(
                        file,
                      ),
                    );
                  }
                }
              />
            </label>

            {
              pictureFile
                ? (
                  <button
                    type="button"
                    className={
                      styles.savePicture
                    }
                    disabled={
                      uploadingPicture
                    }
                    onClick={
                      () =>
                        void uploadProfilePicture()
                    }
                  >
                    {
                      uploadingPicture
                        ? "Subiendo..."
                        : "Guardar foto"
                    }
                  </button>
                )
                : null
            }
          </div>

          <div>
            <span className={styles.eyebrow}>
              PERFIL COMERCIAL
            </span>

            <h2>
              {
                identity.verified_name
                || "WhatsApp Business"
              }
            </h2>

            <p>
              {
                identity.display_phone_number
                || "Número conectado"
              }

              {
                identity.quality_rating
                  ? ` · Calidad ${identity.quality_rating}`
                  : ""
              }
            </p>

            <div className={styles.identityMeta}>
              <span
                data-tone={
                  nameStatusTone(
                    identity.name_status,
                  )
                }
              >
                {
                  nameStatusLabel(
                    identity.name_status,
                  )
                }
              </span>

              <span
                data-tone={
                  nameStatusTone(
                    identity.new_name_status,
                  )
                }
              >
                {
                  newNameStatusLabel(
                    identity.new_name_status,
                  )
                }
              </span>
            </div>

            <div className={styles.nameActions}>
              <button
                type="button"
                className={styles.manageName}
                onClick={
                  () => {
                    window.open(
                      "https://business.facebook.com/wa/manage/",
                      "_blank",
                      "noopener,noreferrer",
                    );
                  }
                }
              >
                Gestionar cambio de nombre
              </button>

              <small>
                Meta revisa los cambios de nombre antes de aplicarlos.
              </small>
            </div>
          </div>
        </div>

        {
          message
            ? (
              <div className={styles.message}>
                {message}
              </div>
            )
            : null
        }

        <div className={styles.form}>
          <label>
            <span>
              Descripción corta
            </span>

            <input
              maxLength={139}
              value={
                profile.about
                ?? ""
              }
              onChange={
                (event) =>
                  update(
                    "about",
                    event.target.value,
                  )
              }
              placeholder="Venta mayorista de indumentaria"
            />
          </label>

          <label>
            <span>
              Email
            </span>

            <input
              type="email"
              value={
                profile.email
                ?? ""
              }
              onChange={
                (event) =>
                  update(
                    "email",
                    event.target.value,
                  )
              }
              placeholder="ventas@empresa.com"
            />
          </label>

          <label className={styles.full}>
            <span>
              Descripción comercial
            </span>

            <textarea
              rows={4}
              value={
                profile.description
                ?? ""
              }
              onChange={
                (event) =>
                  update(
                    "description",
                    event.target.value,
                  )
              }
            />
          </label>

          <label>
            <span>
              Dirección
            </span>

            <input
              value={
                profile.address
                ?? ""
              }
              onChange={
                (event) =>
                  update(
                    "address",
                    event.target.value,
                  )
              }
            />
          </label>

          <label>
            <span>
              Sitio web
            </span>

            <input
              value={
                profile.websites?.[0]
                ?? ""
              }
              onChange={
                (event) =>
                  update(
                    "websites",
                    event.target.value
                      ? [
                          event.target.value,
                        ]
                      : [],
                  )
              }
              placeholder="https://..."
            />
          </label>

          <label>
            <span>
              Categoría
            </span>

            <select
              value={
                profile.vertical
                ?? "APPAREL"
              }
              onChange={
                (event) =>
                  update(
                    "vertical",
                    event.target.value,
                  )
              }
            >
              <option value="APPAREL">
                Indumentaria
              </option>

              <option value="RETAIL">
                Retail
              </option>

              <option value="BEAUTY">
                Belleza
              </option>

              <option value="RESTAURANT">
                Restaurante
              </option>

              <option value="PROF_SERVICES">
                Servicios profesionales
              </option>

              <option value="OTHER">
                Otros
              </option>
            </select>
          </label>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.secondary}
            onClick={
              () =>
                void load()
            }
          >
            Recargar desde Meta
          </button>

          <button
            type="button"
            className={styles.primary}
            disabled={saving}
            onClick={
              () =>
                void save()
            }
          >
            {
              saving
                ? "Guardando..."
                : "Guardar en WhatsApp"
            }
          </button>
        </div>
      </section>

      <aside className={styles.panel}>
        <span className={styles.eyebrow}>
          CATÁLOGO META
        </span>

        <h3>
          Sin catálogo conectado
        </h3>

        <p className={styles.muted}>
          Todavía no existe un catálogo de productos asociado a este WhatsApp Business.
        </p>

        <div className={styles.status}>
          Pendiente de configuración
        </div>
      </aside>
    </div>
  );
}
