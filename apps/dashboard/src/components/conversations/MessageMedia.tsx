"use client";

import {
  useState,
} from "react";

type Props = {
  messageId?: string;
  messageType?: string;
  body?: string;
  media?: Record<string, unknown>;
};

function protectedMediaUrl(
  messageId: string,
) {
  return (
    `/dashboard-api/messages/`
    + `${encodeURIComponent(messageId)}`
    + "/media"
  );
}

function stringValue(
  value: unknown,
) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

export function MessageMedia({
  messageId,
  messageType,
  body,
  media,
}: Props) {
  const [
    failed,
    setFailed,
  ] =
    useState(false);

  const [
    expanded,
    setExpanded,
  ] =
    useState(false);

  const directUrl =
    stringValue(
      media?.url,
    );

  const mediaId =
    stringValue(
      media?.id,
    );

  const url =
    messageId
    && (
      directUrl
      || mediaId
    )
      ? protectedMediaUrl(
          messageId,
        )
      : "";

  const caption =
    stringValue(
      media?.caption,
    )
    || (
      messageType === "image"
        ? stringValue(body)
        : ""
    );

  const filename =
    stringValue(
      media?.filename,
    )
    || "Descargar archivo";


  if (
    !messageType
    || ![
      "image",
      "audio",
      "video",
      "document",
    ].includes(
      messageType,
    )
  ) {
    return null;
  }

  if (!url) {
    return (
      <div
        style={{
          padding:
            "9px 11px",

          color:
            "#92400e",

          background:
            "#fffbeb",

          border:
            "1px solid #fde68a",

          borderRadius:
            10,

          fontSize:
            11,

          fontWeight:
            750,
        }}
      >
        El mensaje no tiene un archivo multimedia disponible.
      </div>
    );
  }

  if (failed) {
    return (
      <div
        style={{
          padding:
            "9px 11px",

          color:
            "#b91c1c",

          background:
            "#fef2f2",

          border:
            "1px solid #fecaca",

          borderRadius:
            10,

          fontSize:
            11,

          fontWeight:
            750,
        }}
      >
        No se pudo cargar este archivo.
      </div>
    );
  }

  if (
    messageType
    === "image"
  ) {
    return (
      <>
        <button
          type="button"
          onClick={
            () =>
              setExpanded(true)
          }
          style={{
            display:
              "block",

            maxWidth:
              "100%",

            padding:
              0,

            overflow:
              "hidden",

            background:
              "#e2e8f0",

            border:
              0,

            borderRadius:
              13,

            cursor:
              "zoom-in",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={
              caption
              || "Imagen de WhatsApp"
            }
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={
              () =>
                setFailed(true)
            }
            style={{
              display:
                "block",

              width:
                "100%",

              minWidth:
                180,

              maxWidth:
                430,

              maxHeight:
                390,

              objectFit:
                "cover",
            }}
          />
        </button>

        {caption ? (
          <div
            style={{
              marginTop:
                7,

              whiteSpace:
                "pre-wrap",
            }}
          >
            {caption}
          </div>
        ) : null}

        {expanded ? (
          <div
            role="dialog"
            aria-modal="true"
            onClick={
              () =>
                setExpanded(false)
            }
            style={{
              position:
                "fixed",

              inset:
                0,

              zIndex:
                9999,

              display:
                "grid",

              placeItems:
                "center",

              padding:
                24,

              background:
                "rgba(2,6,23,.88)",

              cursor:
                "zoom-out",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={
                caption
                || "Imagen ampliada"
              }
              referrerPolicy="no-referrer"
              onError={
                () =>
                  setFailed(true)
              }
              style={{
                maxWidth:
                  "94vw",

                maxHeight:
                  "91vh",

                objectFit:
                  "contain",

                borderRadius:
                  15,

                boxShadow:
                  "0 28px 90px rgba(0,0,0,.55)",
              }}
            />
          </div>
        ) : null}
      </>
    );
  }

  if (
    messageType
    === "audio"
  ) {
    return (
      <div
        style={{
          display:
            "grid",

          gap:
            7,

          minWidth:
            260,
        }}
      >
        <audio
          controls
          preload="metadata"
          src={url}
          onError={
            () =>
              setFailed(true)
          }
          style={{
            width:
              "min(350px, 100%)",
          }}
        />

        {body ? (
          <details
            style={{
              fontSize:
                11,
            }}
          >
            <summary
              style={{
                cursor:
                  "pointer",

                fontWeight:
                  800,
              }}
            >
              Ver transcripción
            </summary>

            <div
              style={{
                marginTop:
                  7,

                whiteSpace:
                  "pre-wrap",
              }}
            >
              {body}
            </div>
          </details>
        ) : null}
      </div>
    );
  }

  if (
    messageType
    === "video"
  ) {
    return (
      <video
        controls
        preload="metadata"
        src={url}
        onError={
          () =>
            setFailed(true)
        }
        style={{
          width:
            "min(430px, 100%)",

          maxHeight:
            390,

          borderRadius:
            13,

          background:
            "#020617",
        }}
      />
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      style={{
        display:
          "inline-flex",

        alignItems:
          "center",

        gap:
          8,

        padding:
          "10px 12px",

        color:
          "#075985",

        background:
          "#f0f9ff",

        border:
          "1px solid #bae6fd",

        borderRadius:
          11,

        fontSize:
          12,

        fontWeight:
          850,

        textDecoration:
          "none",
      }}
    >
      Descargar · {filename}
    </a>
  );
}
