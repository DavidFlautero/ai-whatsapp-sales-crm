"use client";

import {
  useMemo,
  useState,
} from "react";

type TimelineMessage = {
  id: string;
  direction: string | null;
  createdAt: string;
  type: string | null;
  text: string | null;
};

type Direction =
  | "incoming"
  | "outgoing"
  | "unknown";

type Filter =
  | "all"
  | Direction;

function resolveDirection(
  value: string | null,
): Direction {
  const normalized =
    value?.trim().toLowerCase() || "";

  if (
    normalized === "inbound" ||
    normalized === "incoming" ||
    normalized === "received"
  ) {
    return "incoming";
  }

  if (
    normalized === "outbound" ||
    normalized === "outgoing" ||
    normalized === "sent"
  ) {
    return "outgoing";
  }

  return "unknown";
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Fecha sin determinar";
  }

  return date.toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const LABELS: Record<Direction, string> = {
  incoming: "Cliente / contacto",
  outgoing: "Eventos Mediterráneo",
  unknown: "Remitente sin identificar",
};

const SYMBOLS: Record<Direction, string> = {
  incoming: "↙",
  outgoing: "↗",
  unknown: "?",
};

export default function CommercialConversationTimeline({
  messages,
}: {
  messages: TimelineMessage[];
}) {
  const [filter, setFilter] =
    useState<Filter>("all");

  const normalized = useMemo(
    () =>
      messages.map(message => ({
        ...message,
        sender: resolveDirection(
          message.direction,
        ),
      })),
    [messages],
  );

  const counts = useMemo(
    () => ({
      all: normalized.length,

      incoming: normalized.filter(
        item => item.sender === "incoming",
      ).length,

      outgoing: normalized.filter(
        item => item.sender === "outgoing",
      ).length,

      unknown: normalized.filter(
        item => item.sender === "unknown",
      ).length,
    }),
    [normalized],
  );

  const visible = useMemo(
    () =>
      filter === "all"
        ? normalized
        : normalized.filter(
            item => item.sender === filter,
          ),
    [normalized, filter],
  );

  return (
    <div className="cm-chat">
      <div className="cm-chat-toolbar">
        <div className="cm-chat-legend">
          <span className="cm-chat-legend-item">
            <i className="cm-chat-dot cm-chat-dot--incoming" />
            Cliente / contacto
          </span>

          <span className="cm-chat-legend-item">
            <i className="cm-chat-dot cm-chat-dot--outgoing" />
            Nosotros
          </span>

          {counts.unknown > 0 && (
            <span className="cm-chat-legend-item">
              <i className="cm-chat-dot cm-chat-dot--unknown" />
              Sin identificar
            </span>
          )}
        </div>

        <div
          className="cm-chat-filters"
          role="group"
          aria-label="Filtrar mensajes"
        >
          {([
            ["all", "Todos"],
            ["incoming", "Recibidos"],
            ["outgoing", "Enviados"],
            ["unknown", "Sin identificar"],
          ] as const)
            .filter(
              ([value]) =>
                value !== "unknown" ||
                counts.unknown > 0,
            )
            .map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                aria-pressed={filter === value}
                className={
                  filter === value
                    ? "cm-chat-filter cm-chat-filter--active"
                    : "cm-chat-filter"
                }
              >
                {label}
                <span>{counts[value]}</span>
              </button>
            ))}
        </div>
      </div>

      <div
        className="cm-chat-messages"
        aria-label="Historial de conversación"
      >
        {visible.map(message => (
          <div
            key={message.id}
            className={
              `cm-chat-row cm-chat-row--${message.sender}`
            }
          >
            <article
              className={
                `cm-chat-bubble cm-chat-bubble--${message.sender}`
              }
            >
              <header className="cm-chat-bubble-header">
                <span className="cm-chat-sender">
                  <span
                    className="cm-chat-direction"
                    aria-hidden="true"
                  >
                    {SYMBOLS[message.sender]}
                  </span>

                  {LABELS[message.sender]}
                </span>

                <time
                  dateTime={message.createdAt}
                  className="cm-chat-time"
                >
                  {formatDate(message.createdAt)}
                </time>
              </header>

              <div className="cm-chat-text">
                {message.text ||
                  `Contenido ${
                    message.type || "desconocido"
                  } pendiente de interpretación`}
              </div>

              <footer className="cm-chat-bubble-footer">
                {message.sender === "outgoing"
                  ? "Mensaje enviado"
                  : message.sender === "incoming"
                    ? "Mensaje recibido"
                    : "Dirección no confirmada"}
              </footer>
            </article>
          </div>
        ))}

        {visible.length === 0 && (
          <div className="cm-chat-empty">
            {messages.length === 0
              ? "No hay mensajes asociados a este expediente."
              : "No hay mensajes en este filtro."}
          </div>
        )}
      </div>
    </div>
  );
}
