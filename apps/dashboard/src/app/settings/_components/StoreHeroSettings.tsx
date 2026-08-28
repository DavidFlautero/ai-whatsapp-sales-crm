"use client";

import {
  useEffect,
  useState,
} from "react";

export function StoreHeroSettings() {
  const [
    currentUrl,
    setCurrentUrl,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const [
    loading,
    setLoading,
  ] =
    useState(
      false,
    );

  const [
    message,
    setMessage,
  ] =
    useState(
      "",
    );

  useEffect(() => {
    void fetch(
      "/dashboard-api/settings/store-hero",
      {
        cache:
          "no-store",
      },
    )
      .then(
        (response) =>
          response.json(),
      )
      .then(
        (data) => {
          if (
            data?.url
          ) {
            setCurrentUrl(
              data.url,
            );
          }
        },
      )
      .catch(
        () => {},
      );
  }, []);

  async function upload(
    file:
      File,
  ) {
    setLoading(
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
        file,
      );

      const response =
        await fetch(
          "/dashboard-api/settings/store-hero",
          {
            method:
              "POST",

            body:
              formData,
          },
        );

      const data =
        await response.json();

      if (
        !response.ok
        || !data?.url
      ) {
        throw new Error(
          data?.error
          || "No se pudo subir la imagen",
        );
      }

      setCurrentUrl(
        data.url,
      );

      setMessage(
        "Imagen actualizada correctamente.",
      );
    } catch (
      error
    ) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Error al subir la imagen",
      );
    } finally {
      setLoading(
        false,
      );
    }
  }

  return (
    <section
      style={{
        marginTop:
          24,

        padding:
          24,

        border:
          "1px solid #e5e7eb",

        borderRadius:
          18,

        background:
          "#fff",
      }}
    >
      <div
        style={{
          display:
            "flex",

          justifyContent:
            "space-between",

          gap:
            24,

          alignItems:
            "center",

          flexWrap:
            "wrap",
        }}
      >
        <div>
          <div
            style={{
              fontSize:
                12,

              fontWeight:
                900,

              letterSpacing:
                ".08em",

              color:
                "#9a6c2c",
            }}
          >
            TIENDA ONLINE
          </div>

          <h2
            style={{
              margin:
                "8px 0 6px",
            }}
          >
            Imagen principal del catálogo
          </h2>

          <p
            style={{
              margin:
                0,

              color:
                "#667085",

              maxWidth:
                560,
            }}
          >
            Esta imagen aparece en el hero
            de la tienda mayorista y minorista.
          </p>
        </div>

        <label
          style={{
            cursor:
              loading
                ? "wait"
                : "pointer",

            padding:
              "11px 18px",

            borderRadius:
              999,

            background:
              "#17191d",

            color:
              "#fff",

            fontWeight:
              800,
          }}
        >
          {loading
            ? "Subiendo..."
            : "Subir imagen"}

          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={
              loading
            }
            style={{
              display:
                "none",
            }}
            onChange={
              (event) => {
                const file =
                  event.target
                    .files?.[0];

                if (
                  file
                ) {
                  void upload(
                    file,
                  );
                }
              }
            }
          />
        </label>
      </div>

      {currentUrl ? (
        <div
          style={{
            marginTop:
              22,
          }}
        >
          <img
            src={
              currentUrl
            }
            alt="Hero de tienda"
            style={{
              width:
                220,

              height:
                220,

              objectFit:
                "cover",

              borderRadius:
                999,

              border:
                "6px solid #f3f4f6",
            }}
          />
        </div>
      ) : null}

      {message ? (
        <p
          style={{
            marginTop:
              14,

            fontWeight:
              700,
          }}
        >
          {message}
        </p>
      ) : null}
    </section>
  );
}
