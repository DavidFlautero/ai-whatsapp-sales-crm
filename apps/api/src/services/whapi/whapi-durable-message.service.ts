import {
  env,
} from "../../config/env.js";

import {
  saveMessage as repositorySaveMessage,
} from "../conversations/conversation.repository.js";

import {
  stageIngestMessage,
} from "../../modules/inbox/ingest-outbox.repository.js";

import {
  startDurableIngestWorker,
} from "../../modules/inbox/ingest-worker.service.js";

type Input =
  Parameters<typeof repositorySaveMessage>[0];

type Options =
  Parameters<typeof repositorySaveMessage>[2];

startDurableIngestWorker();

export async function saveMessage(
  input: Input,
  companyId = env.DEFAULT_COMPANY_ID,
  options?: Options,
) {
  /*
   * Nunca comenzar el guardado normal
   * sin haber creado primero la copia
   * duradera del mensaje.
   */
  await stageIngestMessage(
    companyId,
    input,
  );

  /*
   * Se conserva el comportamiento
   * original de la aplicación.
   *
   * El trabajador independiente
   * verificará posteriormente la
   * persistencia y la captación.
   */
  return repositorySaveMessage(
    input,
    companyId,
    options,
  );
}
