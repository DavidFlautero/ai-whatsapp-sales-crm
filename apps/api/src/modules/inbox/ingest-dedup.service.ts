import {
  createHash,
} from "node:crypto";

export type IngestIdentity = {
  companyId: string;
  provider: string;
  externalMessageId: string;
};

export function getIngestKey(
  input: IngestIdentity,
): string {
  const companyId = input.companyId.trim();
  const provider = input.provider.trim().toLowerCase();
  const externalId = input.externalMessageId.trim();

  if (
    !companyId ||
    !provider ||
    !externalId
  ) {
    throw new Error("INVALID_INGEST_IDENTITY");
  }

  const value = JSON.stringify([
    companyId,
    provider,
    externalId,
  ]);

  return createHash("sha256")
    .update(value)
    .digest("hex");
}

export function isSameIngestIdentity(
  a: IngestIdentity,
  b: IngestIdentity,
): boolean {
  return getIngestKey(a) === getIngestKey(b);
}
