import {
  loadConfig,
} from "../../src/modules/commercial-memory/config.js";

import {
  Supabase,
} from "../../src/modules/commercial-memory/supabase.js";

async function main() {
  const [id, decision] = process.argv.slice(2);

  const actor =
    process.env.CM_REVIEW_ACTOR?.trim();

  if (
    !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id || "") ||
    !["verified","rejected"].includes(decision) ||
    !actor ||
    actor.length < 3
  ) {
    throw new Error(
      "REQUIRES MEMORY_ID, verified|rejected AND CM_REVIEW_ACTOR",
    );
  }

  const cfg = loadConfig();

  if (!cfg.writeEnabled) {
    throw new Error("CM_WRITE_ENABLED_REQUIRED");
  }

  const db = new Supabase(cfg);

  const result = await db.rpc<boolean>(
    "cm_review_intel_memory",
    {
      p_company: cfg.companyId,
      p_memory_id: id,
      p_decision: decision,
      p_actor: actor,
    },
  );

  console.log(
    result
      ? "CM_MEMORY_REVIEW_RECORDED"
      : "CM_MEMORY_NOT_FOUND_OR_ALREADY_REVIEWED",
  );
}

main().catch(error => {
  console.error(
    "CM_MEMORY_REVIEW_ERROR",
    error instanceof Error
      ? error.message
      : "UNKNOWN",
  );

  process.exitCode = 1;
});
