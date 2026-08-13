import {
  learningStatus,
  runConversationLearning,
} from "../services/learning/conversation-learning.service.js";

const args =
  new Set(
    process.argv.slice(2),
  );

if (
  args.has(
    "--status",
  )
) {
  console.log(
    JSON.stringify(
      await learningStatus(),
      null,
      2,
    ),
  );

  process.exit(
    0,
  );
}

const lookbackArg =
  process.argv.find(
    (value) =>
      value.startsWith(
        "--lookback-hours=",
      ),
  );

const lookbackHours =
  lookbackArg
    ? Number(
        lookbackArg.split(
          "=",
        )[1],
      )
    : undefined;

const result =
  await runConversationLearning({
    force:
      args.has(
        "--force",
      ),

    dryRun:
      args.has(
        "--dry-run",
      ),

    lookbackHours:
      Number.isFinite(
        lookbackHours,
      )
        ? lookbackHours
        : undefined,
  });

console.log(
  JSON.stringify(
    result,
    null,
    2,
  ),
);
