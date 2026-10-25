import type {
  Message,
  Role,
} from "./types.js";

export type RoleResult = {
  role: Role;
  score: number;
  why: string;
};

export function detectRole(
  message: Message,
): RoleResult | null {
  if (
    message.message_type !== "text" ||
    !message.body
  ) {
    return null;
  }

  const text = message.body.toLocaleLowerCase("es");

  if (message.direction === "outbound") {
    if (
      /\b(tu|su|vuestro)\s+(chalet|local|sal[oó]n|finca|espacio)\b/
        .test(text) &&
      /disponib|precio|alquil|reserv|libre/
        .test(text)
    ) {
      return {
        role: "owner",
        score: 0.87,
        why: "outbound_owner_question",
      };
    }

    if (
      /\b(tu|su)\s+(servicio|catering|equipo|dj)\b/
        .test(text) &&
      /precio|disponib|presupuesto/.test(text)
    ) {
      return {
        role: "supplier",
        score: 0.78,
        why: "outbound_supplier_question",
      };
    }
  } else {
    if (
      /\b(mi|nuestro)\s+(chalet|local|sal[oó]n|finca|espacio)\b/
        .test(text) &&
      /alquil|precio|libre|disponib|tengo|ofrezco/
        .test(text)
    ) {
      return {
        role: "owner",
        score: 0.88,
        why: "self_reference_to_venue",
      };
    }

    if (
      /\b(ofrezco|hago|trabajo de|soy)\b/
        .test(text) &&
      /catering|dj|decoraci[oó]n|limpieza|fotograf|sonido/
        .test(text)
    ) {
      return {
        role: "supplier",
        score: 0.79,
        why: "offers_event_services",
      };
    }

    if (
      /\b(busco|necesito|quiero|quisiera|me interesa)\b/
        .test(text) &&
      /chalet|sal[oó]n|local|cumplea[nñ]os|boda|evento/
        .test(text)
    ) {
      return {
        role: "customer",
        score: 0.82,
        why: "customer_event_request",
      };
    }
  }

  return null;
}
