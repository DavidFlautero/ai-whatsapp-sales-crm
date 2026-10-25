import type {
  Event360Data,
  EventRequirement360,
} from "./EventOperationsContext";

export type RiskLevel =
  | "critical"
  | "high"
  | "medium"
  | "low";

export type RiskSignal = {
  code: string;
  label: string;
  impact: number;
  requirementId?: string;
};

export type EventRiskResult = {
  score: number;
  level: RiskLevel;
  daysUntilEvent: number | null;
  signals: RiskSignal[];
  criticalPathPressure: number;
  financialExposure: number;
};

function number(
  value: unknown,
) {
  const parsed =
    Number(
      value
      ?? 0,
    );

  return Number.isFinite(
    parsed,
  )
    ? parsed
    : 0;
}

function daysUntil(
  value?:
    | string
    | null,
) {
  if (!value) {
    return null;
  }

  const target =
    new Date(
      `${value.slice(0, 10)}T12:00:00`,
    );

  if (
    Number.isNaN(
      target.getTime(),
    )
  ) {
    return null;
  }

  const now =
    new Date();

  now.setHours(
    0,
    0,
    0,
    0,
  );

  return Math.ceil(
    (
      target.getTime()
      - now.getTime()
    )
    / 86400000,
  );
}

function active(
  item: EventRequirement360,
) {
  return (
    item.service_status
    !== "cancelled"
  );
}

export function calculateEventRisk(
  data:
    Event360Data
    | null,
): EventRiskResult {
  const requirements =
    (
      data?.requirements
      ?? []
    )
      .filter(
        active,
      );

  const signals:
    RiskSignal[] =
      [];

  const eventDays =
    daysUntil(
      data?.event
        ?.event_date,
    );

  let score =
    0;

  let criticalPathPressure =
    0;

  let financialExposure =
    0;

  for (
    const item
    of requirements
  ) {
    const name =
      item.service_name
      ?? "Servicio";

    const id =
      item.id;

    const confirmed =
      [
        "confirmed",
        "completed",
      ].includes(
        item.service_status
        ?? "",
      );

    if (
      item.is_critical
      && !confirmed
    ) {
      score += 18;
      criticalPathPressure += 25;

      signals.push({
        code:
          "CRITICAL_OPEN",
        label:
          `${name}: crítico abierto`,
        impact:
          18,
        requirementId:
          id,
      });
    }

    if (
      !item
        .assigned_provider_id
    ) {
      const impact =
        item.is_critical
          ? 24
          : 10;

      score +=
        impact;

      criticalPathPressure +=
        item.is_critical
          ? 30
          : 10;

      signals.push({
        code:
          "NO_PROVIDER",
        label:
          `${name}: sin proveedor`,
        impact,
        requirementId:
          id,
      });
    }

    if (
      !item
        .responsible_team_member_id
    ) {
      const impact =
        item.is_critical
          ? 12
          : 5;

      score +=
        impact;

      signals.push({
        code:
          "NO_OWNER",
        label:
          `${name}: sin responsable`,
        impact,
        requirementId:
          id,
      });
    }

    if (
      item.contract_status
      === "pending"
    ) {
      score += 8;

      signals.push({
        code:
          "CONTRACT_PENDING",
        label:
          `${name}: contrato pendiente`,
        impact:
          8,
        requirementId:
          id,
      });
    }

    const required =
      number(
        item.deposit_required,
      );

    const paid =
      number(
        item.deposit_paid,
      );

    const pending =
      Math.max(
        0,
        required
        - paid,
      );

    if (
      pending > 0
    ) {
      const impact =
        Math.min(
          12,
          4
          + pending
            / 250,
        );

      score +=
        impact;

      financialExposure +=
        pending;

      signals.push({
        code:
          "DEPOSIT_PENDING",
        label:
          `${name}: anticipo pendiente`,
        impact:
          Math.round(
            impact,
          ),
        requirementId:
          id,
      });
    }
  }

  const readiness =
    number(
      data?.readiness
        ?.readiness_percent,
    );

  if (
    readiness < 50
  ) {
    score += 20;

    signals.push({
      code:
        "LOW_READINESS",
      label:
        `Preparación ${readiness}%`,
      impact:
        20,
    });
  } else if (
    readiness < 80
  ) {
    score += 10;

    signals.push({
      code:
        "MEDIUM_READINESS",
      label:
        `Preparación ${readiness}%`,
      impact:
        10,
    });
  }

  if (
    eventDays !== null
  ) {
    if (
      eventDays <= 2
    ) {
      score *= 1.8;
    } else if (
      eventDays <= 7
    ) {
      score *= 1.45;
    } else if (
      eventDays <= 14
    ) {
      score *= 1.2;
    }
  }

  score =
    Math.max(
      0,
      Math.min(
        100,
        Math.round(
          score,
        ),
      ),
    );

  const level:
    RiskLevel =
      score >= 75
        ? "critical"
        : score >= 50
          ? "high"
          : score >= 25
            ? "medium"
            : "low";

  signals.sort(
    (
      left,
      right,
    ) =>
      right.impact
      - left.impact,
  );

  return {
    score,
    level,
    daysUntilEvent:
      eventDays,
    signals,
    criticalPathPressure:
      Math.min(
        100,
        criticalPathPressure,
      ),
    financialExposure,
  };
}
