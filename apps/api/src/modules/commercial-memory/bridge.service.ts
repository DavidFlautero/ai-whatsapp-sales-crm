import { Supabase } from "./supabase.js";
import { normalizePhone } from "./phone.js";
import { digest } from "./keys.js";

import {
  readCanonicalCatalog,
} from "./bridge-catalog.js";

import {
  readCanonicalRows,
} from "./bridge-source.js";

import type {
  BridgeStatistics,
  BridgeCandidate,
} from "./bridge-types.js";

type IdentityRow = {
  id: string;
  primary_phone: string;
};

type CaseRow = {
  id: string;
  customer_identity_id: string;
  event_date: string | null;
};

async function readAll<T>(
  db: Supabase,
  table: string,
  company: string,
  columns: string,
): Promise<T[]> {
  const result: T[] = [];

  for (let offset = 0; offset < 10000; offset += 500) {
    const rows = await db.get<T[]>(
      table,
      [
        ["select", columns],
        ["company_id", `eq.${company}`],
        ["limit", "500"],
        ["offset", String(offset)],
      ],
    );

    result.push(...rows);

    if (rows.length < 500) return result;
  }

  throw new Error("CM_READ_LIMIT_REACHED");
}

export async function buildCanonicalBridge(
  db: Supabase,
  company: string,
  apply: boolean,
): Promise<BridgeStatistics> {
  const identities = await readAll<IdentityRow>(
    db,
    "crm_memory_identities",
    company,
    "id,primary_phone",
  );

  const cases = await readAll<CaseRow>(
    db,
    "crm_memory_cases",
    company,
    "id,customer_identity_id,event_date",
  );

  const catalog = await readCanonicalCatalog(db);

  const byPhone = new Map<string, IdentityRow[]>();

  for (const identity of identities) {
    const phone = normalizePhone(identity.primary_phone);

    if (!phone) continue;

    const current = byPhone.get(phone) || [];
    current.push(identity);
    byPhone.set(phone, current);
  }

  let candidateLinks = 0;
  let ambiguousMatches = 0;

  for (const table of catalog) {
    const rows = await readCanonicalRows(
      db,
      table,
      company,
    );

    const found = new Map<string, string[]>();

    for (const row of rows) {
      for (const raw of row.phones) {
        const phone = normalizePhone(raw);

        if (!phone) continue;

        const key = `${phone}:${row.id}`;
        if (!found.has(key)) {
          found.set(key, []);
        }
      }
    }

    const phoneFrequency = new Map<string, number>();

    for (const key of found.keys()) {
      const phone = key.split(":")[0];

      phoneFrequency.set(
        phone,
        (phoneFrequency.get(phone) || 0) + 1,
      );
    }

    const uniqueCandidates = new Set<string>();

    for (const row of rows) {
      if (!row.id || row.id === "undefined") continue;

      for (const raw of row.phones) {
        const phone = normalizePhone(raw);

        if (!phone) continue;

        const people = byPhone.get(phone) || [];

        for (const identity of people) {
          const matchingCases = cases.filter(
            item =>
              item.customer_identity_id === identity.id &&
              Boolean(row.eventDate) &&
              item.event_date === row.eventDate,
          );

          const caseId =
            matchingCases.length === 1
              ? matchingCases[0].id
              : null;

          const ambiguous =
            (phoneFrequency.get(phone) || 0) > 1 ||
            people.length > 1 ||
            matchingCases.length > 1;

          const candidateKey = digest(
            company,
            identity.id,
            table.table,
            row.id,
            caseId || "",
          );

          if (uniqueCandidates.has(candidateKey)) {
            continue;
          }

          uniqueCandidates.add(candidateKey);
          candidateLinks++;

          if (ambiguous) ambiguousMatches++;

          const candidate: BridgeCandidate = {
            company_id: company,
            candidate_key: candidateKey,
            identity_id: identity.id,
            case_id: caseId,
            target_table: table.table,
            target_id: row.id,
            match_basis:
              caseId
                ? "phone_and_event_date"
                : "normalized_phone",
            confidence:
              ambiguous
                ? 0.55
                : caseId
                  ? 0.93
                  : 0.83,
            status: "proposed",
            evidence: {
              normalized_phone_match: true,
              matched_event_date:
                caseId ? row.eventDate : null,
              ambiguous,
            },
          };

          if (apply) {
            await db.insertIgnore(
              "cm_bridge_candidates",
              candidate,
              "company_id,candidate_key",
            );
          }
        }
      }
    }
  }

  return {
    identities: identities.length,
    candidateLinks,
    ambiguousMatches,
    canonicalTables: catalog.length,
  };
}
