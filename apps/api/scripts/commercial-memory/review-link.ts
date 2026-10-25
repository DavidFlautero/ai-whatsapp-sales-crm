import {
  loadConfig,
} from "../../src/modules/commercial-memory/config.js";

import {
  Supabase,
} from "../../src/modules/commercial-memory/supabase.js";

async function main() {
  const [kind, id, decision] =
    process.argv.slice(2);

  const actor =
    process.env.CM_REVIEW_ACTOR?.trim();

  if (
    !["bridge","partner"].includes(kind) ||
    !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id || "") ||
    !["accepted","rejected"].includes(decision) ||
    !actor ||
    actor.length < 3
  ) {
    throw new Error(
      "USAGE: kind id accepted|rejected; CM_REVIEW_ACTOR required",
    );
  }

  const cfg = loadConfig();

  if (!cfg.writeEnabled) {
    throw new Error("CM_WRITE_ENABLED_REQUIRED");
  }

  const db = new Supabase(cfg);

  const reviewed = await db.rpc<boolean>(
    "cm_review_link",
    {
      p_company: cfg.companyId,
      p_kind: kind,
      p_id: id,
      p_decision: decision,
      p_actor: actor,
    },
  );

  console.log(
    reviewed
      ? "CM_LINK_REVIEW_RECORDED"
      : "CM_LINK_NOT_FOUND_OR_ALREADY_REVIEWED",
  );
}

main().catch(error => {
  console.error(
    "CM_REVIEW_ERROR",
    error instanceof Error
      ? error.message
      : "UNKNOWN",
  );

  process.exitCode = 1;
});
