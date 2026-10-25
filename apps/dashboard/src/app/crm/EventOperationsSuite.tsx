"use client";

import {
  EventAdvancedCommandCenter,
} from "./EventAdvancedCommandCenter";

import {
  EventOperationsErrorBoundary,
} from "./EventOperationsErrorBoundary";

import {
  EventContractsOperationsPanel,
} from "./EventContractsOperationsPanel";

import {
  EventFinanceOperationsPanel,
} from "./EventFinanceOperationsPanel";

import {
  EventOperationalTimeline,
} from "./EventOperationalTimeline";

import {
  EventOperations360Panel,
} from "./EventOperations360Panel";

import {
  EventOperationsProvider,
} from "./EventOperationsContext";

import {
  EventPaymentsOperationsPanel,
} from "./EventPaymentsOperationsPanel";

import {
  EventProviderQueuePanel,
} from "./EventProviderQueuePanel";

import {
  EventQuotesOperationsPanel,
} from "./EventQuotesOperationsPanel";

export function EventOperationsSuite({
  eventId,
}: {
  eventId: string;
}) {
  return (
    <EventOperationsProvider
      eventId={eventId}
    >
      <EventOperationsErrorBoundary>
      <section
        style={{
          display:
            "grid",
          gap:
            18,
        }}
      >
        <Panel
          title="Command Center"
        >
          <EventAdvancedCommandCenter />
        </Panel>

        <Panel
          title="Estado operativo"
        >
          <EventOperations360Panel
            eventId={eventId}
          />
        </Panel>

        <Panel
          title="Proveedores"
        >
          <EventProviderQueuePanel
            eventId={eventId}
          />
        </Panel>

        <Panel
          title="Timeline"
        >
          <EventOperationalTimeline
            eventId={eventId}
          />
        </Panel>

        <div
          style={{
            display:
              "grid",
            gridTemplateColumns:
              "repeat(auto-fit,minmax(300px,1fr))",
            gap:
              14,
          }}
        >
          <Panel
            title="Finanzas"
          >
            <EventFinanceOperationsPanel
              eventId={eventId}
            />
          </Panel>

          <Panel
            title="Pagos"
          >
            <EventPaymentsOperationsPanel
              eventId={eventId}
            />
          </Panel>

          <Panel
            title="Contratos"
          >
            <EventContractsOperationsPanel
              eventId={eventId}
            />
          </Panel>

          <Panel
            title="Presupuestos"
          >
            <EventQuotesOperationsPanel
              eventId={eventId}
            />
          </Panel>
        </div>
      </section>
      </EventOperationsErrorBoundary>
    </EventOperationsProvider>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children:
    React.ReactNode;
}) {
  return (
    <section
      style={{
        border:
          "1px solid rgba(120,120,120,.15)",
        borderRadius:
          14,
        padding:
          15,
      }}
    >
      <header
        style={{
          marginBottom:
            12,
        }}
      >
        <h3
          style={{
            margin:
              0,
        }}
      >
        {title}
      </h3>
      </header>

      {children}
    </section>
  );
}
