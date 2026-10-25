"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  canRequest,
  getCircuitState,
  requestFailed,
  requestSucceeded,
} from "./event-circuit-breaker";

export type EventRequirement360 = {
  id?: string;
  service_name?: string | null;
  service_status?: string | null;
  is_critical?: boolean | null;
  assigned_provider_id?: string | null;
  responsible_team_member_id?: string | null;
  provider_cost?: number | string | null;
  client_price?: number | string | null;
  deposit_required?: number | string | null;
  deposit_paid?: number | string | null;
  provider_payment_due_date?: string | null;
  contract_status?: string | null;
  arrival_time?: string | null;
  setup_time?: string | null;
  technical_needs?: string | null;
  operational_notes?: string | null;
  max_budget?: number | string | null;
};

export type Event360Data = {
  event?: {
    id?: string;
    title?: string | null;
    event_type?: string | null;
    event_date?: string | null;
    event_end_date?: string | null;
    guest_count?: number | null;
    city?: string | null;
    province?: string | null;
    status?: string | null;
    target_budget?: number | string | null;
  };

  readiness?: {
    readiness_percent?: number | string | null;
    critical_pending?: number | string | null;
    without_provider?: number | string | null;
    payments_pending?: number | string | null;
  } | null;

  requirements?: EventRequirement360[];

  availability?: Array<{
    id?: string;
    provider_id?: string | null;
    requirement_id?: string | null;
    status?: string | null;
    checked_at?: string | null;
  }>;

  quotes?: Array<Record<string, unknown>>;

  counters?: Record<string, number>;
};

type OperationsContextValue = {
  data: Event360Data | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  lastUpdatedAt: number | null;
  stale: boolean;
  refresh: () => Promise<void>;
};

const EventOperationsContext =
  createContext<
    OperationsContextValue
    | null
  >(null);

export function EventOperationsProvider({
  eventId,
  children,
}: {
  eventId: string;
  children: React.ReactNode;
}) {
  const [
    data,
    setData,
  ] =
    useState<
      Event360Data
      | null
    >(null);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    refreshing,
    setRefreshing,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState<
      string
      | null
    >(null);

  const [
    lastUpdatedAt,
    setLastUpdatedAt,
  ] =
    useState<
      number
      | null
    >(null);

  const mountedRef =
    useRef(true);

  const inFlightRef =
    useRef<
      Promise<void>
      | null
    >(null);

  const refresh =
    useCallback(
      async () => {
        if (
          inFlightRef.current
        ) {
          return (
            inFlightRef.current
          );
        }

        const circuitKey =
          `event360:${eventId}`;

        if (
          !canRequest(
            circuitKey,
          )
        ) {
          setError(
            `EVENT_360_CIRCUIT_${getCircuitState(circuitKey).toUpperCase()}`,
          );

          return;
        }

        const job =
          (async () => {
            try {
              setRefreshing(true);
              setError(null);

              const response =
                await fetch(
                  `/api/crm/events/${eventId}/360`,
                  {
                    credentials:
                      "include",
                    cache:
                      "no-store",
                  },
                );

              const body =
                await response
                  .json()
                  .catch(
                    () => ({}),
                  );

              if (
                !response.ok
              ) {
                throw new Error(
                  String(
                    body?.error
                    ?? `HTTP_${response.status}`,
                  ),
                );
              }

              requestSucceeded(
                circuitKey,
              );

              if (
                mountedRef.current
              ) {
                setData(body);
                setLastUpdatedAt(
                  Date.now(),
                );
              }
            } catch (
              caught
            ) {
              requestFailed(
                circuitKey,
              );

              if (
                mountedRef.current
              ) {
                setError(
                  caught
                    instanceof Error
                    ? caught.message
                    : "EVENT_360_LOAD_FAILED",
                );
              }
            } finally {
              if (
                mountedRef.current
              ) {
                setLoading(false);
                setRefreshing(false);
              }

              inFlightRef.current =
                null;
            }
          })();

        inFlightRef.current =
          job;

        return job;
      },
      [
        eventId,
      ],
    );

  useEffect(
    () => {
      mountedRef.current =
        true;

      void refresh();

      let interval:
        number
        | null =
          null;

      function schedulePolling() {
        if (
          interval !== null
        ) {
          window.clearInterval(
            interval,
          );
        }

        const delay =
          document.hidden
            ? 300000
            : 60000;

        interval =
          window.setInterval(
            () => {
              if (
                navigator.onLine
              ) {
                void refresh();
              }
            },
            delay,
          );
      }

      function eventRefresh() {
        void refresh();
      }

      function visibilityChanged() {
        schedulePolling();

        if (
          !document.hidden
          && navigator.onLine
        ) {
          void refresh();
        }
      }

      function onlineChanged() {
        schedulePolling();
        void refresh();
      }

      schedulePolling();

      window.addEventListener(
        "event-service-updated",
        eventRefresh,
      );

      window.addEventListener(
        "event-operations-refresh",
        eventRefresh,
      );

      window.addEventListener(
        "online",
        onlineChanged,
      );

      document.addEventListener(
        "visibilitychange",
        visibilityChanged,
      );

      return () => {
        mountedRef.current =
          false;

        if (
          interval !== null
        ) {
          window.clearInterval(
            interval,
          );
        }

        window.removeEventListener(
          "event-service-updated",
          eventRefresh,
        );

        window.removeEventListener(
          "event-operations-refresh",
          eventRefresh,
        );

        window.removeEventListener(
          "online",
          onlineChanged,
        );

        document.removeEventListener(
          "visibilitychange",
          visibilityChanged,
        );
      };
    },
    [
      refresh,
    ],
  );

  const stale =
    lastUpdatedAt
      ? Date.now()
        - lastUpdatedAt
        > 120000
      : false;

  const value =
    useMemo(
      () => ({
        data,
        loading,
        refreshing,
        error,
        lastUpdatedAt,
        stale,
        refresh,
      }),
      [
        data,
        loading,
        refreshing,
        error,
        lastUpdatedAt,
        stale,
        refresh,
      ],
    );

  return (
    <EventOperationsContext.Provider
      value={value}
    >
      {children}
    </EventOperationsContext.Provider>
  );
}

export function useEventOperations() {
  const context =
    useContext(
      EventOperationsContext,
    );

  if (
    !context
  ) {
    throw new Error(
      "useEventOperations must be used inside EventOperationsProvider",
    );
  }

  return context;
}
