import { createHmac } from "node:crypto";

export function normalizePhone(value) {
  if (
    typeof value !== "string" &&
    typeof value !== "number"
  ) {
    return null;
  }

  const digits = String(value).replace(/\D/g, "");

  if (
    digits.length < 8 ||
    digits.length > 16
  ) {
    return null;
  }

  // No se infiere código de país.
  // 0034... y 34... permanecen distintos.
  return digits;
}

export function phoneToken(
  secret,
  company,
  value,
) {
  const normalized = normalizePhone(value);

  if (!normalized) {
    return null;
  }

  return createHmac("sha256", secret)
    .update(`${company}\0${normalized}`)
    .digest("hex");
}

export function proposeIdentityLinks(
  anchor,
  registry,
) {
  if (
    !anchor ||
    typeof anchor !== "object" ||
    !Array.isArray(registry)
  ) {
    throw new Error("INVALID_MATCH_INPUT");
  }

  const anchorPhones = new Set(
    anchor.phone_tokens ?? [],
  );

  const grouped = new Map();

  for (const record of registry) {
    const table = record.table;
    const id = String(record.id ?? "");

    if (!table || !id) {
      continue;
    }

    const idMatch = Boolean(
      anchor.contact_id &&
      String(anchor.contact_id) === id,
    );

    const phoneMatch = (
      record.phone_tokens ?? []
    ).some(token => anchorPhones.has(token));

    if (!idMatch && !phoneMatch) {
      continue;
    }

    if (!grouped.has(table)) {
      grouped.set(table, new Map());
    }

    const tableMatches = grouped.get(table);

    const previous = tableMatches.get(id);

    const reasons = new Set(
      previous?.reasons ?? [],
    );

    if (idMatch) reasons.add("same_internal_id");
    if (phoneMatch) reasons.add("same_phone_token");

    tableMatches.set(id, {
      table,
      id,
      reasons: [...reasons].sort(),
    });
  }

  const proposals = [];

  for (const [table, matches] of grouped) {
    const candidates = [...matches.values()];

    candidates.sort((a, b) =>
      a.id.localeCompare(b.id),
    );

    const ambiguous = candidates.length > 1;

    proposals.push({
      table,
      status: ambiguous
        ? "ambiguous_requires_review"
        : "candidate_requires_review",
      candidate_count: candidates.length,
      candidates,
      automatically_linked: false,
    });
  }

  proposals.sort((a, b) =>
    a.table.localeCompare(b.table),
  );

  return {
    contact_fingerprint: anchor.fingerprint,
    proposed_tables: proposals.length,
    has_ambiguity: proposals.some(
      item =>
        item.status === "ambiguous_requires_review",
    ),
    proposals,
    automatically_linked: false,
    human_review_required: true,
  };
}
