import assert from "node:assert/strict";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

async function main() {
  const root = await mkdtemp(
    join(tmpdir(), "eventos-ingest-test-"),
  );

  process.env.CRM_INGEST_SPOOL_DIR = root;

  try {
    const queue = await import(
      "../src/modules/inbox/ingest-outbox.repository.js"
    );

    const message = {
      external_message_id: "isolated-stage1-test",
      contact_phone: "000000000",
      direction: "inbound",
      channel: "whatsapp",
      message_type: "text",
      body: "Mensaje ficticio de prueba",
      occurred_at: new Date().toISOString(),
    } as Parameters<
      typeof queue.stageIngestMessage
    >[1];

    const company = "isolated-test-company";

    console.log("=== 1. PERSISTENCIA ===");

    const key = await queue.stageIngestMessage(
      company,
      message,
    );

    const saved = await queue.readIngestRecord(
      "pending",
      key,
    );

    assert.equal(saved.companyId, company);
    assert.equal(
      saved.message.external_message_id,
      message.external_message_id,
    );

    console.log("OK: Mensaje persistido");

    console.log("=== 2. DEDUPLICACION ===");

    await queue.stageIngestMessage(
      company,
      message,
    );

    const pending = (
      await readdir(join(root, "pending"))
    ).filter(name => name.endsWith(".json"));

    assert.equal(pending.length, 1);

    console.log("OK: Sin duplicados");

    console.log("=== 3. CONCURRENCIA ===");

    const claims = await Promise.all([
      queue.claimIngestRecord(key),
      queue.claimIngestRecord(key),
    ]);

    assert.equal(
      claims.filter(Boolean).length,
      1,
    );

    console.log("OK: Un solo trabajador");

    console.log("=== 4. FALLO Y REINTENTO ===");

    const processing = await queue.readIngestRecord(
      "processing",
      key,
    );

    const destination =
      await queue.failIngestRecord(
        key,
        processing,
      );

    assert.equal(destination, "pending");

    const retry = await queue.readIngestRecord(
      "pending",
      key,
    );

    assert.equal(retry.attempts, 1);
    assert.ok(retry.nextAttemptAt > Date.now());

    console.log("OK: Reintento conservado");

    console.log("=== 5. FINALIZACION ===");

    assert.equal(
      await queue.claimIngestRecord(key),
      true,
    );

    await queue.completeIngestRecord(key);

    const remaining = (
      await readdir(join(root, "processing"))
    ).filter(name => name.endsWith(".json"));

    assert.equal(remaining.length, 0);

    console.log("OK: Trabajo completado");

    console.log("=== RESULTADO ===");
    console.log("PRUEBA DE DURABILIDAD SUPERADA");
  } finally {
    await rm(root, {
      recursive: true,
      force: true,
    });
  }
}

main().catch(error => {
  console.error("ERROR:", error.message);
  process.exitCode = 1;
});
