import type {
  Event360Data,
} from "./EventOperationsContext";

export type NextAction = {
  id: string;
  priority:
    | "P0"
    | "P1"
    | "P2"
    | "P3";
  category:
    | "provider"
    | "payment"
    | "contract"
    | "responsible"
    | "data"
    | "execution";
  title: string;
  reason: string;
  requirementId?: string;
  score: number;
};

function n(
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
  date?:
    | string
    | null,
) {
  if (!date) {
    return null;
  }

  const target =
    new Date(
      `${date.slice(0,10)}T12:00:00`,
    );

  if (
    Number.isNaN(
      target.getTime(),
    )
  ) {
    return null;
  }

  const today =
    new Date();

  today.setHours(
    0,
    0,
    0,
    0,
  );

  return Math.ceil(
    (
      target.getTime()
      - today.getTime()
    )
    / 86400000,
  );
}

export function buildNextActions(
  data:
    Event360Data
    | null,
): NextAction[] {
  const result:
    NextAction[] =
      [];

  const eventDays =
    daysUntil(
      data?.event
        ?.event_date,
    );

  for (
    const item
    of data?.requirements
    ?? []
  ) {
    if (
      item.service_status
      === "cancelled"
    ) {
      continue;
    }

    const name =
      item.service_name
      ?? "Servicio";

    const id =
      item.id
      ?? name;

    if (
      !item
        .assigned_provider_id
    ) {
      let score =
        item.is_critical
          ? 90
          : 60;

      if (
        eventDays !== null
        && eventDays <= 7
      ) {
        score += 10;
      }

      result.push({
        id:
          `provider-${id}`,

        priority:
          score >= 90
            ? "P0"
            : "P1",

        category:
          "provider",

        title:
          `Asignar proveedor a ${name}`,

        reason:
          item.is_critical
            ? "Servicio crítico sin cobertura."
            : "Servicio operativo sin proveedor.",

        requirementId:
          item.id,

        score,
      });
    }

    if (
      !item
        .responsible_team_member_id
    ) {
      result.push({
        id:
          `owner-${id}`,

        priority:
          item.is_critical
            ? "P1"
            : "P2",

        category:
          "responsible",

        title:
          `Asignar responsable a ${name}`,

        reason:
          "No existe ownership operativo.",

        requirementId:
          item.id,

        score:
          item.is_critical
            ? 75
            : 45,
      });
    }

    if (
      item.contract_status
      === "pending"
    ) {
      result.push({
        id:
          `contract-${id}`,

        priority:
          eventDays !== null
          && eventDays <= 10
            ? "P1"
            : "P2",

        category:
          "contract",

        title:
          `Cerrar contrato de ${name}`,

        reason:
          "El servicio tiene documentación contractual abierta.",

        requirementId:
          item.id,

        score:
          eventDays !== null
          && eventDays <= 10
            ? 72
            : 48,
      });
    }

    const required =
      n(
        item.deposit_required,
      );

    const paid =
      n(
        item.deposit_paid,
      );

    if (
      required > paid
    ) {
      result.push({
        id:
          `payment-${id}`,

        priority:
          "P2",

        category:
          "payment",

        title:
          `Resolver anticipo de ${name}`,

        reason:
          `${Math.round(
            required - paid,
          )} € pendientes.`,

        requirementId:
          item.id,

        score:
          Math.min(
            70,
            40
            + (
              required
              - paid
            )
            / 100,
          ),
      });
    }
  }

  if (
    !data?.event
      ?.event_date
  ) {
    result.push({
      id:
        "event-date",

      priority:
        "P0",

      category:
        "data",

      title:
        "Definir fecha del evento",

      reason:
        "Sin fecha no se puede calcular planificación ni riesgo temporal.",

      score:
        100,
    });
  }

  return result
    .sort(
      (
        left,
        right,
      ) =>
        right.score
        - left.score,
    );
}
