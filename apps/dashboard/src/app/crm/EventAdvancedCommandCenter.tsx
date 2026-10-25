import {
  EventActionQueue,
} from "./EventActionQueue";

import {
  EventBudgetVariance,
} from "./EventBudgetVariance";

import {
  EventClosureCockpit,
} from "./EventClosureCockpit";

import {
  EventDataQualityPanel,
} from "./EventDataQualityPanel";

import {
  EventDependencyGraph,
} from "./EventDependencyGraph";

import {
  EventExecutionMode,
} from "./EventExecutionMode";

import {
  EventIncidentMatrix,
} from "./EventIncidentMatrix";

import {
  EventPremortemPanel,
} from "./EventPremortemPanel";

import {
  EventProviderConcentration,
} from "./EventProviderConcentration";

import {
  EventReadinessConfidence,
} from "./EventReadinessConfidence";

import {
  EventRunbookPanel,
} from "./EventRunbookPanel";

import {
  EventScenarioPlanner,
} from "./EventScenarioPlanner";

import {
  EventSLAHeatmap,
} from "./EventSLAHeatmap";

"use client";

import {
  EventAutoChecklist,
} from "./EventAutoChecklist";

import {
  EventCashflowForecast,
} from "./EventCashflowForecast";

import {
  EventContractGapPanel,
} from "./EventContractGapPanel";

import {
  EventCriticalPathPanel,
} from "./EventCriticalPathPanel";

import {
  EventExecutiveDecisionBrief,
} from "./EventExecutiveDecisionBrief";

import {
  EventMarginStressLab,
} from "./EventMarginStressLab";

import {
  EventProviderResiliencePanel,
} from "./EventProviderResiliencePanel";

import {
  EventQuoteHealthPanel,
} from "./EventQuoteHealthPanel";

import {
  EventRiskCommandPanel,
} from "./EventRiskCommandPanel";

import {
  EventSLAWatchdog,
} from "./EventSLAWatchdog";

export function EventAdvancedCommandCenter() {
  return (
    <section
      style={{
        display:
          "grid",
        gap:
          14,
      }}
    >
      <Panel>
        <EventExecutiveDecisionBrief />
      </Panel>

      <div
        style={{
          display:
            "grid",
          gridTemplateColumns:
            "repeat(auto-fit,minmax(320px,1fr))",
          gap:
            14,
        }}
      >
        <Panel>
          <EventRiskCommandPanel />
        </Panel>

        <Panel>
          <EventSLAWatchdog />
        </Panel>

        <Panel>
          <EventCriticalPathPanel />
        </Panel>

        <Panel>
          <EventAutoChecklist />
        </Panel>

        <Panel>
          <EventProviderResiliencePanel />
        </Panel>

        <Panel>
          <EventQuoteHealthPanel />
        </Panel>

        <Panel>
          <EventContractGapPanel />
        </Panel>

        <Panel>
          <EventCashflowForecast />
        </Panel>

        <Panel>
          <EventMarginStressLab />
        </Panel>
        <Panel>
          <EventActionQueue />
        </Panel>

        <Panel>
          <EventDataQualityPanel />
        </Panel>

        <Panel>
          <EventIncidentMatrix />
        </Panel>

        <Panel>
          <EventDependencyGraph />
        </Panel>

        <Panel>
          <EventScenarioPlanner />
        </Panel>

        <Panel>
          <EventProviderConcentration />
        </Panel>

        <Panel>
          <EventReadinessConfidence />
        </Panel>

        <Panel>
          <EventPremortemPanel />
        </Panel>

        <Panel>
          <EventExecutionMode />
        </Panel>

        <Panel>
          <EventBudgetVariance />
        </Panel>

        <Panel>
          <EventSLAHeatmap />
        </Panel>

        <Panel>
          <EventRunbookPanel />
        </Panel>

        <Panel>
          <EventClosureCockpit />
        </Panel>
      </div>
    </section>
  );
}

function Panel({
  children,
}: {
  children:
    React.ReactNode;
}) {
  return (
    <article
      style={{
        border:
          "1px solid rgba(120,120,120,.16)",
        borderRadius:
          14,
        padding:
          14,
      }}
    >
      {children}
    </article>
  );
}
