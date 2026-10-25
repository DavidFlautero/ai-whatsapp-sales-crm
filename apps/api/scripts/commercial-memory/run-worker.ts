import {
  loadConfig,
} from "../../src/modules/commercial-memory/config.js";

import {
  runContinuous,
} from "../../src/modules/commercial-memory/worker.js";

runContinuous(loadConfig()).catch(error => {
  console.error(
    "CM_FATAL",
    error instanceof Error
      ? error.message
      : "UNKNOWN",
  );

  process.exitCode = 1;
});
