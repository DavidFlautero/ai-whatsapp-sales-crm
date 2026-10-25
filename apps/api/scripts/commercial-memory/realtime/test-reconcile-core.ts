import assert from "node:assert/strict";

import {
  normalizeCommercialMessage,
  deduplicateMessages,
} from "../../../src/modules/commercial-memory/realtime/reconcile-core.js";

const COMPANY =
  "eventos-mediterraneo";

function message(
  overrides: Record<string, unknown> = {},
) {
  return {
    id: "message-test-001",

    company_id: COMPANY,

    direction: "inbound",

    created_at:
      "2026-10-15T10:00:00.000Z",

    conversation_id:
      "conversation-test-001",

    ...overrides,
  };
}

function accepted(
  raw: Record<string, unknown>,
) {
  const result =
    normalizeCommercialMessage(
      raw,
      COMPANY,
    );

  assert.equal(
    result.status,
    "accepted",
  );

  if (result.status !== "accepted") {
    throw new Error(
      "EXPECTED_ACCEPTED_MESSAGE",
    );
  }

  return result.message;
}

function run(
  name: string,
  fn: () => void,
) {
  fn();
  console.log(
    "TEST_OK",
    name,
  );
}

run(
  "INBOUND_MESSAGE",
  () => {
    const result = accepted(
      message(),
    );

    assert.equal(
      result.direction,
      "inbound",
    );
  },
);

run(
  "OUTBOUND_MESSAGE",
  () => {
    const result = accepted(
      message({
        direction: "outbound",
      }),
    );

    assert.equal(
      result.direction,
      "outbound",
    );
  },
);

run(
  "CROSS_COMPANY_REJECTED",
  () => {
    const result =
      normalizeCommercialMessage(
        message({
          company_id:
            "another-company",
        }),
        COMPANY,
      );

    assert.equal(
      result.status,
      "quarantined",
    );
  },
);

run(
  "DUPLICATE_DETECTION",
  () => {
    const first = accepted(
      message(),
    );

    const second = accepted(
      message(),
    );

    assert.equal(
      first.idempotencyKey,
      second.idempotencyKey,
    );

    assert.equal(
      deduplicateMessages([
        first,
        second,
      ]).length,
      1,
    );
  },
);

run(
  "TENANT_SCOPED_KEYS",
  () => {
    const first = accepted(
      message(),
    );

    const second =
      normalizeCommercialMessage(
        message({
          company_id:
            "another-company",
        }),
        "another-company",
      );

    assert.equal(
      second.status,
      "accepted",
    );

    if (second.status !== "accepted") {
      throw new Error(
        "EXPECTED_SECOND_MESSAGE",
      );
    }

    assert.notEqual(
      first.idempotencyKey,
      second.message.idempotencyKey,
    );
  },
);

run(
  "MISSING_IDENTIFIER_QUARANTINED",
  () => {
    const result =
      normalizeCommercialMessage(
        message({
          id: null,
        }),
        COMPANY,
      );

    assert.equal(
      result.status,
      "quarantined",
    );
  },
);

run(
  "INVALID_TIMESTAMP_QUARANTINED",
  () => {
    const result =
      normalizeCommercialMessage(
        message({
          created_at:
            "invalid-date",
        }),
        COMPANY,
      );

    assert.equal(
      result.status,
      "quarantined",
    );
  },
);

run(
  "UNKNOWN_DIRECTION_REVIEW",
  () => {
    const result = accepted(
      message({
        direction: "other",
      }),
    );

    assert.equal(
      result.direction,
      "unknown",
    );

    assert.equal(
      result.requiresReview,
      true,
    );
  },
);

run(
  "UNLINKED_MESSAGE_REVIEW",
  () => {
    const result = accepted(
      message({
        conversation_id: null,
        contact_id: null,
      }),
    );

    assert.equal(
      result.requiresReview,
      true,
    );
  },
);

run(
  "CHRONOLOGICAL_ORDER",
  () => {
    const first = accepted(
      message({
        id: "later",
        created_at:
          "2026-10-15T12:00:00Z",
      }),
    );

    const second = accepted(
      message({
        id: "earlier",
        created_at:
          "2026-10-15T09:00:00Z",
      }),
    );

    const ordered =
      deduplicateMessages([
        first,
        second,
      ]);

    assert.equal(
      ordered[0].sourceMessageId,
      "earlier",
    );
  },
);

console.log(
  "CM_REALTIME_CONTRACT_TESTS_PASSED",
);
