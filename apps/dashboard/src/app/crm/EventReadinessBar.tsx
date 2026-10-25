"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import type {
  EventReadiness,
} from "./event-service.types";

import styles
  from "./event-readiness.module.css";


type Props = {
  eventId: string;
};


export function EventReadinessBar({
  eventId,
}: Props) {
  const [
    readiness,
    setReadiness,
  ] =
    useState<
      EventReadiness | null
    >(null);

  const [
    loading,
    setLoading,
  ] =
    useState(
      true,
    );


  const load =
    useCallback(
      async () => {
        try {
          const response =
            await fetch(
              `/api/crm/events/${eventId}/readiness`,
              {
                cache:
                  "no-store",
              },
            );

          if (
            !response.ok
          ) {
            return;
          }

          const body =
            await response.json();

          setReadiness(
            body.readiness
            ?? null,
          );
        } finally {
          setLoading(
            false,
          );
        }
      },
      [
        eventId,
      ],
    );


  useEffect(
    () => {
      void load();

      const listener =
        (
          event:
            Event,
        ) => {
          const custom =
            event as
              CustomEvent<{
                eventId?:
                  string;
              }>;

          if (
            !custom.detail
              ?.eventId
            ||
            custom.detail
              .eventId
              === eventId
          ) {
            void load();
          }
        };

      window.addEventListener(
        "event-service-updated",
        listener,
      );

      return () => {
        window.removeEventListener(
          "event-service-updated",
          listener,
        );
      };
    },
    [
      eventId,
      load,
    ],
  );


  if (
    loading
    && !readiness
  ) {
    return null;
  }


  if (
    !readiness
  ) {
    return null;
  }


  const percent =
    Number(
      readiness
        .readiness_percent
      ?? 0,
    );

  const critical =
    Number(
      readiness
        .critical_pending
      ?? 0,
    );

  const withoutProvider =
    Number(
      readiness
        .without_provider
      ?? 0,
    );

  const payments =
    Number(
      readiness
        .payments_pending
      ?? 0,
    );


  return (
    <section
      className={
        styles.root
      }
    >
      <div
        className={
          styles.top
        }
      >
        <div>
          <span>
            Preparación del evento
          </span>

          <strong>
            {percent}%
          </strong>
        </div>

        <div
          className={
            critical > 0
              ? styles.risk
              : styles.ready
          }
        >
          {critical > 0
            ? `${critical} servicio${
                critical === 1
                  ? ""
                  : "s"
              } crítico${
                critical === 1
                  ? ""
                  : "s"
              } pendiente${
                critical === 1
                  ? ""
                  : "s"
              }`
            : "Sin bloqueos críticos"}
        </div>
      </div>

      <div
        className={
          styles.track
        }
      >
        <div
          className={
            styles.progress
          }
          style={{
            width:
              `${Math.min(
                100,
                Math.max(
                  0,
                  percent,
                ),
              )}%`,
          }}
        />
      </div>

      <div
        className={
          styles.facts
        }
      >
        <span>
          {Number(
            readiness
              .closed_services
            ?? 0,
          )} confirmados
        </span>

        <span>
          {Number(
            readiness
              .open_services
            ?? 0,
          )} pendientes
        </span>

        <span>
          {withoutProvider}
          {" "}sin proveedor
        </span>

        <span>
          {payments}
          {" "}con pago pendiente
        </span>
      </div>
    </section>
  );
}
